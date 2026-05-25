---
name: pp-northstar
description: "Printing Press CLI for Northstar. Orientamento SaaS API"
author: "Garik V."
license: "Apache-2.0"
argument-hint: "<command> [args] | install cli|mcp"
allowed-tools: "Read Bash"
metadata:
  openclaw:
    requires:
      bins:
        - northstar-pp-cli
---

# Northstar — Printing Press CLI

## Prerequisites: Install the CLI

This skill drives the `northstar-pp-cli` binary. **You must verify the CLI is installed before invoking any command from this skill.** If it is missing, install it first:

1. Install via the Printing Press installer:
   ```bash
   npx -y @mvanhorn/printing-press install northstar --cli-only
   ```
2. Verify: `northstar-pp-cli --version`
3. Ensure `$GOPATH/bin` (or `$HOME/go/bin`) is on `$PATH`.

If the `npx` install fails before this CLI has a public-library category, install Node or use the category-specific Go fallback after publish.

If `--version` reports "command not found" after install, the install step did not put the binary on `$PATH`. Do not proceed with skill commands until verification succeeds.

Orientamento SaaS API

## Command Reference

**calendar** — Calendar events and reminders

- `northstar-pp-cli calendar add-event-reminder` — Add a reminder to an event
- `northstar-pp-cli calendar create-event` — Create a new calendar event
- `northstar-pp-cli calendar delete-event` — Delete an event (must own it)
- `northstar-pp-cli calendar delete-event-reminder` — Delete a reminder
- `northstar-pp-cli calendar get-event` — Get a single event (must own it)
- `northstar-pp-cli calendar get-quota` — Get the authenticated user's plan quota and event count
- `northstar-pp-cli calendar get-upcoming-events` — Get upcoming events for the authenticated user
- `northstar-pp-cli calendar list-events` — List events for the authenticated user within a date range
- `northstar-pp-cli calendar update-event` — Update an event (must own it)
- `northstar-pp-cli calendar update-event-reminder` — Update a reminder

**healthz** — Manage healthz

- `northstar-pp-cli healthz` — Health check

**notifications** — In-app notifications

- `northstar-pp-cli notifications list` — List in-app notifications for the authenticated user
- `northstar-pp-cli notifications mark-all-read` — Mark all notifications as read for the authenticated user

**push** — Browser push notification subscriptions

- `northstar-pp-cli push subscribe` — Register a browser push subscription for the authenticated user
- `northstar-pp-cli push unsubscribe` — Remove a browser push subscription for the authenticated user

**roles** — Manage roles

- `northstar-pp-cli roles <id>` — Get full details for a single role including linked education paths

**sectors** — Sector and career data

- `northstar-pp-cli sectors get` — Get sector details
- `northstar-pp-cli sectors list` — List all sectors

**stats** — Manage stats

- `northstar-pp-cli stats` — Get platform stats summary

**test-sessions** — Manage test sessions

- `northstar-pp-cli test-sessions get` — Get a test session result
- `northstar-pp-cli test-sessions submit-test` — Submit personality test and get recommendations

**users** — User registration

- `northstar-pp-cli users` — Register a user to save test results


### Finding the right command

When you know what you want to do but not which command does it, ask the CLI directly:

```bash
northstar-pp-cli which "<capability in your own words>"
```

`which` resolves a natural-language capability query to the best matching command from this CLI's curated feature index. Exit code `0` means at least one match; exit code `2` means no confident match — fall back to `--help` or use a narrower query.

## Auth Setup

Run `northstar-pp-cli auth setup` for the URL and steps to obtain a token (add `--launch` to open the URL). Then store it:

```bash
northstar-pp-cli auth set-token YOUR_TOKEN_HERE
```

Or set `API_BEARER_AUTH` as an environment variable.

Run `northstar-pp-cli doctor` to verify setup.

## Agent Mode

Add `--agent` to any command. Expands to: `--json --compact --no-input --no-color --yes`.

