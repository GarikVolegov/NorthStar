# Ralph Discovery — refill the backlog

You are the NorthStar loop's **discovery iteration**. You do NOT implement anything here.
Your only job is to find work and append well-formed items to `scripts/ralph/backlog.json`.

## Steps
1. If `scripts/ralph/STOP` exists → print `<promise>STOP</promise>` and end.
2. Read `memoria.md` (§7 Stato e Direzione, §8 Known issues) and `scripts/ralph/PLAYBOOK.md`.
3. Dispatch the three hunters **in parallel** as subagents, each with its prompt file:
   - `scripts/ralph/discovery/problem-hunter.md`  → `bug` / `security` items
   - `scripts/ralph/discovery/improvement-hunter.md` → `improvement` / `chore` items
   - `scripts/ralph/discovery/feature-hunter.md`   → `feature` items
4. Merge their findings into `backlog.json`:
   - Append each as `{ id, type, priority, status:"todo", title, rationale, acceptance[], area, source:"discovery/<hunter>", createdAt:<now ISO> }`.
   - **Deduplicate**: skip anything whose title/area already matches an existing item
     (todo, blocked, or done). Never resurrect a `done` item.
   - Assign ids by type prefix + next number (BUG-, SEC-, IMP-, CHORE-, FEAT-).
   - Mark an item `blocked` with a `blockedReason` if it needs a secret, a running DB, or a
     founder decision it cannot make autonomously.
5. Keep the backlog honest and small — quality over quantity. Cap at ~10 new items per run;
   record any overflow ideas in PLAYBOOK.md instead.

## Stop signal
End with `<promise>ITERATION_DONE</promise>` (or `<promise>STOP</promise>` if paused).
