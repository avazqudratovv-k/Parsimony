"""Scores a model's answers against ml/data/test.jsonl. No network, no model: just arithmetic.

Usage:
    python ml/eval/score.py predictions.jsonl            # one line per test case, same order or matched by text
    python ml/eval/score.py --self-test                  # checks the scorer itself

A predictions line looks like:  {"text": "...", "output": {<the model's JSON>} }   (output null = unparsable)

What counts as right, per field:
- date, currency, category, payment_method: exact match.
- amount: equal within 0.005.
- merchant: case-insensitive match with any accepted spelling; no merchant expected means none given.
- items: same number of items and, in order, the same amount and category (and currency / payment
  method when the label states one).
- not an expense: the model must answer amount 0.
A case is "fully right" only when every judged field is right. The report is per field and per language.
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

TEST = Path(__file__).resolve().parents[1] / "data" / "test.jsonl"
FIELDS = [
    "date",
    "amount",
    "currency",
    "category",
    "payment_method",
    "merchant",
    "items",
]


def _merchant_ok(expected, got):
    if expected is None:
        return not got
    return isinstance(got, str) and got.strip().lower() in {m.lower() for m in expected}


def _items_ok(expected, got):
    got = got or []
    if len(expected) != len(got):
        return False
    for e, g in zip(expected, got, strict=True):
        if (
            abs(float(g.get("amount", -1)) - e["amount"]) > 0.005
            or g.get("category") != e["category"]
        ):
            return False
        if e["currency"] and g.get("currency") != e["currency"]:
            return False
        if e["payment_method"] and g.get("payment_method") != e["payment_method"]:
            return False
    return True


def judge(case, output):
    """Returns {field: True/False} for the fields this case judges."""
    e = case["expected"]
    if output is None:
        return {
            f: False
            for f in (["amount"] if e.get("not_expense") else FIELDS)
            if f != "items" or e.get("items")
        }
    if e.get("not_expense"):
        return {"amount": float(output.get("amount") or 0) == 0}
    r = {}
    for f in ("date", "currency", "category", "payment_method"):
        if e[f] is not None:
            r[f] = output.get(f) == e[f]
    if e["amount"] is not None:
        r["amount"] = abs(float(output.get("amount", -1)) - e["amount"]) <= 0.005
    if e["items"] or output.get("items"):
        r["items"] = _items_ok(e["items"], output.get("items"))
    r["merchant"] = (
        _merchant_ok(e["merchant"], output.get("merchant"))
        if not e["items"] or e["merchant"]
        else True
    )
    return r


def report(cases, outputs):
    hit, total, full, by_lang = (
        defaultdict(int),
        defaultdict(int),
        defaultdict(list),
        defaultdict(list),
    )
    valid = 0
    for case, out in zip(cases, outputs, strict=True):
        valid += out is not None
        res = judge(case, out)
        for f, ok in res.items():
            total[f] += 1
            hit[f] += ok
        ok_all = all(res.values())
        full[case["lang"]].append(ok_all)
        by_lang["all"].append(ok_all)
    lines = [f"cases: {len(cases)}   valid JSON: {valid}/{len(cases)}"]
    lines += [
        f"  {f:15s} {hit[f]:3d}/{total[f]:3d}  {100 * hit[f] / max(total[f], 1):5.1f}%"
        for f in FIELDS
        if total[f]
    ]
    lines.append("fully right (every judged field):")
    for lang in ("en", "ko", "uz"):
        v = full[lang]
        lines.append(
            f"  {lang}  {sum(v):3d}/{len(v):3d}  {100 * sum(v) / max(len(v), 1):5.1f}%"
        )
    v = by_lang["all"]
    lines.append(
        f"  all {sum(v):3d}/{len(v):3d}  {100 * sum(v) / max(len(v), 1):5.1f}%"
    )
    return "\n".join(lines)


def load_cases():
    return [
        json.loads(line)
        for line in TEST.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def gold_output(case):
    """What a perfect model would say. Used by the self-test."""
    e = case["expected"]
    if e.get("not_expense"):
        return {"amount": 0}
    out = {
        k: e[k] for k in ("date", "amount", "currency", "category", "payment_method")
    }
    out["merchant"] = e["merchant"][0] if e["merchant"] else None
    out["items"] = [{k: v for k, v in it.items() if v is not None} for it in e["items"]]
    return out


def self_test():
    cases = load_cases()
    perfect = report(cases, [gold_output(c) for c in cases])
    assert "all 100/100" in perfect, perfect
    broken = [None if i % 10 == 0 else gold_output(c) for i, c in enumerate(cases)]
    assert "valid JSON: 90/100" in report(cases, broken)
    wrong = [
        dict(gold_output(c), category="other")
        if not c["expected"].get("not_expense")
        else gold_output(c)
        for c in cases
    ]
    assert "all 100/100" not in report(cases, wrong)
    print("scorer ok\n" + perfect)


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    elif len(sys.argv) == 2:
        cases = load_cases()
        by_text = {}
        for line in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                by_text[row["text"]] = row.get("output")
        missing = [c["text"] for c in cases if c["text"] not in by_text]
        if missing:
            sys.exit(
                f"{len(missing)} test cases have no prediction, first: {missing[0]!r}"
            )
        print(report(cases, [by_text[c["text"]] for c in cases]))
    else:
        sys.exit(__doc__)
