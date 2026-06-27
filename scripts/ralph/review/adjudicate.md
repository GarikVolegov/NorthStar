# Loop review — adjudication & fix-loop

After the panel's reviewers return, you (the iteration agent — you are the implementer) adjudicate:

1. **Aggregate** all findings across reviewers by severity.
2. **Minor** → record them in the journal `review` field (and, with dedup, you MAY file P3 backlog
   items). They do NOT block.
3. **Critical / Important** → fix them yourself, inline:
   - make the minimal fix,
   - re-run the gate (`pnpm qa` or the direct-binary workaround) — it MUST stay green,
   - re-commit (amend the work commit, or add a focused fix commit),
   - re-dispatch ONLY the reviewers that flagged, on the new diff.
4. **Cap = 2 rounds.** If you believe a finding is a false positive, write a short justification; if
   the reviewer re-flags it after your justification, it counts as **UNRESOLVED**.
5. **reviewResult** = `red` if any Critical/Important remains after the cap, else `green`.
6. Pass it to the decision: `node scripts/ralph/ralph-cli.mjs decide --gate <green|red> --review <green|red>`.
   - `--review red` → `decide` returns `hold`: end the iteration **BLOCKED**, file a **P1 bug** that
     captures the unresolved findings (id `BUG-…`, area = the item's area), keep the work on the
     branch (no push / PR / merge).
