---
description: Run the NorthStar autonomous loop LIVE in this session — watch each iteration, with a checkpoint between cycles. Continuous until STOP / max-iter / no work.
argument-hint: [max-iterations]
---

Drive the interactive autonomous loop by following, to the letter, the protocol in
`scripts/ralph/loop-interactive.prompt.md`. Max iterations: `$1` if provided, else the
`maxIterations` from `scripts/ralph/loop.config.json`. Honor the kill-switch
(`scripts/ralph/STOP`) and the rollout `mode`. Each cycle reuses the per-iteration brain
in `scripts/ralph/iterate.prompt.md`; print the checkpoint via
`node scripts/ralph/ralph-cli.mjs checkpoint ...` between cycles.
