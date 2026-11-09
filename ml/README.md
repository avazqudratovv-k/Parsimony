# ml/

Tier 3 work: synthetic data, LoRA fine-tuning, GGUF export and the evaluation script. Nothing here yet.

Planned layout:
- `data/`: synthetic training generator, the hand-labeled test set (100-200 entries, versioned, never trained on)
- `train/`: LoRA notebook (Hugging Face Transformers + PEFT + TRL), run on free Colab/Kaggle GPUs
- `eval/`: `run_eval.py`, which compares base vs fine-tuned vs API model on accuracy, latency and cost
- `export/`: GGUF conversion and quantization notes

Rules: no real receipts or personal data in any dataset; report held-out test results only.
