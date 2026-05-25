# Openai CLI

The OpenAI REST API. Please see https://platform.openai.com/docs/api-reference for more details.

Learn more at [Openai](https://help.openai.com/).

## Install

The recommended path installs both the `openai-pp-cli` binary and the `pp-openai` agent skill in one shot:

```bash
npx -y @mvanhorn/printing-press install openai
```

For CLI only (no skill):

```bash
npx -y @mvanhorn/printing-press install openai --cli-only
```


### Without Node

The generated install path is category-agnostic until this CLI is published. If `npx` is not available before publish, install Node or use the category-specific Go fallback from the public-library entry after publish.

### Pre-built binary

Download a pre-built binary for your platform from the [latest release](https://github.com/mvanhorn/printing-press-library/releases/tag/openai-current). On macOS, clear the Gatekeeper quarantine: `xattr -d com.apple.quarantine <binary>`. On Unix, mark it executable: `chmod +x <binary>`.

<!-- pp-hermes-install-anchor -->
## Install for Hermes

From the Hermes CLI:

```bash
hermes skills install mvanhorn/printing-press-library/cli-skills/pp-openai --force
```

Inside a Hermes chat session:

```bash
/skills install mvanhorn/printing-press-library/cli-skills/pp-openai --force
```

## Install for OpenClaw

Tell your OpenClaw agent (copy this):

```
Install the pp-openai skill from https://github.com/mvanhorn/printing-press-library/tree/main/cli-skills/pp-openai. The skill defines how its required CLI can be installed.
```

## Quick Start

### 1. Install

See [Install](#install) above.

### 2. Set Up Credentials

Get your access token from your API provider's developer portal, then store it:

```bash
openai-pp-cli auth set-token YOUR_TOKEN_HERE
```

Or set it via environment variable:

```bash
export OPENAI_API_KEY_AUTH="your-token-here"
```

### 3. Verify Setup

```bash
openai-pp-cli doctor
```

This checks your configuration and credentials.

### 4. Try Your First Command

```bash
openai-pp-cli assistants list
```

## Usage

Run `openai-pp-cli --help` for the full command reference and flag list.

## Commands

### assistants

Build Assistants that can call models and use tools.

- **`openai-pp-cli assistants create`** - Create an assistant with a model and instructions.
- **`openai-pp-cli assistants delete`** - Delete an assistant.
- **`openai-pp-cli assistants get`** - Retrieves an assistant.
- **`openai-pp-cli assistants list`** - Returns a list of assistants.
- **`openai-pp-cli assistants modify`** - Modifies an assistant.

### audio

Turn audio into text or text into audio.

- **`openai-pp-cli audio create-speech`** - Generates audio from the input text.

Returns the audio file content, or a stream of audio events.
- **`openai-pp-cli audio create-transcription`** - Transcribes audio into the input language.

Returns a transcription object in `json`, `diarized_json`, or `verbose_json`
format, or a stream of transcript events.
- **`openai-pp-cli audio create-translation`** - Translates audio into English.
- **`openai-pp-cli audio create-voice`** - Create a custom voice you can use for audio output (for example, in Text-to-Speech and the Realtime API). This requires an audio sample and a previously uploaded consent recording.

See the [custom voices guide](/docs/guides/text-to-speech#custom-voices) for requirements and best practices. Custom voices are limited to eligible customers.
- **`openai-pp-cli audio create-voice-consent`** - Upload a consent recording that authorizes creation of a custom voice.

See the [custom voices guide](/docs/guides/text-to-speech#custom-voices) for requirements and best practices. Custom voices are limited to eligible customers.
- **`openai-pp-cli audio delete-voice-consent`** - Delete a consent recording that was uploaded for creating custom voices.

See the [custom voices guide](/docs/guides/text-to-speech#custom-voices). Custom voices are limited to eligible customers.
- **`openai-pp-cli audio get-voice-consent`** - Retrieve consent recording metadata used for creating custom voices.

See the [custom voices guide](/docs/guides/text-to-speech#custom-voices). Custom voices are limited to eligible customers.
- **`openai-pp-cli audio list-voice-consents`** - List consent recordings available to your organization for creating custom voices.

See the [custom voices guide](/docs/guides/text-to-speech#custom-voices). Custom voices are limited to eligible customers.
- **`openai-pp-cli audio update-voice-consent`** - Update consent recording metadata used for creating custom voices. This endpoint updates metadata only and does not replace the underlying audio.

See the [custom voices guide](/docs/guides/text-to-speech#custom-voices). Custom voices are limited to eligible customers.

### batches

Manage batches

- **`openai-pp-cli batches create-batch`** - Creates and executes a batch from an uploaded file of requests
- **`openai-pp-cli batches list`** - List your organization's batches.
- **`openai-pp-cli batches retrieve-batch`** - Retrieves a batch.

### chat

Given a list of messages comprising a conversation, the model will return a response.

- **`openai-pp-cli chat create-completion`** - **Starting a new project?** We recommend trying [Responses](/docs/api-reference/responses)
to take advantage of the latest OpenAI platform features. Compare
[Chat Completions with Responses](/docs/guides/responses-vs-chat-completions?api-mode=responses).

---

Creates a model response for the given chat conversation. Learn more in the
[text generation](/docs/guides/text-generation), [vision](/docs/guides/vision),
and [audio](/docs/guides/audio) guides.

Parameter support can differ depending on the model used to generate the
response, particularly for newer reasoning models. Parameters that are only
supported for reasoning models are noted below. For the current state of
unsupported parameters in reasoning models,
[refer to the reasoning guide](/docs/guides/reasoning).

Returns a chat completion object, or a streamed sequence of chat completion
chunk objects if the request is streamed.
- **`openai-pp-cli chat delete-completion`** - Delete a stored chat completion. Only Chat Completions that have been
created with the `store` parameter set to `true` can be deleted.
- **`openai-pp-cli chat get-completion`** - Get a stored chat completion. Only Chat Completions that have been created
with the `store` parameter set to `true` will be returned.
- **`openai-pp-cli chat get-completion-messages`** - Get the messages in a stored chat completion. Only Chat Completions that
have been created with the `store` parameter set to `true` will be
returned.
- **`openai-pp-cli chat list-completions`** - List stored Chat Completions. Only Chat Completions that have been stored
with the `store` parameter set to `true` will be returned.
- **`openai-pp-cli chat update-completion`** - Modify a stored chat completion. Only Chat Completions that have been
created with the `store` parameter set to `true` can be modified. Currently,
the only supported modification is to update the `metadata` field.

### chatkit

Manage chatkit

- **`openai-pp-cli chatkit cancel-chat-session-method`** - Cancel an active ChatKit session and return its most recent metadata.

Cancelling prevents new requests from using the issued client secret.
- **`openai-pp-cli chatkit create-chat-session-method`** - Create a ChatKit session.
- **`openai-pp-cli chatkit delete-thread-method`** - Delete a ChatKit thread along with its items and stored attachments.
- **`openai-pp-cli chatkit get-thread-method`** - Retrieve a ChatKit thread by its identifier.
- **`openai-pp-cli chatkit list-thread-items-method`** - List items that belong to a ChatKit thread.
- **`openai-pp-cli chatkit list-threads-method`** - List ChatKit threads with optional pagination and user filters.

### completions

Given a prompt, the model will return one or more predicted completions, and can also return the probabilities of alternative tokens at each position.

- **`openai-pp-cli completions create`** - Creates a completion for the provided prompt and parameters.

Returns a completion object, or a sequence of completion objects if the request is streamed.

### containers

Manage containers

- **`openai-pp-cli containers create`** - Creates a container.
- **`openai-pp-cli containers delete`** - Delete a container.
- **`openai-pp-cli containers list`** - Lists containers.
- **`openai-pp-cli containers retrieve`** - Retrieves a container.

### conversations

Manage conversations and conversation items.

- **`openai-pp-cli conversations create`** - Create a conversation.
- **`openai-pp-cli conversations delete`** - Delete a conversation. Items in the conversation will not be deleted.
- **`openai-pp-cli conversations get`** - Get a conversation
- **`openai-pp-cli conversations update`** - Update a conversation

### embeddings

Get a vector representation of a given input that can be easily consumed by machine learning models and algorithms.

- **`openai-pp-cli embeddings create`** - Creates an embedding vector representing the input text.

### evals

Manage and run evals in the OpenAI platform.

- **`openai-pp-cli evals create`** - Create the structure of an evaluation that can be used to test a model's performance.
An evaluation is a set of testing criteria and the config for a data source, which dictates the schema of the data used in the evaluation. After creating an evaluation, you can run it on different models and model parameters. We support several types of graders and datasources.
For more information, see the [Evals guide](/docs/guides/evals).
- **`openai-pp-cli evals delete`** - Delete an evaluation.
- **`openai-pp-cli evals get`** - Get an evaluation by ID.
- **`openai-pp-cli evals list`** - List evaluations for a project.
- **`openai-pp-cli evals update`** - Update certain properties of an evaluation.

### files

Files are used to upload documents that can be used with features like Assistants and Fine-tuning.

- **`openai-pp-cli files create`** - Upload a file that can be used across various endpoints. Individual files
can be up to 512 MB, and each project can store up to 2.5 TB of files in
total. There is no organization-wide storage limit. Uploads to this
endpoint are rate-limited to 1,000 requests per minute per authenticated
user.

- The Assistants API supports files up to 2 million tokens and of specific
  file types. See the [Assistants Tools guide](/docs/assistants/tools) for
  details.
- The Fine-tuning API only supports `.jsonl` files. The input also has
  certain required formats for fine-tuning
  [chat](/docs/api-reference/fine-tuning/chat-input) or
  [completions](/docs/api-reference/fine-tuning/completions-input) models.
- The Batch API only supports `.jsonl` files up to 200 MB in size. The input
  also has a specific required
  [format](/docs/api-reference/batch/request-input).
- For Retrieval or `file_search` ingestion, upload files here first. If
  you need to attach multiple uploaded files to the same vector store, use
  [`/vector_stores/{vector_store_id}/file_batches`](/docs/api-reference/vector-stores-file-batches/createBatch)
  instead of attaching them one by one. Vector store attachment has separate
  limits from file upload, including 2,000 attached files per minute per
  organization.

Please [contact us](https://help.openai.com/) if you need to increase these
storage limits.
- **`openai-pp-cli files delete`** - Delete a file and remove it from all vector stores.
- **`openai-pp-cli files list`** - Returns a list of files.
- **`openai-pp-cli files retrieve`** - Returns information about a specific file.

### fine-tuning

Manage fine-tuning jobs to tailor a model to your specific training data.

- **`openai-pp-cli fine-tuning cancel-job`** - Immediately cancel a fine-tune job.
- **`openai-pp-cli fine-tuning create-checkpoint-permission`** - **NOTE:** Calling this endpoint requires an [admin API key](../admin-api-keys).

This enables organization owners to share fine-tuned models with other projects in their organization.
- **`openai-pp-cli fine-tuning create-job`** - Creates a fine-tuning job which begins the process of creating a new model from a given dataset.

Response includes details of the enqueued job including job status and the name of the fine-tuned models once complete.

[Learn more about fine-tuning](/docs/guides/model-optimization)
- **`openai-pp-cli fine-tuning delete-checkpoint-permission`** - **NOTE:** This endpoint requires an [admin API key](../admin-api-keys).

Organization owners can use this endpoint to delete a permission for a fine-tuned model checkpoint.
- **`openai-pp-cli fine-tuning list-checkpoint-permissions`** - **NOTE:** This endpoint requires an [admin API key](../admin-api-keys).

Organization owners can use this endpoint to view all permissions for a fine-tuned model checkpoint.
- **`openai-pp-cli fine-tuning list-events`** - Get status updates for a fine-tuning job.
- **`openai-pp-cli fine-tuning list-job-checkpoints`** - List checkpoints for a fine-tuning job.
- **`openai-pp-cli fine-tuning list-paginated-jobs`** - List your organization's fine-tuning jobs
- **`openai-pp-cli fine-tuning pause-job`** - Pause a fine-tune job.
- **`openai-pp-cli fine-tuning resume-job`** - Resume a fine-tune job.
- **`openai-pp-cli fine-tuning retrieve-job`** - Get info about a fine-tuning job.

[Learn more about fine-tuning](/docs/guides/model-optimization)
- **`openai-pp-cli fine-tuning run-grader`** - Run a grader.
- **`openai-pp-cli fine-tuning validate-grader`** - Validate a grader.

### images

Given a prompt and/or an input image, the model will generate a new image.

- **`openai-pp-cli images create`** - Creates an image given a prompt. [Learn more](/docs/guides/images).
- **`openai-pp-cli images create-edit`** - You can call this endpoint with either:

- `multipart/form-data`: use binary uploads via `image` (and optional `mask`).
- `application/json`: use `images` (and optional `mask`) as references with either `image_url` or `file_id`.

Note that JSON requests use `images` (array) instead of the multipart `image` field.
- **`openai-pp-cli images create-variation`** - Creates a variation of a given image. This endpoint only supports `dall-e-2`.

### models

List and describe the various models available in the API.

- **`openai-pp-cli models delete`** - Delete a fine-tuned model. You must have the Owner role in your organization to delete a model.
- **`openai-pp-cli models list`** - Lists the currently available models, and provides basic information about each one such as the owner and availability.
- **`openai-pp-cli models retrieve`** - Retrieves a model instance, providing basic information about the model such as the owner and permissioning.

### moderations

Given text and/or image inputs, classifies if those inputs are potentially harmful.

- **`openai-pp-cli moderations create`** - Classifies if text and/or image inputs are potentially harmful. Learn
more in the [moderation guide](/docs/guides/moderation).

### organization

Manage organization

- **`openai-pp-cli organization activate-certificates`** - Activate certificates at the organization level.

You can atomically and idempotently activate up to 10 certificates at a time.
- **`openai-pp-cli organization activate-project-certificates`** - Activate certificates at the project level.

You can atomically and idempotently activate up to 10 certificates at a time.
- **`openai-pp-cli organization add-group-user`** - Adds a user to a group.
- **`openai-pp-cli organization add-project-group`** - Grants a group access to a project.
- **`openai-pp-cli organization admin-api-keys-create`** - Create a new admin-level API key for the organization.
- **`openai-pp-cli organization admin-api-keys-delete`** - Delete an organization admin API key
- **`openai-pp-cli organization admin-api-keys-get`** - Get details for a specific organization API key by its ID.
- **`openai-pp-cli organization admin-api-keys-list`** - Retrieve a paginated list of organization admin API keys.
- **`openai-pp-cli organization archive-project`** - Archives a project in the organization. Archived projects cannot be used or updated.
- **`openai-pp-cli organization assign-group-role`** - Assigns an organization role to a group within the organization.
- **`openai-pp-cli organization assign-user-role`** - Assigns an organization role to a user within the organization.
- **`openai-pp-cli organization create-group`** - Creates a new group in the organization.
- **`openai-pp-cli organization create-project`** - Create a new project in the organization. Projects can be created and archived, but cannot be deleted.
- **`openai-pp-cli organization create-project-service-account`** - Creates a new service account in the project. This also returns an unredacted API key for the service account.
- **`openai-pp-cli organization create-project-user`** - Adds a user to the project. Users must already be members of the organization to be added to a project.
- **`openai-pp-cli organization create-role`** - Creates a custom role for the organization.
- **`openai-pp-cli organization deactivate-certificates`** - Deactivate certificates at the organization level.

You can atomically and idempotently deactivate up to 10 certificates at a time.
- **`openai-pp-cli organization deactivate-project-certificates`** - Deactivate certificates at the project level. You can atomically and 
idempotently deactivate up to 10 certificates at a time.
- **`openai-pp-cli organization delete-certificate`** - Delete a certificate from the organization.

The certificate must be inactive for the organization and all projects.
- **`openai-pp-cli organization delete-group`** - Deletes a group from the organization.
- **`openai-pp-cli organization delete-invite`** - Delete an invite. If the invite has already been accepted, it cannot be deleted.
- **`openai-pp-cli organization delete-project-api-key`** - Deletes an API key from the project.

Returns confirmation of the key deletion, or an error if the key belonged to
a service account.
- **`openai-pp-cli organization delete-project-service-account`** - Deletes a service account from the project.

Returns confirmation of service account deletion, or an error if the project
is archived (archived projects have no service accounts).
- **`openai-pp-cli organization delete-project-user`** - Deletes a user from the project.

Returns confirmation of project user deletion, or an error if the project is
archived (archived projects have no users).
- **`openai-pp-cli organization delete-role`** - Deletes a custom role from the organization.
- **`openai-pp-cli organization delete-user`** - Deletes a user from the organization.
- **`openai-pp-cli organization get-certificate`** - Get a certificate that has been uploaded to the organization.

You can get a certificate regardless of whether it is active or not.
- **`openai-pp-cli organization invite-user`** - Create an invite for a user to the organization. The invite must be accepted by the user before they have access to the organization.
- **`openai-pp-cli organization list-audit-logs`** - List user actions and configuration changes within this organization.
- **`openai-pp-cli organization list-certificates`** - List uploaded certificates for this organization.
- **`openai-pp-cli organization list-group-role-assignments`** - Lists the organization roles assigned to a group within the organization.
- **`openai-pp-cli organization list-group-users`** - Lists the users assigned to a group.
- **`openai-pp-cli organization list-groups`** - Lists all groups in the organization.
- **`openai-pp-cli organization list-invites`** - Returns a list of invites in the organization.
- **`openai-pp-cli organization list-project-api-keys`** - Returns a list of API keys in the project.
- **`openai-pp-cli organization list-project-certificates`** - List certificates for this project.
- **`openai-pp-cli organization list-project-groups`** - Lists the groups that have access to a project.
- **`openai-pp-cli organization list-project-rate-limits`** - Returns the rate limits per model for a project.
- **`openai-pp-cli organization list-project-service-accounts`** - Returns a list of service accounts in the project.
- **`openai-pp-cli organization list-project-users`** - Returns a list of users in the project.
- **`openai-pp-cli organization list-projects`** - Returns a list of projects.
- **`openai-pp-cli organization list-roles`** - Lists the roles configured for the organization.
- **`openai-pp-cli organization list-user-role-assignments`** - Lists the organization roles assigned to a user within the organization.
- **`openai-pp-cli organization list-users`** - Lists all of the users in the organization.
- **`openai-pp-cli organization modify-certificate`** - Modify a certificate. Note that only the name can be modified.
- **`openai-pp-cli organization modify-project`** - Modifies a project in the organization.
- **`openai-pp-cli organization modify-project-user`** - Modifies a user's role in the project.
- **`openai-pp-cli organization modify-user`** - Modifies a user's role in the organization.
- **`openai-pp-cli organization remove-group-user`** - Removes a user from a group.
- **`openai-pp-cli organization remove-project-group`** - Revokes a group's access to a project.
- **`openai-pp-cli organization retrieve-invite`** - Retrieves an invite.
- **`openai-pp-cli organization retrieve-project`** - Retrieves a project.
- **`openai-pp-cli organization retrieve-project-api-key`** - Retrieves an API key in the project.
- **`openai-pp-cli organization retrieve-project-service-account`** - Retrieves a service account in the project.
- **`openai-pp-cli organization retrieve-project-user`** - Retrieves a user in the project.
- **`openai-pp-cli organization retrieve-user`** - Retrieves a user by their identifier.
- **`openai-pp-cli organization unassign-group-role`** - Unassigns an organization role from a group within the organization.
- **`openai-pp-cli organization unassign-user-role`** - Unassigns an organization role from a user within the organization.
- **`openai-pp-cli organization update-group`** - Updates a group's information.
- **`openai-pp-cli organization update-project-rate-limits`** - Updates a project rate limit.
- **`openai-pp-cli organization update-role`** - Updates an existing organization role.
- **`openai-pp-cli organization upload-certificate`** - Upload a certificate to the organization. This does **not** automatically activate the certificate.

Organizations can upload up to 50 certificates.
- **`openai-pp-cli organization usage-audio-speeches`** - Get audio speeches usage details for the organization.
- **`openai-pp-cli organization usage-audio-transcriptions`** - Get audio transcriptions usage details for the organization.
- **`openai-pp-cli organization usage-code-interpreter-sessions`** - Get code interpreter sessions usage details for the organization.
- **`openai-pp-cli organization usage-completions`** - Get completions usage details for the organization.
- **`openai-pp-cli organization usage-costs`** - Get costs details for the organization.
- **`openai-pp-cli organization usage-embeddings`** - Get embeddings usage details for the organization.
- **`openai-pp-cli organization usage-images`** - Get images usage details for the organization.
- **`openai-pp-cli organization usage-moderations`** - Get moderations usage details for the organization.
- **`openai-pp-cli organization usage-vector-stores`** - Get vector stores usage details for the organization.

### projects

Manage projects


### realtime

Manage realtime

- **`openai-pp-cli realtime accept-call`** - Accept an incoming SIP call and configure the realtime session that will
handle it.
- **`openai-pp-cli realtime create-call`** - Create a new Realtime API call over WebRTC and receive the SDP answer needed
to complete the peer connection.
- **`openai-pp-cli realtime create-client-secret`** - Create a Realtime client secret with an associated session configuration.

Client secrets are short-lived tokens that can be passed to a client app,
such as a web frontend or mobile client, which grants access to the Realtime API without
leaking your main API key. You can configure a custom TTL for each client secret.

You can also attach session configuration options to the client secret, which will be
applied to any sessions created using that client secret, but these can also be overridden
by the client connection.

[Learn more about authentication with client secrets over WebRTC](/docs/guides/realtime-webrtc).

Returns the created client secret and the effective session object. The client secret is a string that looks like `ek_1234`.
- **`openai-pp-cli realtime create-session`** - Create an ephemeral API token for use in client-side applications with the
Realtime API. Can be configured with the same session parameters as the
`session.update` client event.

It responds with a session object, plus a `client_secret` key which contains
a usable ephemeral API token that can be used to authenticate browser clients
for the Realtime API.

Returns the created Realtime session object, plus an ephemeral key.
- **`openai-pp-cli realtime create-transcription-session`** - Create an ephemeral API token for use in client-side applications with the
Realtime API specifically for realtime transcriptions. 
Can be configured with the same session parameters as the `transcription_session.update` client event.

It responds with a session object, plus a `client_secret` key which contains
a usable ephemeral API token that can be used to authenticate browser clients
for the Realtime API.

Returns the created Realtime transcription session object, plus an ephemeral key.
- **`openai-pp-cli realtime create-translation-client-secret`** - Create a Realtime translation client secret with an associated translation session configuration.

Client secrets are short-lived tokens that can be passed to a client app,
such as a web frontend or mobile client, which grants access to the Realtime
Translation API without leaking your main API key. You can configure a custom
TTL for each client secret.

Returns the created client secret and the effective translation session object.
The client secret is a string that looks like `ek_1234`.
- **`openai-pp-cli realtime hangup-call`** - End an active Realtime API call, whether it was initiated over SIP or
WebRTC.
- **`openai-pp-cli realtime refer-call`** - Transfer an active SIP call to a new destination using the SIP REFER verb.
- **`openai-pp-cli realtime reject-call`** - Decline an incoming SIP call by returning a SIP status code to the caller.

### responses

Manage responses

- **`openai-pp-cli responses compactconversation`** - Compact a conversation. Returns a compacted response object.

Learn when and how to compact long-running conversations in the [conversation state guide](/docs/guides/conversation-state#managing-the-context-window). For ZDR-compatible compaction details, see [Compaction (advanced)](/docs/guides/conversation-state#compaction-advanced).
- **`openai-pp-cli responses create`** - Creates a model response. Provide [text](/docs/guides/text) or
[image](/docs/guides/images) inputs to generate [text](/docs/guides/text)
or [JSON](/docs/guides/structured-outputs) outputs. Have the model call
your own [custom code](/docs/guides/function-calling) or use built-in
[tools](/docs/guides/tools) like [web search](/docs/guides/tools-web-search)
or [file search](/docs/guides/tools-file-search) to use your own data
as input for the model's response.
- **`openai-pp-cli responses delete`** - Deletes a model response with the given ID.
- **`openai-pp-cli responses get`** - Retrieves a model response with the given ID.
- **`openai-pp-cli responses getinputtokencounts`** - Returns input token counts of the request.

Returns an object with `object` set to `response.input_tokens` and an `input_tokens` count.

### skills

Manage skills

- **`openai-pp-cli skills create`** - Create a new skill.
- **`openai-pp-cli skills delete`** - Delete a skill by its ID.
- **`openai-pp-cli skills get`** - Get a skill by its ID.
- **`openai-pp-cli skills list`** - List all skills for the current project.
- **`openai-pp-cli skills update-default-version`** - Update the default version pointer for a skill.

### threads

Manage threads

- **`openai-pp-cli threads create`** - Create a thread.
- **`openai-pp-cli threads create-and-run`** - Create a thread and run it in one request.
- **`openai-pp-cli threads delete`** - Delete a thread.
- **`openai-pp-cli threads get`** - Retrieves a thread.
- **`openai-pp-cli threads modify`** - Modifies a thread.

### uploads

Use Uploads to upload large files in multiple parts.

- **`openai-pp-cli uploads create`** - Creates an intermediate [Upload](/docs/api-reference/uploads/object) object
that you can add [Parts](/docs/api-reference/uploads/part-object) to.
Currently, an Upload can accept at most 8 GB in total and expires after an
hour after you create it.

Once you complete the Upload, we will create a
[File](/docs/api-reference/files/object) object that contains all the parts
you uploaded. This File is usable in the rest of our platform as a regular
File object.

For certain `purpose` values, the correct `mime_type` must be specified. 
Please refer to documentation for the 
[supported MIME types for your use case](/docs/assistants/tools/file-search#supported-files).

For guidance on the proper filename extensions for each purpose, please
follow the documentation on [creating a
File](/docs/api-reference/files/create).

Returns the Upload object with status `pending`.

### vector-stores

Manage vector stores

- **`openai-pp-cli vector-stores create`** - Create a vector store.
- **`openai-pp-cli vector-stores delete`** - Delete a vector store.
- **`openai-pp-cli vector-stores get`** - Retrieves a vector store.
- **`openai-pp-cli vector-stores list`** - Returns a list of vector stores.
- **`openai-pp-cli vector-stores modify`** - Modifies a vector store.

### videos

Manage videos

- **`openai-pp-cli videos create`** - Create a new video generation job from a prompt and optional reference assets.
- **`openai-pp-cli videos create-character`** - Create a character from an uploaded video.
- **`openai-pp-cli videos create-edit`** - Create a new video generation job by editing a source video or existing generated video.
- **`openai-pp-cli videos create-extend`** - Create an extension of a completed video.
- **`openai-pp-cli videos delete`** - Permanently delete a completed or failed video and its stored assets.
- **`openai-pp-cli videos get`** - Fetch the latest metadata for a generated video.
- **`openai-pp-cli videos get-character`** - Fetch a character.
- **`openai-pp-cli videos list`** - List recently generated videos for the current project.


## Output Formats

```bash
# Human-readable table (default in terminal, JSON when piped)
openai-pp-cli assistants list

# JSON for scripting and agents
openai-pp-cli assistants list --json

# Filter to specific fields
openai-pp-cli assistants list --json --select id,name,status

# Dry run — show the request without sending
openai-pp-cli assistants list --dry-run

# Agent mode — JSON + compact + no prompts in one flag
openai-pp-cli assistants list --agent
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
npx skills add mvanhorn/printing-press-library/cli-skills/pp-openai -g
```

Then invoke `/pp-openai <query>` in Claude Code. The skill is the most efficient path — Claude Code drives the CLI directly without an MCP server in the middle.

<details>
<summary>Use as an MCP server in Claude Code (advanced)</summary>

If you'd rather register this CLI as an MCP server in Claude Code, install the MCP binary first:


Install the MCP binary from this CLI's published public-library entry or pre-built release.

Then register it:

```bash
claude mcp add openai openai-pp-mcp -e OPENAI_API_KEY_AUTH=<your-token>
```

</details>

## Use with Claude Desktop

This CLI ships an [MCPB](https://github.com/modelcontextprotocol/mcpb) bundle — Claude Desktop's standard format for one-click MCP extension installs (no JSON config required).

To install:

1. Download the `.mcpb` for your platform from the [latest release](https://github.com/mvanhorn/printing-press-library/releases/tag/openai-current).
2. Double-click the `.mcpb` file. Claude Desktop opens and walks you through the install.
3. Fill in `OPENAI_API_KEY_AUTH` when Claude Desktop prompts you.

Requires Claude Desktop 1.0.0 or later. Pre-built bundles ship for macOS Apple Silicon (`darwin-arm64`) and Windows (`amd64`, `arm64`); for other platforms, use the manual config below.

<details>
<summary>Manual JSON config (advanced)</summary>

If you can't use the MCPB bundle (older Claude Desktop, unsupported platform), install the MCP binary and configure it manually.


Install the MCP binary from this CLI's published public-library entry or pre-built release.

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "openai": {
      "command": "openai-pp-mcp",
      "env": {
        "OPENAI_API_KEY_AUTH": "<your-key>"
      }
    }
  }
}
```

</details>

## Health Check

```bash
openai-pp-cli doctor
```

Verifies configuration, credentials, and connectivity to the API.

## Configuration

Config file: `~/.config/openai-pp-cli/config.toml`

Static request headers can be configured under `headers`; per-command header overrides take precedence.

Environment variables:

| Name | Kind | Required | Description |
| --- | --- | --- | --- |
| `OPENAI_API_KEY_AUTH` | per_call | Yes | Set to your API credential. |

## Troubleshooting
**Authentication errors (exit code 4)**
- Run `openai-pp-cli doctor` to check credentials
- Verify the environment variable is set: `echo $OPENAI_API_KEY_AUTH`
**Not found errors (exit code 3)**
- Check the resource ID is correct
- Run the `list` command to see available items

---

Generated by [CLI Printing Press](https://github.com/mvanhorn/cli-printing-press)
