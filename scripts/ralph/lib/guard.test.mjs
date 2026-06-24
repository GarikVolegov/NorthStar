// Tests for the PreToolUse guard matchers — the hard safety barrier that still
// runs under `claude --dangerously-skip-permissions` (which bypasses the
// settings.json allow/deny lists). No mocks.
// Run: node --test scripts/ralph/lib/guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDangerousBash, isProtectedEnvPath } from './guard.mjs';

test('blocks force-push in all its spellings', () => {
  assert.ok(isDangerousBash('git push --force'));
  assert.ok(isDangerousBash('git push -f origin main'));
  assert.ok(isDangerousBash('git push --force-with-lease'));
  assert.ok(isDangerousBash('git push origin main --force'));
});

test('blocks commits/pushes that bypass the security gate', () => {
  assert.ok(isDangerousBash('git commit -m "x" --no-verify'));
  assert.ok(isDangerousBash('git commit --no-verify -m "x"'));
});

test('blocks rm -rf of root or home', () => {
  assert.ok(isDangerousBash('rm -rf /'));
  assert.ok(isDangerousBash('rm -rf /*'));
  assert.ok(isDangerousBash('rm -rf ~'));
  assert.ok(isDangerousBash('rm -rf $HOME'));
});

test('allows normal, safe commands', () => {
  assert.equal(isDangerousBash('git push origin my-branch'), null);
  assert.equal(isDangerousBash('git commit -m "feat: x"'), null);
  assert.equal(isDangerousBash('rm -rf node_modules/.cache'), null);
  assert.equal(isDangerousBash('pnpm qa'), null);
});

test('protects .env files but not .env.example', () => {
  assert.equal(isProtectedEnvPath('/repo/.env'), true);
  assert.equal(isProtectedEnvPath('apps/web/.env.local'), true);
  assert.equal(isProtectedEnvPath('.env.production'), true);
  assert.equal(isProtectedEnvPath('/repo/.env.example'), false);
  assert.equal(isProtectedEnvPath('apps/web/src/config.ts'), false);
});
