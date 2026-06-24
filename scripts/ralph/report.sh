#!/bin/bash
# Ralph morning report — read-only summary of the loop's overnight work.
# Usage: bash scripts/ralph/report.sh   (or: pnpm ralph:report)
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

bar() { printf '\n========== %s ==========\n' "$1"; }

bar "STATUS"
node scripts/ralph/ralph-cli.mjs status

bar "JOURNAL (latest day)"
latest="$(ls -1t scripts/ralph/journal/*.md 2>/dev/null | head -1 || true)"
if [ -n "${latest:-}" ]; then echo "($latest)"; echo; cat "$latest"; else echo "(no journal entries yet)"; fi

bar "LOOP COMMITS (last 10)"
git log --oneline -10

bar "PUSHED BRANCHES / OPEN PRs"
echo "current branch: $(git branch --show-current)"
if command -v gh >/dev/null 2>&1; then
  gh pr list --state open 2>/dev/null || echo "(gh present but listing failed / not authenticated)"
else
  echo "(gh absent — open PRs manually). Local branches ahead of origin/main:"
  git for-each-ref --format='%(refname:short)' refs/heads | while read -r b; do
    ahead="$(git rev-list --count origin/main.."$b" 2>/dev/null || echo 0)"
    [ "$ahead" -gt 0 ] && echo "  $b (+$ahead commits vs main)"
  done
fi

bar "UNCOMMITTED CHANGES"
git status --short || echo "(clean)"

bar "KILL-SWITCH"
if [ -f scripts/ralph/STOP ]; then echo "STOP present — loop is paused/stopped"; else echo "STOP absent — loop may run"; fi
echo
