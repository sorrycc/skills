// Uses the page instead of looking at it: hover, press, click, Tab, wheel.
// Everything in-page goes through window.__gate (probe.mjs).
import { join } from 'node:path';

const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'trigger';

// Six frames of whatever is paused right now, from start to end.
async function film(page, end) {
  const clip = await page.evaluate(() => window.__gate.clip());
  const frames = [];
  for (let j = 0; j <= 5; j++) {
    const t = Math.round((end * j) / 5);
    await page.evaluate((ms) => window.__gate.seek(ms), t);
    frames.push([t, await page.screenshot({ clip })]);
  }
  return frames;
}

async function strip(context, rows, file) {
  const p = await context.newPage();
  const html = rows.map(([label, frames]) => `<div class="row"><b>${label}</b>${frames.map(([t, buf]) =>
    `<figure><img src="data:image/png;base64,${buf.toString('base64')}"><figcaption>${t}ms</figcaption></figure>`).join('')}</div>`).join('');
  await p.setContent(`<style>body{margin:0;padding:12px;background:#fff;color:#111;font:12px system-ui}.row{display:flex;gap:8px;align-items:flex-end;margin-bottom:12px}
    b{flex:0 0 40px}figure{margin:0;min-width:0}img{display:block;max-width:100%;border:1px solid #ccc}figcaption{padding-top:4px}</style>${html}`);
  await p.locator('body').screenshot({ path: file });
  await p.close();
}

export async function interact(page, { load, outDir }) {
  const found = [], shots = [];
  const add = (id, sev, sel, detail) => found.push({ id, sev, sel, detail });

  // ---- hover and press every control
  await load();
  const items = (await page.evaluate(() => window.__gate.collect())).slice(0, 40);
  for (let i = 0; i < items.length; i++) {
    await page.mouse.move(-1, -1);
    const pt = await page.evaluate((k) => window.__gate.aim(k), i);
    if (!pt) continue;
    await page.mouse.move(pt.x, pt.y);
    await page.waitForTimeout(150);
    const h = await page.evaluate(([k, x, y]) => window.__gate.hovered(k, x, y), [i, pt.x, pt.y]);
    const more = h.moved.length > 1 ? ` and ${h.moved.length - 1} more` : '';
    if (h.moved.length) add('B01', 'error', items[i].sel, `hovering it shifts the layout: ${h.moved[0]}${more}. Hover may change colour, never size or position.`);
    if (h.cut.length) add('B02', 'error', items[i].sel, `hovering it cuts off text in ${h.cut[0]}. Reserve the space for hover-only controls up front.`);
    if (h.off) add('B03', 'error', items[i].sel, 'on hover it moves out from under the pointer, so the click can miss');
    if (!items[i].press || h.off) continue;
    await page.mouse.down();
    await page.waitForTimeout(100);
    const pressed = await page.evaluate((k) => window.__gate.sig(window.__gate.items[k]), i);
    await page.mouse.move(-1, -1); // release off the button so nothing gets clicked
    await page.mouse.up();
    if (pressed === h.sig) add('B04', 'warn', items[i].sel, 'looks the same 100ms into a press. Add :active feedback (scale 0.97, or a darker fill).');
  }

  // ---- click things that open or switch something; film what moves
  const triggers = (await page.evaluate(() => window.__gate.triggers())).slice(0, 8);
  for (let i = 0; i < triggers.length; i++) {
    await load();
    const pt = await page.evaluate((k) => window.__gate.arm(k), i);
    if (!pt) continue;
    await page.mouse.click(pt.x, pt.y);
    await frame(page);
    let st = await page.evaluate(() => window.__gate.hold());
    if (!st.responded) {
      await page.evaluate(() => window.__gate.release());
      await page.waitForTimeout(100);
      st = await page.evaluate(() => window.__gate.hold());
      if (!st.responded) { add('B05', 'error', triggers[i], 'nothing changes within 100ms of the click. Show the result (or a pressed/loading state) at once.'); continue; }
    }
    if (st.moved) add('B06', 'error', triggers[i], 'the trigger itself moves when toggled. A state change must not shift what was just clicked.');
    const rows = [];
    if (st.end > 0) rows.push(['open', await film(page, st.end)]);
    await page.evaluate(() => window.__gate.release());
    await frame(page);
    if (st.opened) {
      await page.keyboard.press('Escape');
      await frame(page);
      const back = await page.evaluate(() => { const g = window.__gate, s = g.hold(); return { ...s, stillOpen: g.open().length > g.openBefore }; });
      if (back.stillOpen) add('B12', 'error', triggers[i], 'Escape does not close what it opened');
      else {
        if (back.end > 0) rows.push(['close', await film(page, back.end)]);
        if (st.end > 0 && back.end > st.end) add('M07', 'warn', triggers[i], `closes in ${back.end}ms but opens in ${st.end}ms. Exits should be the shorter of the two.`);
      }
    }
    if (rows.length) {
      const file = join(outDir, `motion-${i + 1}-${slug(triggers[i])}.png`);
      await strip(page.context(), rows, file);
      shots.push(file);
    }
  }

  // ---- Tab through the page
  await load();
  const count = (await page.evaluate(() => window.__gate.collect())).length;
  const blind = [];
  for (let i = 0; i < Math.min(count + 3, 50); i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => window.__gate.focused());
    if (!f) break;
    if (f.known && f.same && !blind.includes(f.sel)) blind.push(f.sel);
  }
  if (blind.length) add('B13', 'error', blind[0], `no visible focus ring when reached with Tab${blind.length > 1 ? ` (and ${blind.length - 1} more: ${blind.slice(1, 4).join(', ')})` : ''}`);
  const positive = await page.evaluate(() => [...document.querySelectorAll('[tabindex]')].filter((e) => e.tabIndex > 0).length);
  if (positive) add('B14', 'warn', 'page', `${positive} elements use tabindex above 0, which scrambles Tab order. Use 0 and fix the DOM order.`);

  // ---- wheel: the page must scroll when asked
  await load();
  const room = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  if (room > 500) {
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(250);
    const y = await page.evaluate(() => scrollY);
    if (y < 200) add('B09', 'error', 'page', `a 400px wheel scroll moved the page ${Math.round(y)}px. Don't hijack or smooth native scrolling.`);
  }
  return { found, shots };
}
