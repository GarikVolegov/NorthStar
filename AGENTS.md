# NorthStar Agent Entry Point

This is the only root-level AI context file. Claude, Codex, Gemini, OpenCode
and any other agent must start here and then use the canonical Brain context.

1. Read `.brain/40_Agent_Context/AGENT_CONTEXT.md`.
2. Read `.brain/_ROOT_MOC.md`.
3. Read the relevant file in `.brain/40_Agent_Context/rules/` before editing.
4. Follow `docs/REPOSITORY_STRUCTURE.md` for file placement.

Do not create tool-specific root files such as `CLAUDE.md`, `CODEX.md`, or
`GEMINI.md`. Do not duplicate canonical agent instructions outside the Brain.
Keep the shared context inside `.brain/40_Agent_Context/`.
