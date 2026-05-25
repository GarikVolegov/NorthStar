# Northstar CLI

Orientamento SaaS API

## Install

The recommended path installs both the `northstar-pp-cli` binary and the `pp-northstar` agent skill in one shot:

```bash
npx -y @mvanhorn/printing-press install northstar
```

For CLI only (no skill):

```bash
npx -y @mvanhorn/printing-press install northstar --cli-only
```


### Without Node

The generated install path is category-agnostic until this CLI is published. If `npx` is not available before publish, install Node or use the category-specific Go fallback from the public-library entry after publish.

### Pre-built binary

Download a pre-built binary for your platform from the [latest release](https://github.com/mvanhorn/printing-press-library/releases/tag/northstar-current). On macOS, clear the Gatekeeper quarantine: `xattr -d com.apple.quarantine <binary>`. On Unix, mark it executable: `chmod +x <binary>`.

<!-- pp-hermes-install-anchor -->
## Install for Hermes

From the Hermes CLI:

```bash
hermes skills install mvanhorn/printing-press-library/cli-skills/pp-northstar --force
```

Inside a Hermes chat session:

```bash
/skills install mvanhorn/printing-press-library/cli-skills/pp-northstar --force
```

## Install for OpenClaw

Tell your OpenClaw agent (copy this):

```
Install the pp-northstar skill from https://github.com/mvanhorn/printing-press-library/tree/main/cli-skills/pp-northstar. The skill defines how its required CLI can be installed.
```

## Quick Start

### 1. Install

See [Install](#install) above.

### 2. Set Up Credentials

Get your access token from your API provider's developer portal, then store it:

```bash
northstar-pp-cli auth set-token YOUR_TOKEN_HERE
```

Or set it via environment variable:

```bash
export API_BEARER_AUTH="your-token-here"
```

### 3. Verify Setup

```bash
northstar-pp-cli doctor
```

This checks your configuration and credentials.

### 4. Try Your First Command

```bash
northstar-pp-cli notifications list
```

## Usage

Run `northstar-pp-cli --help` for the full command reference and flag list.

## Commands

### calendar

Calendar events and reminders

- **`northstar-pp-cli calendar add-event-reminder`** - Add a reminder to an event
- **`northstar-pp-cli calendar create-event`** - Create a new calendar event
- **`northstar-pp-cli calendar delete-event`** - Delete an event (must own it)
- **`northstar-pp-cli calendar delete-event-reminder`** - Delete a reminder
- **`northstar-pp-cli calendar get-event`** - Get a single event (must own it)
- **`northstar-pp-cli calendar get-quota`** - Get the authenticated user's plan quota and event count
- **`northstar-pp-cli calendar get-upcoming-events`** - Get upcoming events for the authenticated user
- **`northstar-pp-cli calendar list-events`** - List events for the authenticated user within a date range
- **`northstar-pp-cli calendar update-event`** - Update an event (must own it)
- **`northstar-pp-cli calendar update-event-reminder`** - Update a reminder

### healthz

Manage healthz

- **`northstar-pp-cli healthz health-check`** - Health check

### notifications

In-app notifications

- **`northstar-pp-cli notifications list`** - List in-app notifications for the authenticated user
- **`northstar-pp-cli notifications mark-all-read`** - Mark all notifications as read for the authenticated user

### push

Browser push notification subscriptions

- **`northstar-pp-cli push subscribe`** - Register a browser push subscription for the authenticated user
- **`northstar-pp-cli push unsubscribe`** - Remove a browser push subscription for the authenticated user

### roles

Manage roles

- **`northstar-pp-cli roles get-detail`** - Get full details for a single role including linked education paths

### sectors

Sector and career data

- **`northstar-pp-cli sectors get`** - Get sector details
- **`northstar-pp-cli sectors list`** - List all sectors

### stats

Manage stats

- **`northstar-pp-cli stats get-summary`** - Get platform stats summary

### test-sessions

Manage test sessions

- **`northstar-pp-cli test-sessions get`** - Get a test session result
- **`northstar-pp-cli test-sessions submit-test`** - Submit personality test and get recommendations

### users

User registration

- **`northstar-pp-cli users register`** - Register a user to save test results


## Output Formats

```bash
# Human-readable table (default in terminal, JSON when piped)
northstar-pp-cli notifications list

# JSON for scripting and agents
northstar-pp-cli notifications list --json

# Filter to specific fields
northstar-pp-cli notifications list --json --select id,name,status

# Dry run — show the request without sending
northstar-pp-cli notifications list --dry-run

# Agent mode — JSON + compact + no prompts in one flag
northstar-pp-cli notifications list --agent
```

## Agent Usage

This CLI is designed for AI agent consumption:

- **Non-interactive** - never prompts, every input is a flag
- **Pipeable** - `--json` output to stdout, errors to stderr
- **Filterable** - `--select id,name` returns only fields you need
- **Previewable** - `--dry-run` shows the request without sending
- **Explicit retries** - add `--idempotent` to create retries and `--ignore-missing` to delete retries when a no-op success is acceptable
- **Confirmable** - `--yes` for explicit confirmation of destructive actions
- **Piped input** - write commands can accept structured input when their help lists `--stdin`
- **Offline-friendly** - sync/search commands can use the local SQLite store when available
- **Agent-safe by default** - no colors or formatting unless `--human-friendly` is set

Exit codes: `0` success, `2` usage error, `3` not found, `4` auth error, `5` API error, `7` rate limited, `10` config error.

## Use with Claude Code

Install the focused skill — it auto-installs the CLI on first invocation:

```bash
npx skills add mvanhorn/printing-press-library/cli-skills/pp-northstar -g
```

Then invoke `/pp-northstar <query>` in Claude Code. The skill is the most efficient path — Claude Code drives the CLI directly without an MCP server in the middle.

<details>
<summary>Use as an MCP server in Claude Code (advanced)</summary>

If you'd rather register this CLI as an MCP server in Claude Code, install the MCP binary first:


Install the MCP binary from this CLI's published public-library entry or pre-built release.

Then register it:

```bash
claude mcp add northstar northstar-pp-mcp -e API_BEARER_AUTH=<your-token>
```

</details>

## Use with Claude Desktop

This CLI ships an [MCPB](https://github.com/modelcontextprotocol/mcpb) bundle — Claude Desktop's standard format for one-click MCP extension installs (no JSON config required).

To install:

1. Download the `.mcpb` for your platform from the [latest release](https://github.com/mvanhorn/printing-press-library/releases/tag/northstar-current).
2. Double-click the `.mcpb` file. Claude Desktop opens and walks you through the install.
3. Fill in `API_BEARER_AUTH` when Claude Desktop prompts you.

Requires Claude Desktop 1.0.0 or later. Pre-built bundles ship for macOS Apple Silicon (`darwin-arm64`) and Windows (`amd64`, `arm64`); for other platforms, use the manual config below.

<details>
<summary>Manual JSON config (advanced)</summary>

If you can't use the MCPB bundle (older Claude Desktop, unsupported platform), install the MCP binary and configure it manually.


Install the MCP binary from this CLI's published public-library entry or pre-built release.

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "northstar": {
      "command": "northstar-pp-mcp",
      "env": {
        "API_BEARER_AUTH": "<your-key>"
      }
    }
  }
}
```

</details>

## Health Check

```bash
northstar-pp-cli doctor
```

Verifies configuration, credentials, and connectivity to the API.

## Configuration

Config file: `~/.config/api-pp-cli/config.toml`

Static request headers can be configured under `headers`; per-command header overrides take precedence.

Environment variables:

| Name | Kind | Required | Description |
| --- | --- | --- | --- |
| `API_BEARER_AUTH` | per_call | Yes | Set to your API credential. |

## Troubleshooting
**Authentication errors (exit code 4)**
- Run `northstar-pp-cli doctor` to check credentials
- Verify the environment variable is set: `echo $API_BEARER_AUTH`
**Not found errors (exit code 3)**
- Check the resource ID is correct
- Run the `list` command to see available items

---

Generated by [CLI Printing Press](https://github.com/mvanhorn/cli-printing-press)
