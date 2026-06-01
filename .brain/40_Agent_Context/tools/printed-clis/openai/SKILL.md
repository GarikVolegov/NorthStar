---
name: pp-openai
description: "Printing Press CLI for Openai. The OpenAI REST API. Please see https://platform.openai.com/docs/api-reference for more details."
author: "Garik V."
license: "Apache-2.0"
argument-hint: "<command> [args] | install cli|mcp"
allowed-tools: "Read Bash"
metadata:
  openclaw:
    requires:
      bins:
        - openai-pp-cli
---

# Openai — Printing Press CLI

## Prerequisites: Install the CLI

This skill drives the `openai-pp-cli` binary. **You must verify the CLI is installed before invoking any command from this skill.** If it is missing, install it first:

1. Install via the Printing Press installer:
   ```bash
   npx -y @mvanhorn/printing-press install openai --cli-only
   ```
2. Verify: `openai-pp-cli --version`
3. Ensure `$GOPATH/bin` (or `$HOME/go/bin`) is on `$PATH`.

If the `npx` install fails before this CLI has a public-library category, install Node or use the category-specific Go fallback after publish.

If `--version` reports "command not found" after install, the install step did not put the binary on `$PATH`. Do not proceed with skill commands until verification succeeds.

The OpenAI REST API. Please see https://platform.openai.com/docs/api-reference for more details.

## Command Reference

**assistants** — Build Assistants that can call models and use tools.

- `openai-pp-cli assistants create` — Create an assistant with a model and instructions.
- `openai-pp-cli assistants delete` — Delete an assistant.
- `openai-pp-cli assistants get` — Retrieves an assistant.
- `openai-pp-cli assistants list` — Returns a list of assistants.
- `openai-pp-cli assistants modify` — Modifies an assistant.

**audio** — Turn audio into text or text into audio.

