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
3. Next: get the Gemini baseline number on the test set, then generate training data (a different generator, never sharing a sentence with the test set), then LoRA training.
