// Tests for the kill-switch and anti-thrash backoff guard.
// Uses the real filesystem (temp dir) — no mocks, per project testing rules.
// Run: node --test scripts/ralph/lib/safety.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isStopped, shouldHalt } from './safety.mjs';

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'ralph-safety-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('isStopped is false when no STOP file exists', () => {
  withTempDir((dir) => {
    assert.equal(isStopped(dir), false);
  });
});

test('isStopped is true when a STOP file exists', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, 'STOP'), '');
    assert.equal(isStopped(dir), true);
  });
});

test('shouldHalt triggers at or above the failure ceiling (default 3)', () => {
  assert.equal(shouldHalt(0), false);
  assert.equal(shouldHalt(2), false);
  assert.equal(shouldHalt(3), true);
  assert.equal(shouldHalt(5), true);
});

test('shouldHalt ceiling is configurable', () => {
  assert.equal(shouldHalt(2, 2), true);
  assert.equal(shouldHalt(1, 2), false);
});
