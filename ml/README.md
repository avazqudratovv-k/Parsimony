# ml/

Tier 3 work: synthetic data, LoRA fine-tuning, GGUF export and the evaluation script. The test set and the scorer exist; training does not yet.

Planned layout:
- `data/`: synthetic training generator, the hand-labeled test set (100-200 entries, versioned, never trained on)
- `train/`: LoRA notebook (Hugging Face Transformers + PEFT + TRL), run on free Colab/Kaggle GPUs
- `eval/`: `run_eval.py`, which compares base vs fine-tuned vs API model on accuracy, latency and cost
- `export/`: GGUF conversion and quantization notes

Rules: no real receipts or personal data in any dataset; report held-out test results only.

## Where we are
1. Done: `data/build_test_set.py` writes `data/test.jsonl` (100 invented sentences: 34 English, 33 Korean, 33 Uzbek, labels checked by the script). Edit labels in the script, never the .jsonl. Korean and Uzbek wording and labels still need a native reader.
2. Done: `eval/score.py` grades any predictions file (`python ml/eval/score.py preds.jsonl`) per field and per language. `--self-test` checks the scorer itself.
3. Done (written, not yet run): `eval/run_gemini.py` runs the 100 test cases through Gemini with the app's real prompt. Run it on your machine with your key, then `python ml/eval/score.py ml/eval/preds_gemini.jsonl`.
4. Done: `data/build_train_set.py` makes `data/train.jsonl` (3,000 template sentences, 1,000 per language, labels correct by construction, refuses any sentence that is in the test set). `prompt.py` is the short prompt shared by training and evaluation.
5. Done (written, not yet run): `train/train_lora.ipynb` scores the untuned Qwen2.5-1.5B-Instruct, trains LoRA, scores the tuned model on the same 100 cases. Zip `prompt.py data eval` as `ml.zip` and upload it to Colab (T4 GPU).
6. Next: run 3 and 5, put the three reports side by side (Gemini, base, tuned), then decide what is honest to claim.

Known limits: the training sentences are templates, so they are cleaner than real typing; the small model does not produce confidence/uncertain/items-from-prose yet; Korean and Uzbek templates need a native reader.
