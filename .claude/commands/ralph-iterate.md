---
description: Run exactly one iteration of the NorthStar autonomous loop (reads the deterministic backlog + objective gates).
---

Execute one loop cycle by following, to the letter, the protocol in
`scripts/ralph/iterate.prompt.md`. Use the deterministic CLI for selection and the
integration decision (`node scripts/ralph/ralph-cli.mjs next` / `decide`). Honor the
kill-switch (`scripts/ralph/STOP`) and the rollout mode in `scripts/ralph/loop.config.json`.
