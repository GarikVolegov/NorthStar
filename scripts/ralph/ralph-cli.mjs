#!/usr/bin/env node
// Thin CLI glue over the tested loop logic. The iteration brain calls these
// subcommands so selection and the deploy decision stay DETERMINISTIC (and
// unit-tested in lib/*.test.mjs) instead of being left to in-prompt judgement.
//
// Usage:
//   node scripts/ralph/ralph-cli.mjs status
//   node scripts/ralph/ralph-cli.mjs next                # JSON of the next item (or null)
//   node scripts/ralph/ralph-cli.mjs mode                # current rollout mode
//   node scripts/ralph/ralph-cli.mjs decide --gate green [--eval-required] [--eval-file f.json]
//   node scripts/ralph/ralph-cli.mjs journal-path        # today's journal file path

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { selectNextItem, summarize } from './lib/backlog.mjs';
import { decideIntegration } from './lib/deploy-gate.mjs';
import { isStopped } from './lib/safety.mjs';
import { journalPathFor } from './lib/journal.mjs';
import { renderCheckpoint } from './lib/checkpoint.mjs';
import { reviewPanel } from './lib/review-panel.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);

const config = readJson(join(DIR, 'loop.config.json'), { mode: 'dry-run', maxFailures: 3 });
const backlog = readJson(join(DIR, 'backlog.json'), { items: [] });
const items = backlog.items ?? [];

function flag(name) {
  return process.argv.includes(`--${name}`);
}
function opt(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const cmd = process.argv[2];

switch (cmd) {
  case 'status': {
    const s = summarize(items);
    const stopped = isStopped(DIR);
    const next = selectNextItem(items);
    console.log(`Ralph loop status`);
    console.log(`  mode:    ${config.mode}`);
    console.log(`  STOP:    ${stopped ? 'PRESENT — loop is paused' : 'absent — loop may run'}`);
    console.log(`  backlog: ${s.total} items (${JSON.stringify(s.byStatus)})`);
    console.log(`  next:    ${next ? `${next.id} [${next.type}/${next.priority}] ${next.title}` : '(none in todo)'}`);
    break;
  }
  case 'next': {
    console.log(JSON.stringify(selectNextItem(items), null, 2));
    break;
  }
  case 'mode': {
    console.log(config.mode);
    break;
  }
  case 'decide': {
    const gateGreen = opt('gate') === 'green';
    const evalRequired = flag('eval-required');
    const evalFile = opt('eval-file');
    const evalScores = evalFile ? readJson(evalFile, null) : null;
    const reviewGreen = opt('review') !== 'red'; // absent or 'green' => green; only 'red' blocks
    const decision = decideIntegration({ mode: config.mode, gateGreen, reviewGreen, evalRequired, evalScores });
    console.log(decision);
    break;
  }
  case 'journal-path': {
    console.log(journalPathFor(new Date(), DIR));
    break;
  }
  case 'checkpoint': {
    const findItem = (id) => items.find((i) => i.id === id) ?? (id ? { id } : null);
    const s = summarize(items);
    const pushOpt = opt('push');
    console.log(
      renderCheckpoint({
        iter: Number(opt('iter') ?? 0),
        max: Number(opt('max') ?? config.maxIterations ?? 12),
        item: findItem(opt('item')),
        result: opt('result') ?? '—',
        gate: opt('gate') ?? null,
        decision: opt('decision') ?? null,
        commit: opt('commit') ?? null,
        pushed: pushOpt == null ? null : pushOpt === 'yes',
        failures: Number(opt('failures') ?? 0),
        maxFailures: Number(opt('max-failures') ?? config.maxFailures ?? 3),
        next: selectNextItem(items),
        byStatus: s.byStatus,
        mode: config.mode,
      }),
    );
    break;
  }
  case 'review-panel': {
    const codeOpt = opt('code');
    console.log(
      JSON.stringify(
        reviewPanel({
          type: opt('type'),
          area: opt('area'),
          hasCodeChange: codeOpt == null ? true : codeOpt !== 'false',
        }),
      ),
    );
    break;
  }
  case 'config': {
    const key = process.argv[3];
    const val = config[key];
    if (val === undefined) process.exit(1);
    console.log(typeof val === 'object' ? JSON.stringify(val) : String(val));
    break;
  }
  default:
    console.error(`Unknown command: ${cmd ?? '(none)'}`);
    console.error(`Commands: status | next | mode | decide | journal-path | checkpoint | review-panel | config`);
    process.exit(2);
}
