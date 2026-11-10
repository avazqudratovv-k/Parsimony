# Fine-tuning results (Parsimony entry parser)

Task: turn one typed line (English, Korean or Uzbek) into a structured expense (date, amount, currency, category, payment, merchant, items).
Test: 100 hand-labeled cases (34 en / 33 ko / 33 uz), never used for training. Labels were frozen before any model was scored.

| | Gemini API (app prompt) | Qwen2.5-1.5B untuned | Round 1: templates | Round 2: Gemini-worded | **Round 3: + date codes, mixed items** |
|---|---|---|---|---|---|
| Fully right (all fields) | **85** | 0 | 45 | 67 | **73** |
| English / Korean / Uzbek | 91 / 85 / 79 % | 0 / 0 / 0 | 50 / 58 / 27 % | 76 / 64 / 61 % | 79 / 67 / 73 % |
| Valid JSON | 100 | 2 | 100 | 100 | 100 |
| Date | 98.9 % | 0 | 83.0 | 91.5 | 96.8 |
| Amount | 100 | 2 | 86.6 | 96.9 | 96.9 |
| Currency | 98.9 | 1 | 94.5 | 100 | 98.9 |
| Category | 93.4 | 0 | 70.3 | 81.3 | 82.4 |
| Payment method | 98.9 | 0 | 96.7 | 98.9 | 100 |
| Merchant | 95.7 | 2 | 89.4 | 97.9 | 96.8 |
| Multi-item, strict (every item exact) | 70 (7/10) | 0 | 0 | 0 | 0 (of 8) |
| Multi-item, looser: item amounts + payments right, category ignored (read by hand from the printed answers) | not measured | - | - | - | 5 of 8 |

Setup: LoRA r=16 on all attention + MLP projections, lr 2e-4, 2 epochs, fp16, one free Colab T4.
Round 3 trained on 6,369 rows (5,905 Gemini-worded + 800 template rows, 5% held back to watch validation loss), ~25 minutes; final validation loss 0.022. Median 2.7 s per answer on the T4 with plain Hugging Face generate.

## What each round changed
- Round 1: my own templates. Training loss ~0.001 (it memorized the templates); test score 45.
- Round 2: every label decided in code, Gemini writes only the wording (typos, 4만8천원, 85 ming, multi-item, non-expenses). Test 67.
- Round 3: (a) the model no longer does date arithmetic. It copies the phrase into a code (`0`, `-3`, `d5`, `fri`) and plain code (`prompt.resolve_when`) computes the date; categories outside the list become `other` (`prompt.finalize`). (b) mixed-currency items, realistic Uzbek prices, 120 more Gemini calls. Test 73. Date accuracy 91.5 -> 96.8 partly comes from moving that step into code, which is a design choice, not extra model skill.
- Gemini is still better on this test, so the app keeps using Gemini.

## Where the small model is still weak
- Multi-item: it now writes a correct item list in 6 of 8 cases, but every one still has one wrong detail (a wallet or laptop tagged `other`, a missing item currency) or does not split at all (milk + shampoo at one shop), or reads `150 ming` inside items as 150.
- Category in general (82 %): about half of the misses are debatable conventions (book, gift, gym, online course, haircut); the rest are real (rent as travel, gas as bills).
- Known merchants written in Korean script came back empty in an earlier round.

## Caveats (read before quoting any number)
- 100 test cases: a few points either way is noise.
- Labels were not changed after seeing results. The "looser multi-item" line was added after seeing the answers and is only a description of them, not a replacement for the strict score.
- Category conventions in the training data follow my own labeling choices; the Gemini baseline prompt did not state them, so the comparison is not perfectly even.
- Training labels were decided in code, but Gemini wrote the wording; a check dropped 95 messages whose written amount did not match, and nothing re-verified the rest by hand. Korean and Uzbek wording has not had a native review.
- Speed: ~2.7 s per answer on a T4 with unoptimized generate vs ~1.7 s median for the API call. No claim about cost or speed is made.

## What I would do next (not done)
1. Teach item categories better (more multi-item rows with common objects such as wallet, laptop, bag) and the `ming` unit inside items.
2. A hand check of ~200 training rows and a native reader for ko/uz.
3. A larger base model (3B-7B, 4-bit) and GGUF export, then a fair speed and cost test.