- `openai-pp-cli audio create-speech` — Generates audio from the input text. Returns the audio file content, or a stream of audio events.
- `openai-pp-cli audio create-transcription` — Transcribes audio into the input language. Returns a transcription object in `json`, `diarized_json`, or...
- `openai-pp-cli audio create-translation` — Translates audio into English.
- `openai-pp-cli audio create-voice` — Create a custom voice you can use for audio output (for example, in Text-to-Speech and the Realtime API). This...
- `openai-pp-cli audio create-voice-consent` — Upload a consent recording that authorizes creation of a custom voice. See the [custom voices...
- `openai-pp-cli audio delete-voice-consent` — Delete a consent recording that was uploaded for creating custom voices. See the [custom voices...
- `openai-pp-cli audio get-voice-consent` — Retrieve consent recording metadata used for creating custom voices. See the [custom voices...
- `openai-pp-cli audio list-voice-consents` — List consent recordings available to your organization for creating custom voices. See the [custom voices...
- `openai-pp-cli audio update-voice-consent` — Update consent recording metadata used for creating custom voices. This endpoint updates metadata only and does not...

**batches** — Manage batches

- `openai-pp-cli batches create-batch` — Creates and executes a batch from an uploaded file of requests
- `openai-pp-cli batches list` — List your organization's batches.
- `openai-pp-cli batches retrieve-batch` — Retrieves a batch.

**chat** — Given a list of messages comprising a conversation, the model will return a response.

- `openai-pp-cli chat create-completion` — **Starting a new project?** We recommend trying [Responses](/docs/api-reference/responses) to take advantage of the...
- `openai-pp-cli chat delete-completion` — Delete a stored chat completion. Only Chat Completions that have been created with the `store` parameter set to...
- `openai-pp-cli chat get-completion` — Get a stored chat completion. Only Chat Completions that have been created with the `store` parameter set to `true`...
- `openai-pp-cli chat get-completion-messages` — Get the messages in a stored chat completion. Only Chat Completions that have been created with the `store`...
- `openai-pp-cli chat list-completions` — List stored Chat Completions. Only Chat Completions that have been stored with the `store` parameter set to `true`...
- `openai-pp-cli chat update-completion` — Modify a stored chat completion. Only Chat Completions that have been created with the `store` parameter set to...

**chatkit** — Manage chatkit

- `openai-pp-cli chatkit cancel-chat-session-method` — Cancel an active ChatKit session and return its most recent metadata. Cancelling prevents new requests from using...
- `openai-pp-cli chatkit create-chat-session-method` — Create a ChatKit session.
- `openai-pp-cli chatkit delete-thread-method` — Delete a ChatKit thread along with its items and stored attachments.
- `openai-pp-cli chatkit get-thread-method` — Retrieve a ChatKit thread by its identifier.
- `openai-pp-cli chatkit list-thread-items-method` — List items that belong to a ChatKit thread.
- `openai-pp-cli chatkit list-threads-method` — List ChatKit threads with optional pagination and user filters.

**completions** — Given a prompt, the model will return one or more predicted completions, and can also return the probabilities of alternative tokens at each position.

- `openai-pp-cli completions` — Creates a completion for the provided prompt and parameters. Returns a completion object, or a sequence of...

**containers** — Manage containers

- `openai-pp-cli containers create` — Creates a container.
- `openai-pp-cli containers delete` — Delete a container.
- `openai-pp-cli containers list` — Lists containers.
- `openai-pp-cli containers retrieve` — Retrieves a container.

**conversations** — Manage conversations and conversation items.

- `openai-pp-cli conversations create` — Create a conversation.
- `openai-pp-cli conversations delete` — Delete a conversation. Items in the conversation will not be deleted.
- `openai-pp-cli conversations get` — Get a conversation
- `openai-pp-cli conversations update` — Update a conversation

**embeddings** — Get a vector representation of a given input that can be easily consumed by machine learning models and algorithms.

- `openai-pp-cli embeddings` — Creates an embedding vector representing the input text.

**evals** — Manage and run evals in the OpenAI platform.

- `openai-pp-cli evals create` — Create the structure of an evaluation that can be used to test a model's performance. An evaluation is a set of...
- `openai-pp-cli evals delete` — Delete an evaluation.
- `openai-pp-cli evals get` — Get an evaluation by ID.
- `openai-pp-cli evals list` — List evaluations for a project.
- `openai-pp-cli evals update` — Update certain properties of an evaluation.

**files** — Files are used to upload documents that can be used with features like Assistants and Fine-tuning.

- `openai-pp-cli files create` — Upload a file that can be used across various endpoints. Individual files can be up to 512 MB, and each project can...
- `openai-pp-cli files delete` — Delete a file and remove it from all vector stores.
- `openai-pp-cli files list` — Returns a list of files.
- `openai-pp-cli files retrieve` — Returns information about a specific file.

**fine-tuning** — Manage fine-tuning jobs to tailor a model to your specific training data.

- `openai-pp-cli fine-tuning cancel-job` — Immediately cancel a fine-tune job.
- `openai-pp-cli fine-tuning create-checkpoint-permission` — **NOTE:** Calling this endpoint requires an [admin API key](../admin-api-keys). This enables organization owners to...
- `openai-pp-cli fine-tuning create-job` — Creates a fine-tuning job which begins the process of creating a new model from a given dataset. Response includes...
- `openai-pp-cli fine-tuning delete-checkpoint-permission` — **NOTE:** This endpoint requires an [admin API key](../admin-api-keys). Organization owners can use this endpoint to...
- `openai-pp-cli fine-tuning list-checkpoint-permissions` — **NOTE:** This endpoint requires an [admin API key](../admin-api-keys). Organization owners can use this endpoint to...
- `openai-pp-cli fine-tuning list-events` — Get status updates for a fine-tuning job.
- `openai-pp-cli fine-tuning list-job-checkpoints` — List checkpoints for a fine-tuning job.
- `openai-pp-cli fine-tuning list-paginated-jobs` — List your organization's fine-tuning jobs
- `openai-pp-cli fine-tuning pause-job` — Pause a fine-tune job.
- `openai-pp-cli fine-tuning resume-job` — Resume a fine-tune job.
- `openai-pp-cli fine-tuning retrieve-job` — Get info about a fine-tuning job. [Learn more about fine-tuning](/docs/guides/model-optimization)
- `openai-pp-cli fine-tuning run-grader` — Run a grader.
- `openai-pp-cli fine-tuning validate-grader` — Validate a grader.

**images** — Given a prompt and/or an input image, the model will generate a new image.

- `openai-pp-cli images create` — Creates an image given a prompt. [Learn more](/docs/guides/images).
- `openai-pp-cli images create-edit` — You can call this endpoint with either: - `multipart/form-data`: use binary uploads via `image` (and optional...
- `openai-pp-cli images create-variation` — Creates a variation of a given image. This endpoint only supports `dall-e-2`.

**models** — List and describe the various models available in the API.

- `openai-pp-cli models delete` — Delete a fine-tuned model. You must have the Owner role in your organization to delete a model.
- `openai-pp-cli models list` — Lists the currently available models, and provides basic information about each one such as the owner and availability.
- `openai-pp-cli models retrieve` — Retrieves a model instance, providing basic information about the model such as the owner and permissioning.

**moderations** — Given text and/or image inputs, classifies if those inputs are potentially harmful.

- `openai-pp-cli moderations` — Classifies if text and/or image inputs are potentially harmful. Learn more in the [moderation...

**organization** — Manage organization

- `openai-pp-cli organization activate-certificates` — Activate certificates at the organization level. You can atomically and idempotently activate up to 10 certificates...
- `openai-pp-cli organization activate-project-certificates` — Activate certificates at the project level. You can atomically and idempotently activate up to 10 certificates at a...
- `openai-pp-cli organization add-group-user` — Adds a user to a group.
- `openai-pp-cli organization add-project-group` — Grants a group access to a project.
- `openai-pp-cli organization admin-api-keys-create` — Create a new admin-level API key for the organization.
- `openai-pp-cli organization admin-api-keys-delete` — Delete an organization admin API key
- `openai-pp-cli organization admin-api-keys-get` — Get details for a specific organization API key by its ID.
- `openai-pp-cli organization admin-api-keys-list` — Retrieve a paginated list of organization admin API keys.
- `openai-pp-cli organization archive-project` — Archives a project in the organization. Archived projects cannot be used or updated.
- `openai-pp-cli organization assign-group-role` — Assigns an organization role to a group within the organization.
- `openai-pp-cli organization assign-user-role` — Assigns an organization role to a user within the organization.
- `openai-pp-cli organization create-group` — Creates a new group in the organization.
- `openai-pp-cli organization create-project` — Create a new project in the organization. Projects can be created and archived, but cannot be deleted.
- `openai-pp-cli organization create-project-service-account` — Creates a new service account in the project. This also returns an unredacted API key for the service account.
- `openai-pp-cli organization create-project-user` — Adds a user to the project. Users must already be members of the organization to be added to a project.
- `openai-pp-cli organization create-role` — Creates a custom role for the organization.
- `openai-pp-cli organization deactivate-certificates` — Deactivate certificates at the organization level. You can atomically and idempotently deactivate up to 10...
- `openai-pp-cli organization deactivate-project-certificates` — Deactivate certificates at the project level. You can atomically and idempotently deactivate up to 10 certificates...
- `openai-pp-cli organization delete-certificate` — Delete a certificate from the organization. The certificate must be inactive for the organization and all projects.
- `openai-pp-cli organization delete-group` — Deletes a group from the organization.
- `openai-pp-cli organization delete-invite` — Delete an invite. If the invite has already been accepted, it cannot be deleted.
- `openai-pp-cli organization delete-project-api-key` — Deletes an API key from the project. Returns confirmation of the key deletion, or an error if the key belonged to a...
- `openai-pp-cli organization delete-project-service-account` — Deletes a service account from the project. Returns confirmation of service account deletion, or an error if the...
- `openai-pp-cli organization delete-project-user` — Deletes a user from the project. Returns confirmation of project user deletion, or an error if the project is...
- `openai-pp-cli organization delete-role` — Deletes a custom role from the organization.
- `openai-pp-cli organization delete-user` — Deletes a user from the organization.
- `openai-pp-cli organization get-certificate` — Get a certificate that has been uploaded to the organization. You can get a certificate regardless of whether it is...
- `openai-pp-cli organization invite-user` — Create an invite for a user to the organization. The invite must be accepted by the user before they have access to...
- `openai-pp-cli organization list-audit-logs` — List user actions and configuration changes within this organization.
- `openai-pp-cli organization list-certificates` — List uploaded certificates for this organization.
- `openai-pp-cli organization list-group-role-assignments` — Lists the organization roles assigned to a group within the organization.
- `openai-pp-cli organization list-group-users` — Lists the users assigned to a group.
- `openai-pp-cli organization list-groups` — Lists all groups in the organization.
- `openai-pp-cli organization list-invites` — Returns a list of invites in the organization.
- `openai-pp-cli organization list-project-api-keys` — Returns a list of API keys in the project.
- `openai-pp-cli organization list-project-certificates` — List certificates for this project.
- `openai-pp-cli organization list-project-groups` — Lists the groups that have access to a project.
- `openai-pp-cli organization list-project-rate-limits` — Returns the rate limits per model for a project.
- `openai-pp-cli organization list-project-service-accounts` — Returns a list of service accounts in the project.
- `openai-pp-cli organization list-project-users` — Returns a list of users in the project.
- `openai-pp-cli organization list-projects` — Returns a list of projects.
- `openai-pp-cli organization list-roles` — Lists the roles configured for the organization.
- `openai-pp-cli organization list-user-role-assignments` — Lists the organization roles assigned to a user within the organization.
- `openai-pp-cli organization list-users` — Lists all of the users in the organization.
- `openai-pp-cli organization modify-certificate` — Modify a certificate. Note that only the name can be modified.
- `openai-pp-cli organization modify-project` — Modifies a project in the organization.
- `openai-pp-cli organization modify-project-user` — Modifies a user's role in the project.
- `openai-pp-cli organization modify-user` — Modifies a user's role in the organization.
- `openai-pp-cli organization remove-group-user` — Removes a user from a group.
- `openai-pp-cli organization remove-project-group` — Revokes a group's access to a project.
- `openai-pp-cli organization retrieve-invite` — Retrieves an invite.
- `openai-pp-cli organization retrieve-project` — Retrieves a project.
- `openai-pp-cli organization retrieve-project-api-key` — Retrieves an API key in the project.
- `openai-pp-cli organization retrieve-project-service-account` — Retrieves a service account in the project.
- `openai-pp-cli organization retrieve-project-user` — Retrieves a user in the project.
- `openai-pp-cli organization retrieve-user` — Retrieves a user by their identifier.
- `openai-pp-cli organization unassign-group-role` — Unassigns an organization role from a group within the organization.
- `openai-pp-cli organization unassign-user-role` — Unassigns an organization role from a user within the organization.
- `openai-pp-cli organization update-group` — Updates a group's information.
- `openai-pp-cli organization update-project-rate-limits` — Updates a project rate limit.
- `openai-pp-cli organization update-role` — Updates an existing organization role.
- `openai-pp-cli organization upload-certificate` — Upload a certificate to the organization. This does **not** automatically activate the certificate. Organizations...
- `openai-pp-cli organization usage-audio-speeches` — Get audio speeches usage details for the organization.
- `openai-pp-cli organization usage-audio-transcriptions` — Get audio transcriptions usage details for the organization.
- `openai-pp-cli organization usage-code-interpreter-sessions` — Get code interpreter sessions usage details for the organization.
- `openai-pp-cli organization usage-completions` — Get completions usage details for the organization.
- `openai-pp-cli organization usage-costs` — Get costs details for the organization.
- `openai-pp-cli organization usage-embeddings` — Get embeddings usage details for the organization.
- `openai-pp-cli organization usage-images` — Get images usage details for the organization.
- `openai-pp-cli organization usage-moderations` — Get moderations usage details for the organization.
- `openai-pp-cli organization usage-vector-stores` — Get vector stores usage details for the organization.

**projects** — Manage projects


**realtime** — Manage realtime

- `openai-pp-cli realtime accept-call` — Accept an incoming SIP call and configure the realtime session that will handle it.
- `openai-pp-cli realtime create-call` — Create a new Realtime API call over WebRTC and receive the SDP answer needed to complete the peer connection.
- `openai-pp-cli realtime create-client-secret` — Create a Realtime client secret with an associated session configuration. Client secrets are short-lived tokens that...
- `openai-pp-cli realtime create-session` — Create an ephemeral API token for use in client-side applications with the Realtime API. Can be configured with the...
- `openai-pp-cli realtime create-transcription-session` — Create an ephemeral API token for use in client-side applications with the Realtime API specifically for realtime...
- `openai-pp-cli realtime create-translation-client-secret` — Create a Realtime translation client secret with an associated translation session configuration. Client secrets are...
- `openai-pp-cli realtime hangup-call` — End an active Realtime API call, whether it was initiated over SIP or WebRTC.
- `openai-pp-cli realtime refer-call` — Transfer an active SIP call to a new destination using the SIP REFER verb.
- `openai-pp-cli realtime reject-call` — Decline an incoming SIP call by returning a SIP status code to the caller.

**responses** — Manage responses

- `openai-pp-cli responses compactconversation` — Compact a conversation. Returns a compacted response object. Learn when and how to compact long-running...
- `openai-pp-cli responses create` — Creates a model response. Provide [text](/docs/guides/text) or [image](/docs/guides/images) inputs to generate...
- `openai-pp-cli responses delete` — Deletes a model response with the given ID.
- `openai-pp-cli responses get` — Retrieves a model response with the given ID.
- `openai-pp-cli responses getinputtokencounts` — Returns input token counts of the request. Returns an object with `object` set to `response.input_tokens` and an...

**skills** — Manage skills

- `openai-pp-cli skills create` — Create a new skill.
- `openai-pp-cli skills delete` — Delete a skill by its ID.
- `openai-pp-cli skills get` — Get a skill by its ID.
- `openai-pp-cli skills list` — List all skills for the current project.
- `openai-pp-cli skills update-default-version` — Update the default version pointer for a skill.

**threads** — Manage threads

- `openai-pp-cli threads create` — Create a thread.
- `openai-pp-cli threads create-and-run` — Create a thread and run it in one request.
- `openai-pp-cli threads delete` — Delete a thread.
- `openai-pp-cli threads get` — Retrieves a thread.
- `openai-pp-cli threads modify` — Modifies a thread.

**uploads** — Use Uploads to upload large files in multiple parts.

- `openai-pp-cli uploads` — Creates an intermediate [Upload](/docs/api-reference/uploads/object) object that you can add...

**vector-stores** — Manage vector stores

- `openai-pp-cli vector-stores create` — Create a vector store.
- `openai-pp-cli vector-stores delete` — Delete a vector store.
- `openai-pp-cli vector-stores get` — Retrieves a vector store.
- `openai-pp-cli vector-stores list` — Returns a list of vector stores.
- `openai-pp-cli vector-stores modify` — Modifies a vector store.

**videos** — Manage videos

- `openai-pp-cli videos create` — Create a new video generation job from a prompt and optional reference assets.
- `openai-pp-cli videos create-character` — Create a character from an uploaded video.
- `openai-pp-cli videos create-edit` — Create a new video generation job by editing a source video or existing generated video.
- `openai-pp-cli videos create-extend` — Create an extension of a completed video.
- `openai-pp-cli videos delete` — Permanently delete a completed or failed video and its stored assets.
- `openai-pp-cli videos get` — Fetch the latest metadata for a generated video.
- `openai-pp-cli videos get-character` — Fetch a character.
- `openai-pp-cli videos list` — List recently generated videos for the current project.


### Finding the right command

When you know what you want to do but not which command does it, ask the CLI directly:

```bash
openai-pp-cli which "<capability in your own words>"
```

`which` resolves a natural-language capability query to the best matching command from this CLI's curated feature index. Exit code `0` means at least one match; exit code `2` means no confident match — fall back to `--help` or use a narrower query.

## Auth Setup

Run `openai-pp-cli auth setup` for the URL and steps to obtain a token (add `--launch` to open the URL). Then store it:

```bash
openai-pp-cli auth set-token YOUR_TOKEN_HERE
```

Or set `OPENAI_API_KEY_AUTH` as an environment variable.

Run `openai-pp-cli doctor` to verify setup.

## Agent Mode

Add `--agent` to any command. Expands to: `--json --compact --no-input --no-color --yes`.

- **Pipeable** — JSON on stdout, errors on stderr
- **Filterable** — `--select` keeps a subset of fields. Dotted paths descend into nested structures; arrays traverse element-wise. Critical for keeping context small on verbose APIs:

  ```bash
  openai-pp-cli assistants list --agent --select id,name,status
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
openai-pp-cli feedback "the --since flag is inclusive but docs say exclusive"
openai-pp-cli feedback --stdin < notes.txt
openai-pp-cli feedback list --json --limit 10
```

Entries are stored locally at `~/.openai-pp-cli/feedback.jsonl`. They are never POSTed unless `OPENAI_FEEDBACK_ENDPOINT` is set AND either `--send` is passed or `OPENAI_FEEDBACK_AUTO_SEND=true`. Default behavior is local-only.

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
openai-pp-cli profile save briefing --json
openai-pp-cli --profile briefing assistants list
openai-pp-cli profile list --json
openai-pp-cli profile show briefing
openai-pp-cli profile delete briefing --yes
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

1. **Empty, `help`, or `--help`** → show `openai-pp-cli --help` output
2. **Starts with `install`** → ends with `mcp` → MCP installation; otherwise → see Prerequisites above
3. **Anything else** → Direct Use (execute as CLI command with `--agent`)

## MCP Server Installation

Install the MCP binary from this CLI's published public-library entry or pre-built release, then register it:

```bash
claude mcp add openai-pp-mcp -- openai-pp-mcp
```

Verify: `claude mcp list`

## Direct Use

1. Check if installed: `which openai-pp-cli`
   If not found, offer to install (see Prerequisites at the top of this skill).
2. Match the user query to the best command from the Unique Capabilities and Command Reference above.
3. Execute with the `--agent` flag:
   ```bash
   openai-pp-cli <command> [subcommand] [args] --agent
   ```
4. If ambiguous, drill into subcommand help: `openai-pp-cli <command> --help`.
