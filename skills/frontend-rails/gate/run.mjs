#!/usr/bin/env node
// Usage: node run.mjs <page.html|url> [--type landing|app|report] [--dark] [--audit] [--states a,b]
//                     [--no-interact] [--no-break] [--out dir] [--design DESIGN.md]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { audit } from './rules.mjs';
import { probe } from './probe.mjs';
import { interact } from './interact.mjs';
import { nocopy, states, stress } from './states.mjs';

const USAGE = 'usage: node run.mjs <page.html|url> [--type landing|app|report] [--dark] [--audit] [--states a,b] [--no-interact] [--no-break] [--out dir] [--design DESIGN.md]';
const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const target = args.find((a, i) => !a.startsWith('--') && !['--type', '--out', '--design', '--states'].includes(args[i - 1]));
if (!target) {
  console.log(USAGE);
  process.exit(2);
}
const isUrl = /^https?:\/\//.test(target);
const type = flag('--type', 'landing');
const pageDir = isUrl ? process.cwd() : dirname(resolve(target));
const outDir = resolve(flag('--out', join(pageDir, '.gate')));
const widths = [1440, 768, 390];
const schemes = args.includes('--dark') || type === 'report' ? ['light', 'dark'] : ['light'];

// DESIGN.md ```gate block, one rule per line:
//   ignore: R07 .pricing        skip a rule (optionally only where the selector matches)
//   ban: backdrop-filter        any use of a property is an error; "ban: text-transform: uppercase" bans one value
//   ban-text: Get started       this wording is an error
//   verb: delete                the one word for that action; its synonyms become errors
//   freq: constant .palette     how often it's seen (constant | often); decides whether it may animate
//   states: loading empty error states the page shows for ?state=<name> (when it has no data-states markup)
function findDesign() {
  const given = flag('--design');
  if (given) return resolve(given);
  for (let d = pageDir; ; d = dirname(d)) {
    if (existsSync(join(d, 'DESIGN.md'))) return join(d, 'DESIGN.md');
    if (dirname(d) === d) return null;
  }
}
const designPath = findDesign();
const ignores = [], bans = [], banText = [], verbs = [], freq = [];
let urlStates = (flag('--states', '') || '').split(/[\s,]+/).filter(Boolean);
if (designPath) {
  const block = readFileSync(designPath, 'utf8').match(/```gate\n([\s\S]*?)```/);
  for (const line of block ? block[1].split('\n') : []) {
    const [k, ...rest] = line.replace(/(^|\s)#(\s.*)?$/, '').trim().split(/:\s*/);
    const v = rest.join(':').trim();
    if (!v) continue;
    if (k === 'ignore') { const [id, ...s] = v.split(/\s+/); ignores.push({ id, sel: s.join(' ') }); }
    if (k === 'ban') bans.push(v);
    if (k === 'ban-text') banText.push(v);
    if (k === 'verb') verbs.push(v.toLowerCase());
    if (k === 'freq') { const [level, ...s] = v.split(/\s+/); if (s.length) freq.push({ level, sel: s.join(' ') }); }
    if (k === 'states' && !urlStates.length) urlStates = v.split(/[\s,]+/).filter(Boolean);
  }
}
const opts = { type, bans, banText, verbs, freq, audit: args.includes('--audit') };

let browser;
const launchArgs = ['--allow-file-access-from-files'];
try { browser = await chromium.launch({ args: launchArgs }); } catch { browser = await chromium.launch({ channel: 'chrome', args: launchArgs }); }
mkdirSync(outDir, { recursive: true });
const url = isUrl ? target : pathToFileURL(resolve(target)).href;
const merged = new Map();
const shots = [], extra = [];

const record = (list, tag) => {
  for (const f of list) {
    if (ignores.some((ig) => ig.id === f.id && (!ig.sel || f.sel.includes(ig.sel)))) continue;
    const key = `${f.id}|${f.sev}|${f.sel}|${f.detail}`;
    if (merged.has(key) && tag.includes('/')) continue; // already seen on the plain page; a state adds nothing
    if (!merged.has(key)) merged.set(key, { id: f.id, sev: f.sev, sel: f.sel, detail: f.detail, at: [] });
    const at = f.at || tag;
    if (!merged.get(key).at.includes(at)) merged.get(key).at.push(at);
  }
};
const open = async (scheme, reducedMotion = 'no-preference') => {
  const context = await browser.newContext({ colorScheme: scheme, reducedMotion, viewport: { width: 1440, height: 900 } });
  await context.addInitScript(probe);
  const page = await context.newPage();
  const load = async (to = url) => {
    await page.goto(to, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
  };
  return { context, page, load };
};

// 1. How it looks: every width, light and dark
for (const scheme of schemes) {
  const { context, page, load } = await open(scheme);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await load();
    const tag = `${width}${scheme === 'dark' ? '-dark' : ''}`;
    const shot = join(outDir, `${tag}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    shots.push(shot);
    record(await page.evaluate(audit, { ...opts, width }), tag);
  }
  await context.close();
}

// 2. Reduced motion: fades may stay, movement may not
{
  const { context, page, load } = await open('light', 'reduce');
  await load();
  record(await page.evaluate(audit, { ...opts, width: 1440, reduced: true }), 'reduced-motion');
  await context.close();
}

// 3. How it behaves: states, long content, then hands on
{
  const { context, page, load } = await open('light');
  const auditAt = async (width, tag) => record(await page.evaluate(audit, { ...opts, width }), tag);
  const run = async (step, tag) => { const r = await step; record(r.found, tag); extra.push(...r.shots); };
  await run(states(page, { load, url, type, urlStates, outDir, auditAt }), 'states');
  extra.push(...await nocopy(page, { load, outDir }));
  if (!args.includes('--no-break')) await run(stress(page, { load, outDir }), 'break');
  if (!args.includes('--no-interact')) await run(interact(page, { load, outDir }), 'interact');
  await context.close();
}
await browser.close();

const findings = [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
const errors = findings.filter((f) => f.sev === 'error');
const warns = findings.filter((f) => f.sev === 'warn');
writeFileSync(join(outDir, 'report.json'), JSON.stringify({ target, type, design: designPath, errors, warnings: warns, screenshots: shots, extra }, null, 2));

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
const names = (list) => list.map((s) => s.split('/').pop().replace('.png', '')).join(',');
console.log(`gate: ${target} (${type}${opts.audit ? ', audit' : ''}) — ${errors.length} errors, ${warns.length} warnings${designPath ? `, rules from ${designPath}` : ''}`);
print('ERRORS (must fix)', errors);
print('WARNINGS (fix if easy)', warns);
console.log(`screenshots: ${outDir}/{${names(shots)}}.png`);
if (extra.length) console.log(`states, motion strips, break, no-copy: ${outDir}/{${names(extra)}}.png`);
console.log(`report: ${join(outDir, 'report.json')}`);
console.log(errors.length ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(errors.length ? 1 : 0);
