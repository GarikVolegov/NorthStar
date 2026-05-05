#!/bin/bash
set -e

echo "▶ [post-merge] Installazione dipendenze Node.js..."
pnpm install --frozen-lockfile

echo "▶ [post-merge] Installazione dipendenze Python (AI service)..."
pip install -q -r artifacts/ai-agents/requirements.txt

echo "▶ [post-merge] Applicazione schema database..."
pnpm --filter @workspace/db push

echo "✓ [post-merge] Completato."
