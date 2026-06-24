#!/usr/bin/env node
// PreToolUse hook entry point. Claude Code pipes the tool call as JSON on stdin.
// Exit 2 => block the tool call (stderr is shown to the model). Exit 0 => allow.
// Wired in .claude/settings.json under hooks.PreToolUse. Works even under
// `--dangerously-skip-permissions` (hooks are not bypassed).
import { isDangerousBash, isProtectedEnvPath } from './guard.mjs';

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let evt;
  try {
    evt = JSON.parse(raw || '{}');
  } catch {
    process.exit(0); // never break normal operation on a parse error
  }
  const tool = evt.tool_name ?? evt.toolName;
  const input = evt.tool_input ?? evt.toolInput ?? {};

  let reason = null;
  if (tool === 'Bash') {
    reason = isDangerousBash(input.command);
  } else if (tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') {
    const path = input.file_path ?? input.path ?? input.notebook_path;
    if (isProtectedEnvPath(path)) reason = 'editing .env secret files is forbidden (use .env.example)';
  }

  if (reason) {
    process.stderr.write(`[ralph guard] blocked: ${reason}\n`);
    process.exit(2);
  }
  process.exit(0);
});
