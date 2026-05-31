# NorthStar Agent Kit

This is the future distribution bundle for the project-local agent stack.

## Layers

- L1 Memory: `.claude/CLAUDE.md`
- L2 Skills: `.claude/skills/`
- L3 Hooks: `.claude/settings.json` and `.claude/hooks/`
- L4 Subagents: `.claude/agents/`
- L5 Bundle: `plugins/northstar-agent-kit/`

## Included Skills

- `agent-browser` - browser QA, screenshots, forms, app testing, and
  exploratory dogfooding through the upstream `agent-browser` CLI.
- `brain-runtime`
- `cartographer`
- `db-safety`
- `ui-quality`
- `wendy-rag`

## Install Notes

For now this plugin is documentation-only. Do not auto-copy files into global
agent directories. The repo-local `.claude/` files are the source of truth.

Before publishing a real plugin:

- Confirm hooks are safe on Windows and Unix shells.
- Confirm `agent-browser` is installed globally or usable through `npx`; do not
  add it as a workspace dependency.
- Confirm no local paths or secrets are bundled.
- Confirm Cartographer still writes only after approval.
- Add marketplace/install metadata in a separate reviewed change.
