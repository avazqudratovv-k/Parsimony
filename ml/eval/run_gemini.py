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

from google import genai  # noqa: E402
from google.genai import types  # noqa: E402

from app.ai.base import ParseContext  # noqa: E402
from app.ai.prompts import ENTRY_JSON_SCHEMA, _build_base_prompt  # noqa: E402

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
OUT = ROOT / "ml" / "eval" / "preds_gemini.jsonl"


def main() -> None:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    cases = [json.loads(line) for line in (ROOT / "ml/data/test.jsonl").open()]
    rows = []
    for i, case in enumerate(cases, 1):
        ctx = ParseContext(
            today=dt.date.fromisoformat(case["reference_date"]),
            timezone="Asia/Seoul",
            default_currency=case["default_currency"],
        )
        started = time.perf_counter()
        output = None
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
            output = json.loads(r.text)
        except Exception as exc:  # keep going: a failed call counts as a wrong answer
            print(f"  case {i} failed: {type(exc).__name__}")
        seconds = round(time.perf_counter() - started, 2)
        rows.append({"text": case["text"], "output": output, "seconds": seconds})
        print(f"{i:3d}/{len(cases)} {seconds:5.2f}s  {case['text'][:50]}")
    OUT.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    secs = sorted(r["seconds"] for r in rows)
    print(f"\nwrote {OUT}\nmedian {secs[len(secs) // 2]}s, slowest {secs[-1]}s")


if __name__ == "__main__":
    main()
