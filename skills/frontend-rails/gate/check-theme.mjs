#!/usr/bin/env node
// Checks text/background pairs in a theme's tokens.css (light and dark).
// Usage: node check-theme.mjs <tokens.css>...
import { readFileSync } from 'node:fs';

const PAIRS = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'], ['text', 'accent-subtle'],
  ['text-muted', 'bg'], ['text-muted', 'surface'],
  ['link', 'bg'], ['link', 'surface'],
  ['accent-contrast', 'accent'], ['accent-contrast', 'accent-hover'],
  ['success', 'success-subtle'], ['warning', 'warning-subtle'], ['danger', 'danger-subtle'], ['info', 'info-subtle'],
  ['success', 'surface'], ['warning', 'surface'], ['danger', 'surface'], ['info', 'surface'],
];
const vars = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,8})/gi)].map((m) => [m[1], m[2]]));
const lum = (hex) => {
  const h = hex.slice(1), n = h.length === 3 ? h.split('').map((x) => x + x) : h.match(/../g);
  const [r, g, b] = n.slice(0, 3).map((x) => { const v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

let failed = 0;
for (const file of process.argv.slice(2)) {
  const css = readFileSync(file, 'utf8');
  const light = vars(css.match(/:root\s*\{([\s\S]*?)\n\}/)[1]);
  const dark = vars(css.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] || '');
  for (const [mode, v] of [['light', light], ['dark', dark]]) {
    for (const [fg, bg] of PAIRS) {
      if (!v[fg] || !v[bg]) continue;
      const r = ratio(v[fg], v[bg]);
      if (r < 4.5) { failed++; console.log(`${file} ${mode}: --${fg} on --${bg} = ${r.toFixed(2)} (needs 4.5)`); }
    }
  }
}
console.log(failed ? `${failed} pairs below 4.5` : 'all pairs pass 4.5');
process.exit(failed ? 1 : 0);
