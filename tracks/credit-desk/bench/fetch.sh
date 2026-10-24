#!/usr/bin/env bash
# Downloads the DABstep slice into data/: the 10 dev questions with their answers, the six context files, and the
# benchmark's own scorer (kept only to cross-check scorer.ts). Pinned revisions, checked against SHA256SUMS.
# DABstep (Adyen and Hugging Face), CC BY 4.0: https://huggingface.co/datasets/adyen/DABstep
set -euo pipefail
cd "$(dirname "$0")"
DATASET=0545553f02cedc323dee8658af62555852bc3b24   # adyen/DABstep, dataset repo, 2026-10-22
SPACE=d4431c2e4a695cbe43c33aab2adaa304a37ae64a     # adyen/DABstep, leaderboard Space (holds the scorer)
d=https://huggingface.co/datasets/adyen/DABstep/resolve/$DATASET
mkdir -p data/context
curl -fsSL "$d/data/tasks/dev.jsonl" -o data/dev.jsonl
for f in payments.csv fees.json manual.md merchant_data.json merchant_category_codes.csv acquirer_countries.csv payments-readme.md; do
  curl -fsSL "$d/data/context/$f" -o "data/context/$f"
done
curl -fsSL "https://huggingface.co/spaces/adyen/DABstep/resolve/$SPACE/dabstep_benchmark/evaluation/scorer.py" -o data/scorer.py
sha256sum -c SHA256SUMS
