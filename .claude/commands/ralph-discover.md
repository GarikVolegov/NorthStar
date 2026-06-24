---
description: Run a discovery iteration — find new problems/improvements/features and refill the backlog (no implementation).
---

Follow `scripts/ralph/discover.prompt.md`: dispatch the three hunters
(`scripts/ralph/discovery/{problem,improvement,feature}-hunter.md`) in parallel, then merge
their findings into `scripts/ralph/backlog.json` (deduplicated, ids by type, blocked items
flagged with a reason). Do not implement anything in this command.
