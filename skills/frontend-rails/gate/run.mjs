#!/usr/bin/env node
// Usage: node run.mjs <page.html|url> [--type landing|app|report] [--dark] [--out dir] [--design DESIGN.md]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { audit } from './rules.mjs';

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const target = args.find((a, i) => !a.startsWith('--') && !['--type', '--out', '--design'].includes(args[i - 1]));
if (!target) {
  console.log('usage: node run.mjs <page.html|url> [--type landing|app|report] [--dark] [--out dir] [--design DESIGN.md]');
  process.exit(2);
}
const isUrl = /^https?:\/\//.test(target);
const type = flag('--type', 'landing');
const pageDir = isUrl ? process.cwd() : dirname(resolve(target));
const outDir = resolve(flag('--out', join(pageDir, '.gate')));
const widths = [1440, 768, 390];
const schemes = args.includes('--dark') || type === 'report' ? ['light', 'dark'] : ['light'];

// DESIGN.md ```gate block: "ignore: R07", "ignore: R12 .hero", "ban: backdrop-filter"
function findDesign() {
  const given = flag('--design');
  if (given) return resolve(given);
  for (let d = pageDir; ; d = dirname(d)) {
    if (existsSync(join(d, 'DESIGN.md'))) return join(d, 'DESIGN.md');
    if (dirname(d) === d) return null;
  }
}
const designPath = findDesign();
const ignores = [], bans = [];
if (designPath) {
  const block = readFileSync(designPath, 'utf8').match(/```gate\n([\s\S]*?)```/);
  for (const line of block ? block[1].split('\n') : []) {
    const [k, ...rest] = line.replace(/#.*/, '').trim().split(/:\s*/);
    const v = rest.join(':').trim();
    if (k === 'ignore' && v) { const [id, ...s] = v.split(/\s+/); ignores.push({ id, sel: s.join(' ') }); }
    if (k === 'ban' && v) bans.push(v);
  }
}

let browser;
const launchArgs = ['--allow-file-access-from-files'];
try { browser = await chromium.launch({ args: launchArgs }); } catch { browser = await chromium.launch({ channel: 'chrome', args: launchArgs }); }
mkdirSync(outDir, { recursive: true });
const url = isUrl ? target : pathToFileURL(resolve(target)).href;
const merged = new Map();
const shots = [];

for (const scheme of schemes) {
  const context = await browser.newContext({ colorScheme: scheme, reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const tag = `${width}${scheme === 'dark' ? '-dark' : ''}`;
    const shot = join(outDir, `${tag}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    shots.push(shot);
    for (const f of await page.evaluate(audit, { width, type, bans })) {
      if (ignores.some((ig) => ig.id === f.id && (!ig.sel || f.sel.includes(ig.sel)))) continue;
      const key = `${f.id}|${f.sev}|${f.sel}|${f.detail}`;
      if (!merged.has(key)) merged.set(key, { ...f, at: [] });
      merged.get(key).at.push(tag);
    }
  }
  await context.close();
}
await browser.close();

const findings = [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
const errors = findings.filter((f) => f.sev === 'error');
const warns = findings.filter((f) => f.sev === 'warn');
writeFileSync(join(outDir, 'report.json'), JSON.stringify({ target, type, design: designPath, errors, warnings: warns, screenshots: shots }, null, 2));

const line = (f) => `  ${f.id} @${f.at.join(',')}  ${f.sel} — ${f.detail}`;
const print = (title, list) => {
  if (!list.length) return;
  console.log(title);
  const perRule = {};
  for (const f of list) {
    perRule[f.id] = (perRule[f.id] || 0) + 1;
    if (perRule[f.id] <= 6) console.log(line(f));
    else if (perRule[f.id] === 7) console.log(`  ${f.id} … more in report.json`);
  }
};
console.log(`gate: ${target} (${type}) — ${errors.length} errors, ${warns.length} warnings${designPath ? `, rules from ${designPath}` : ''}`);
print('ERRORS (must fix)', errors);
print('WARNINGS (fix if easy)', warns);
console.log(`screenshots: ${outDir}/{${shots.map((s) => s.split('/').pop().replace('.png', '')).join(',')}}.png`);
console.log(`report: ${join(outDir, 'report.json')}`);
console.log(errors.length ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(errors.length ? 1 : 0);