- **Pipeable** — JSON on stdout, errors on stderr
- **Filterable** — `--select` keeps a subset of fields. Dotted paths descend into nested structures; arrays traverse element-wise. Critical for keeping context small on verbose APIs:

  ```bash
  northstar-pp-cli notifications list --agent --select id,name,status
  ```
- **Previewable** — `--dry-run` shows the request without sending
- **Offline-friendly** — sync/search commands can use the local SQLite store when available
- **Non-interactive** — never prompts, every input is a flag
- **Explicit retries** — use `--idempotent` only when an already-existing create should count as success, and `--ignore-missing` only when a missing delete target should count as success

### Response envelope

Commands that read from the local store or the API wrap output in a provenance envelope:

```json
{
  "meta": {"source": "live" | "local", "synced_at": "...", "reason": "..."},
  "results": <data>
}
```

Parse `.results` for data and `.meta.source` to know whether it's live or local. A human-readable `N results (live)` summary is printed to stderr only when stdout is a terminal AND no machine-format flag (`--json`, `--csv`, `--compact`, `--quiet`, `--plain`, `--select`) is set — piped/agent consumers and explicit-format runs get pure JSON on stdout.

## Agent Feedback

When you (or the agent) notice something off about this CLI, record it:

```
northstar-pp-cli feedback "the --since flag is inclusive but docs say exclusive"
northstar-pp-cli feedback --stdin < notes.txt
northstar-pp-cli feedback list --json --limit 10
```

Entries are stored locally at `~/.northstar-pp-cli/feedback.jsonl`. They are never POSTed unless `NORTHSTAR_FEEDBACK_ENDPOINT` is set AND either `--send` is passed or `NORTHSTAR_FEEDBACK_AUTO_SEND=true`. Default behavior is local-only.

Write what *surprised* you, not a bug report. Short, specific, one line: that is the part that compounds.

## Output Delivery

Every command accepts `--deliver <sink>`. The output goes to the named sink in addition to (or instead of) stdout, so agents can route command results without hand-piping. Three sinks are supported:

| Sink | Effect |
|------|--------|
| `stdout` | Default; write to stdout only |
| `file:<path>` | Atomically write output to `<path>` (tmp + rename) |
| `webhook:<url>` | POST the output body to the URL (`application/json` or `application/x-ndjson` when `--compact`) |

Unknown schemes are refused with a structured error naming the supported set. Webhook failures return non-zero and log the URL + HTTP status on stderr.

## Named Profiles

A profile is a saved set of flag values, reused across invocations. Use it when a scheduled agent calls the same command every run with the same configuration - HeyGen's "Beacon" pattern.

```
northstar-pp-cli profile save briefing --json
northstar-pp-cli --profile briefing notifications list
northstar-pp-cli profile list --json
northstar-pp-cli profile show briefing
northstar-pp-cli profile delete briefing --yes
```

Explicit flags always win over profile values; profile values win over defaults. `agent-context` lists all available profiles under `available_profiles` so introspecting agents discover them at runtime.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Usage error (wrong arguments) |
| 3 | Resource not found |
| 4 | Authentication required |
| 5 | API error (upstream issue) |
| 7 | Rate limited (wait and retry) |
| 10 | Config error |

## Argument Parsing

Parse `$ARGUMENTS`:

1. **Empty, `help`, or `--help`** → show `northstar-pp-cli --help` output
2. **Starts with `install`** → ends with `mcp` → MCP installation; otherwise → see Prerequisites above
3. **Anything else** → Direct Use (execute as CLI command with `--agent`)

## MCP Server Installation

Install the MCP binary from this CLI's published public-library entry or pre-built release, then register it:

```bash
claude mcp add northstar-pp-mcp -- northstar-pp-mcp
```

Verify: `claude mcp list`

## Direct Use

1. Check if installed: `which northstar-pp-cli`
   If not found, offer to install (see Prerequisites at the top of this skill).
2. Match the user query to the best command from the Unique Capabilities and Command Reference above.
3. Execute with the `--agent` flag:
   ```bash
   northstar-pp-cli <command> [subcommand] [args] --agent
   ```
4. If ambiguous, drill into subcommand help: `northstar-pp-cli <command> --help`.
