// PreToolUse guard — the hard safety barrier for the autonomous loop.
//
// IMPORTANT: the headless loop runs `claude --dangerously-skip-permissions`,
// which BYPASSES the settings.json allow/deny lists. Hooks are NOT bypassed, so
// these matchers (wired as a PreToolUse hook in .claude/settings.json) are the
// real enforcement of the non-negotiable barriers.
//
// Pure matchers here; the stdin/exit wrapper lives in guard-hook.mjs.

const DANGEROUS_BASH = [
  { re: /git\s+push\b[^\n]*(--force\b|--force-with-lease\b|(^|\s)-f\b)/, why: 'force-push is forbidden' },
  { re: /git\s+(commit|push)\b[^\n]*--no-verify\b/, why: '--no-verify bypasses the security gate' },
  { re: /rm\s+-[rR]?f[a-zA-Z]*\s+(\/(\s|$|\*)|~(\/|\s|$)|\$HOME\b)/, why: 'rm -rf of root/home is forbidden' },
];

/** Returns a reason string if the bash command is dangerous, else null. */
export function isDangerousBash(command) {
  const cmd = String(command ?? '');
  for (const { re, why } of DANGEROUS_BASH) {
    if (re.test(cmd)) return why;
  }
  return null;
}

/** True if `path` is a real .env secret file (never .env.example). */
export function isProtectedEnvPath(path) {
  const base = String(path ?? '').split('/').pop();
  if (base === '.env.example') return false;
  return base === '.env' || base.startsWith('.env.');
}
