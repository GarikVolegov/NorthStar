---
name: agent-browser
description: Use when browser QA, screenshots, form filling, navigation, app testing, exploratory testing, light scraping, dashboard dogfooding, or web automation is needed.
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*)
---

# Agent Browser

Use `agent-browser` for browser automation tasks that need real navigation,
screenshots, forms, QA, app testing, or exploratory browser work.

## Start Here

Load the version-matched upstream workflow before running browser commands:

```bash
agent-browser skills get core
```

If the CLI is not installed globally, use `npx` for commands:

```bash
npx agent-browser --help
npx agent-browser skills get core
```

Use the full reference only when command details are needed:

```bash
agent-browser skills get core --full
```

## Specialized Upstream Skills

Load a specialized upstream skill when the task calls for it:

| Task | Command |
|---|---|
| Exploratory QA, dogfooding, bug hunts | `agent-browser skills get dogfood` |
| Electron apps such as VS Code, Slack, Discord, Figma, Notion | `agent-browser skills get electron` |
| Slack workspace automation | `agent-browser skills get slack` |
| Vercel Sandbox browser automation | `agent-browser skills get vercel-sandbox` |
| AWS Bedrock AgentCore cloud browsers | `agent-browser skills get agentcore` |

Run `agent-browser skills list` to discover skills available in the installed
version.

## NorthStar Rules

- Prefer accessibility snapshots and element refs like `@eN` over brittle CSS
  selectors when interacting with pages.
- Do not save browser auth state, profiles, traces, screenshots, or session
  files into tracked repo paths.
- Do not read `.env` or use real credentials unless the user explicitly
  provides consent for that session.
- Do not use personal profiles or real user accounts for destructive actions.
- Do not submit payments, delete records, publish content, or mutate production
  data without explicit approval.
- Use `.agents/skills/browser-use` as the fallback when `agent-browser` is not
  available or the request specifically needs that existing toolchain.

## Typical Flow

```bash
agent-browser skills get core
agent-browser open http://localhost:5173
agent-browser snapshot
agent-browser click @e1
agent-browser screenshot tmp/agent-browser-check.png
agent-browser close
```

Keep outputs in ignored local folders such as `tmp/` or `.agent-browser/`.
