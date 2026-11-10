"""Runs the 100 test cases through Gemini with the app's real prompt and writes predictions.

Run on your own machine (your key never leaves it), from the repo root:

    cd backend && source .venv/bin/activate            # any env that has google-genai installed
    cd .. && GEMINI_API_KEY=... python ml/eval/run_gemini.py
    python ml/eval/score.py ml/eval/preds_gemini.jsonl

It makes 100 small calls (a few cents at most). Output also records seconds per call.
"""

import datetime as dt
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.ai.base import ParseContext
from app.ai.prompts import ENTRY_JSON_SCHEMA, _build_base_prompt
from google import genai
from google.genai import types

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
OUT = ROOT / "ml" / "eval" / "preds_gemini.jsonl"


PAUSE = float(
    os.environ.get("PAUSE_SECONDS", "5")
)  # gap between calls: stays under per-minute limits
RETRIES = 5


def call(client, case, ctx):
    """One call with retries. Returns (output, error_text). Waits and retries on 429 / 5xx."""
    err = ""
    for attempt in range(RETRIES):
        try:
            r = client.models.generate_content(
                model=MODEL,
                contents=case["text"],
                config=types.GenerateContentConfig(
                    system_instruction=_build_base_prompt(ctx),
                    response_mime_type="application/json",
                    response_json_schema=ENTRY_JSON_SCHEMA,
                    temperature=0.0,
                    max_output_tokens=400,
                ),
            )
            return json.loads(r.text), ""
        except Exception as exc:  # noqa: BLE001
            code = getattr(exc, "code", None)
            err = f"{type(exc).__name__} {code}: {str(exc)[:160]}"
            if code in (429, 500, 502, 503, 504) or code is None:
                time.sleep(10 * (attempt + 1))  # 10s, 20s, 30s...
                continue
            break  # a real client error (bad key, bad request): retrying will not help
    return None, err


def main() -> None:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    cases = [json.loads(line) for line in (ROOT / "ml/data/test.jsonl").open()]
    done = {}
    if (
        OUT.exists()
    ):  # resume: keep answers already collected, redo only the failed ones
        for line in OUT.open():
            row = json.loads(line)
            if row["output"] is not None:
                done[row["text"]] = row
    rows, failed = [], 0
    for i, case in enumerate(cases, 1):
        if case["text"] in done:
            rows.append(done[case["text"]])
            continue
        ctx = ParseContext(
            today=dt.date.fromisoformat(case["reference_date"]),
            timezone="Asia/Seoul",
            default_currency=case["default_currency"],
        )
        started = time.perf_counter()
        output, err = call(client, case, ctx)
        seconds = round(time.perf_counter() - started, 2)
        failed += output is None
        rows.append(
            {"text": case["text"], "output": output, "seconds": seconds, "error": err}
        )
        print(
            f"{i:3d}/{len(cases)} {seconds:5.2f}s {'OK ' if output else 'FAIL'} {case['text'][:44]} {err}"
        )
        time.sleep(PAUSE)
    OUT.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )
    secs = sorted(
        r["seconds"] for r in rows if r["output"] is not None and r.get("seconds")
    )
    print(f"\nwrote {OUT}\nfailed calls: {failed} of {len(cases)}")
    if secs:
        print(
            f"median {secs[len(secs) // 2]}s, slowest {secs[-1]}s (successful, new calls only)"
        )
    if failed:
        print(
            "Some calls failed, so the score is NOT valid yet. Run this command again: it only redoes the failed ones."
        )


if __name__ == "__main__":
    main()
