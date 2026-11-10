#!/usr/bin/env node
// Puts variants of one page side by side so the user can pick: gate result plus desktop and phone screenshots for each.
// Usage: node compare.mjs a.html b.html c.html [--type landing|app|report] [--out dir]
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const pages = args.filter((a, i) => !a.startsWith('--') && !['--type', '--out'].includes(args[i - 1]));
if (pages.length < 2) {
  console.log('usage: node compare.mjs a.html b.html c.html [--type landing|app|report] [--out dir]');
  process.exit(2);
}
const type = flag('--type', 'landing');
const outDir = resolve(flag('--out', join(dirname(resolve(pages[0])), '.gate', 'compare')));
mkdirSync(outDir, { recursive: true });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const cols = pages.map((page, i) => {
  const name = String.fromCharCode(65 + i), dir = join(outDir, name);
  spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'run.mjs'), page, '--type', type, '--out', dir], { stdio: 'ignore' });
  const r = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
  console.log(`${name}  ${page} — ${r.errors.length} errors, ${r.warnings.length} warnings`);
  return `<section><h2>${name} <small>${esc(basename(page))}</small></h2>
    <p>${r.errors.length} errors, ${r.warnings.length} warnings</p>
    <ul>${r.errors.slice(0, 5).map((e) => `<li>${esc(e.id)} ${esc(e.detail)}</li>`).join('')}</ul>
    <a href="${name}/1440.png"><img src="${name}/1440.png" alt="${name} at 1440px"></a>
    <a href="${name}/390.png"><img class="phone" src="${name}/390.png" alt="${name} at 390px"></a></section>`;
});

const file = join(outDir, 'compare.html');
writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>Variants</title>
<style>
  body { margin: 0; padding: 24px; font: 14px/1.5 system-ui, sans-serif; color: #111; background: #f4f4f2; }
  main { display: grid; grid-template-columns: repeat(${pages.length}, minmax(0, 1fr)); gap: 24px; align-items: start; }
  h2 { margin: 0; font-size: 20px; } small { font-weight: 400; color: #666; font-size: 14px; }
  p { margin: 4px 0; } ul { margin: 0 0 12px; padding-left: 18px; color: #666; font-size: 12px; }
  img { display: block; width: 100%; border: 1px solid #ccc; margin-bottom: 12px; background: #fff; } img.phone { width: 45%; }
  @media (max-width: 800px) { main { grid-template-columns: 1fr; } }
</style>
<main>${cols.join('\n')}</main>`);
console.log(`compare: ${file}`);
