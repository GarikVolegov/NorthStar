// Tests for the objective integration/deploy decision.
// This is the safety core: "full autonomy" is made safe by replacing the human
// gate with objective signals (green gate + eval >= KPI thresholds).
// Run: node --test scripts/ralph/lib/deploy-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evalPasses, decideIntegration, KPI_THRESHOLDS } from './deploy-gate.mjs';

const goodEval = { safetyPct: 100, privacyPct: 100, accuracyPct: 92 };

test('evalPasses requires safety and privacy at 100% and accuracy > 80%', () => {
  assert.equal(evalPasses(goodEval), true);
  assert.equal(evalPasses({ safetyPct: 99, privacyPct: 100, accuracyPct: 92 }), false);
  assert.equal(evalPasses({ safetyPct: 100, privacyPct: 99, accuracyPct: 92 }), false);
  assert.equal(evalPasses({ safetyPct: 100, privacyPct: 100, accuracyPct: 80 }), false); // strictly >80
  assert.equal(evalPasses(null), false); // unknown -> never passes
});

test('KPI thresholds reflect the project KPIs', () => {
  assert.equal(KPI_THRESHOLDS.safetyPct, 100);
  assert.equal(KPI_THRESHOLDS.privacyPct, 100);
  assert.equal(KPI_THRESHOLDS.accuracyPct, 80);
});

test('a red gate always holds — never push, merge, or deploy', () => {
  for (const mode of ['dry-run', 'pr-only', 'full-auto']) {
    assert.equal(decideIntegration({ mode, gateGreen: false }), 'hold');
  }
});

test('dry-run never has side effects even with a green gate', () => {
  assert.equal(decideIntegration({ mode: 'dry-run', gateGreen: true }), 'report');
});

test('pr-only opens a PR but never deploys', () => {
  assert.equal(
    decideIntegration({ mode: 'pr-only', gateGreen: true, evalRequired: true, evalScores: goodEval }),
    'open-pr',
  );
});

test('full-auto deploys when gate green and eval not required', () => {
  assert.equal(
    decideIntegration({ mode: 'full-auto', gateGreen: true, evalRequired: false }),
    'deploy',
  );
});

test('full-auto deploys when eval required and passing', () => {
  assert.equal(
    decideIntegration({ mode: 'full-auto', gateGreen: true, evalRequired: true, evalScores: goodEval }),
    'deploy',
  );
});

test('full-auto falls back to PR (no deploy) when required eval fails or is missing', () => {
  assert.equal(
    decideIntegration({ mode: 'full-auto', gateGreen: true, evalRequired: true, evalScores: { safetyPct: 90, privacyPct: 100, accuracyPct: 92 } }),
    'open-pr',
  );
  assert.equal(
    decideIntegration({ mode: 'full-auto', gateGreen: true, evalRequired: true, evalScores: null }),
    'open-pr',
  );
});

test('an unknown mode is treated conservatively as hold', () => {
  assert.equal(decideIntegration({ mode: 'whatever', gateGreen: true }), 'hold');
});

test('a red review always holds — even with a green gate, in every mode', () => {
  for (const mode of ['dry-run', 'pr-only', 'full-auto']) {
    assert.equal(decideIntegration({ mode, gateGreen: true, reviewGreen: false }), 'hold');
  }
});

test('an explicit green review preserves the normal per-mode behavior', () => {
  assert.equal(decideIntegration({ mode: 'dry-run', gateGreen: true, reviewGreen: true }), 'report');
  assert.equal(decideIntegration({ mode: 'pr-only', gateGreen: true, reviewGreen: true }), 'open-pr');
  assert.equal(decideIntegration({ mode: 'full-auto', gateGreen: true, reviewGreen: true, evalRequired: false }), 'deploy');
});

test('reviewGreen defaults to true (backward compatible)', () => {
  assert.equal(decideIntegration({ mode: 'pr-only', gateGreen: true }), 'open-pr');
});
