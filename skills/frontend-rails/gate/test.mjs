#!/usr/bin/env node
// Checks the gate against its own fixtures: the clean pages must pass, bad.html must trip every rule.
// Usage: node test.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const EVERY_RULE = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R20', 'BAN',
  'M01', 'M02', 'M03', 'M04', 'M05', 'M06',
  'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12', 'B13', 'B14',
  'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09',
  'S04', 'S05', 'K02'];

function gate(page, type, ...more) {
  const out = mkdtempSync(join(tmpdir(), 'gate-'));
  spawnSync(process.execPath, [join(here, 'run.mjs'), join(here, 'fixtures', page), '--type', type, '--out', out, ...more], { stdio: 'ignore' });
  return JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
}

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

for (const [page, type] of [['clean.html', 'landing'], ['app.html', 'app']]) {
  const r = gate(page, type);
  check(r.errors.length === 0, `${page} passes${r.errors.length ? `: ${r.errors.map((e) => `${e.id} ${e.sel}`).join('; ')}` : ''}`);
}
const bad = gate('bad.html', 'landing');
const seen = new Set([...bad.errors, ...bad.warnings].map((f) => f.id));
const missed = EVERY_RULE.filter((id) => !seen.has(id));
check(missed.length === 0, `bad.html trips every rule${missed.length ? `, except ${missed.join(', ')}` : ''}`);

// A page with no tokens.css is refused in build mode and read on its own terms with --audit.
const plain = gate('plain.html', 'app', '--audit');
const ids = new Set([...plain.errors, ...plain.warnings].map((f) => f.id));
check(!ids.has('R00') && ids.has('A01') && !ids.has('R01'), 'plain.html is checked in --audit mode without token rules');
check(gate('plain.html', 'app').errors.some((e) => e.id === 'R00'), 'plain.html without --audit stops at R00');

process.exit(failed ? 1 : 0);
