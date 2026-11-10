// View states (loading / empty / error / …), the break pass and the no-copy screenshot.
// Everything in-page goes through window.__gate (probe.mjs).
import { join } from 'node:path';

const NEED = ['filled', 'loading', 'empty', 'error'];
const NICE = ['denied', 'offline', 'partial'];

// States come from data-states in the markup, or from "states:" in DESIGN.md / --states (then the page reads ?state=<name>).
export async function states(page, { load, url, type, urlStates, outDir, auditAt }) {
  const found = [], shots = [];
  const add = (id, sev, sel, detail) => found.push({ id, sev, sel, detail });
  await load();
  const declared = await page.evaluate(() => window.__gate.stateNames());
  const names = declared.length ? declared : urlStates;
  if (!names.length) {
    if (type === 'app') add('S01', 'error', 'page', 'no view states to check. Put data-states="filled loading empty error" on the view and data-when="…" on each state\'s block (archetypes/app.md), or list "states:" in DESIGN.md if the page reads ?state=.');
    return { found, shots };
  }
  if (type === 'app') {
    for (const n of NEED) if (!names.includes(n)) add('S01', 'error', 'page', `no "${n}" state. Every view needs filled, loading, empty and error.`);
    const skipped = NICE.filter((n) => !names.includes(n));
    if (skipped.length) add('S02', 'warn', 'page', `no ${skipped.join(' / ')} state. Add the ones this view can really hit (no permission, no network, some rows failed).`);
  }

  const withState = (name) => { const u = new URL(url); u.searchParams.set('state', name); return u.href; };
  const info = {};
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['filled', ...names.filter((n) => n !== 'filled')]) {
      if (!names.includes(name)) continue;
      if (declared.length) { await load(); await page.evaluate((n) => window.__gate.setState(n), name); } else await load(withState(name));
      await page.waitForTimeout(100);
      const shot = join(outDir, `state-${name}${width === 1440 ? '' : `-${width}`}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      shots.push(shot);
      if (name !== 'filled') await auditAt(width, `${width}/${name}`);
      if (width === 1440) info[name] = await page.evaluate(() => window.__gate.stateInfo());
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  const base = info.filled;
  for (const [name, s] of Object.entries(info)) {
    if (base && name !== 'filled') {
      const at = new Map(base.stable.map((e) => [e.key, e]));
      const moved = s.stable.filter((e) => { const b = at.get(e.key); return b && (Math.abs(b.x - e.x) > 1 || Math.abs(b.w - e.w) > 1 || (b.y !== null && e.y !== null && Math.abs(b.y - e.y) > 1)); });
      if (moved.length) add('S03', 'error', moved[0].sel, `moves or resizes between "filled" and "${name}"${moved.length > 1 ? ` (${moved.length} elements)` : ''}. Titles, nav and toolbars stay put while the content changes.`);
    }
    if (name === 'loading') {
      if (!s.busy) add('S04', 'warn', 'page', 'the loading state has no skeleton or spinner');
      if (base && base.height && Math.abs(s.height - base.height) / base.height > 0.4)
        add('S04', 'warn', 'page', `loading is ${s.height}px tall, filled is ${base.height}px, so the page jumps when data lands. Shape the skeleton like the content.`);
    }
    if (name === 'empty' && !s.actions) add('S05', 'warn', 'page', 'the empty state has no button or link. Tell a new user the first thing to do.');
    if (name === 'error') {
      if (!s.actions) add('S05', 'error', 'page', 'the error state offers no way forward. Add retry, and a way to report it.');
      if (s.text < 20) add('S05', 'warn', 'page', 'the error state does not say what went wrong');
    }
  }
  return { found, shots };
}

// Long names, long numbers, long words: does the layout hold?
export async function stress(page, { load, outDir }) {
  const found = [], shots = [];
  const msg = {
    K01: 'with longer content the page scrolls sideways. Let it wrap, or give it min-width: 0 and an ellipsis.',
    K02: 'with longer content its children stick out of the box. Let them wrap, or truncate with an ellipsis.',
    K03: 'with longer content the text is cut off with no ellipsis',
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await load();
    const hits = await page.evaluate(() => window.__gate.stress());
    const shot = join(outDir, `break-${width}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    shots.push(shot);
    for (const [id, sel] of hits) found.push({ id, sev: id === 'K03' ? 'warn' : 'error', sel, detail: msg[id], at: String(width) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  return { found, shots };
}

// Same page with the secondary text hidden. The reviewer says which of it anyone would miss.
export async function nocopy(page, { load, outDir }) {
  await load();
  const hidden = await page.evaluate(() => window.__gate.nocopy());
  if (!hidden) return [];
  const shot = join(outDir, '1440-nocopy.png');
  await page.screenshot({ path: shot, fullPage: true });
  return [shot];
}
