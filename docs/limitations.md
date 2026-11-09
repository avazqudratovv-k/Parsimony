# Limitations (honest list)

Kept up to date as the project grows. Items marked (planned) don't exist yet.

- Demo project, not a finance product. Don't upload real receipts; demo accounts are deleted after about 7 days.
- Demo accounts are shared-nothing sandboxes: they expire after 7 days, hold at most 100 entries and 10 AI entries a day.
- Single currency per entry; no conversion. Monthly charts are grouped by currency.
- Model confidence is self-reported by the model and is not calibrated.
- Auth rate limiting is in memory and per process (fine for one backend process).
- (planned) Fine-tuned model: self-study project. Training data is mostly synthetic. Results are reported
  only on a separate hand-labeled test set and don't claim general accuracy.
- (planned) Receipt reading depends on photo quality; Tesseract is only a free baseline.
- (planned) Voice accuracy depends on accent, noise and the speech model used.
