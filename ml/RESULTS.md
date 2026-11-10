# Fine-tuning results (Parsimony entry parser)

Task: turn one typed line (English, Korean or Uzbek) into a structured expense (date, amount, currency, category, payment, merchant, items).
Test: 100 hand-labeled cases (34 en / 33 ko / 33 uz), never used for training. Labels were frozen before any model was scored.

| | Gemini API (app prompt) | Qwen2.5-1.5B untuned | Round 1: LoRA on templates | Round 2: LoRA on Gemini-worded data |
|---|---|---|---|---|
| Fully right (all fields) | **85** | 0 | 45 | **67** |
| English / Korean / Uzbek | 91 / 85 / 79 % | 0 / 0 / 0 | 50 / 58 / 27 % | 76 / 64 / 61 % |
| Valid JSON | 100 | 2 | 100 | 100 |
| Date | 98.9 % | 0 | 83.0 | 91.5 |
| Amount | 100 | 2 | 86.6 | 96.9 |
| Currency | 98.9 | 1 | 94.5 | 100 |
| Category | 93.4 | 0 | 70.3 | 81.3 |
| Payment method | 98.9 | 0 | 96.7 | 98.9 |
| Merchant | 95.7 | 2 | 89.4 | 97.9 |
| Multi-item purchases (strict) | 70 (7/10) | 0 | 0 | 0 (of 8) |

Setup: LoRA r=16 on all attention + MLP projections, lr 2e-4, 2 epochs, fp16, one free Colab T4. Round 2 trained on 4,148 rows (3,567 Gemini-worded + 800 template rows, 5% held back to watch validation loss), ~17 minutes.

## What happened
- Round 1 used my own templates. Training loss reached ~0.001 (it memorized the templates) and the test score was 45.
- Round 2 decided every label in code and had Gemini write only the wording (typos, 4만8천원, 85 ming, multi-item, non-expenses). Validation loss ended at ~0.029 and the test score rose to 67. The data, not the training settings, was the problem.
- Gemini is still better on this test, so the app keeps using Gemini.

## Where the small model is still weak
- Relative dates in Korean and Uzbek (그저께, "5일에", "ikki kun oldin"): 8 date misses, including one invented date.
- Amount slips: `택시 만이천원` -> 5,000; `avtobus 1400 so'm` -> 1,400,000; `150 ming` inside items -> 150.
- Multi-item: it writes the right shape, but is graded strictly (every item amount, category, payment). It misses on single item categories, on mixed currencies (left out of training on purpose), and sometimes does not split.
- It once invented a category (`education`). A local model needs constrained output or a check; the API enforces the list.
- Known merchants written in Korean script (넷플릭스, 스팀) came back empty.

## Caveats (read before quoting any number)
- 100 test cases: a few points either way is noise.
- About half of the category misses (both models) are debatable conventions (book, gift, gym, online course, haircut). Labels were not changed after seeing results.
- Category conventions in the training data follow my own labeling choices; the Gemini baseline prompt did not state them, so the comparison is not perfectly even.
- Some training labels may be wrong: Gemini wrote the wording, a check dropped 33 messages whose amount did not match, but nothing re-verified the rest by hand. Korean and Uzbek wording has not had a native review.
- Speed: ~3.1 s per answer on a T4 with plain Hugging Face generate vs ~1.7 s median for the API call. Not an optimized comparison; no claim about cost or speed is made.

## What I would do next (not done)
1. Date handling outside the model (let it copy the date phrase, compute the date in code).
2. Constrain output to the category list.
3. More multi-item and unit-word data, a hand check of ~200 training rows, and a native reader for ko/uz.
4. Only then consider a larger base model (3B-7B) and GGUF export.
