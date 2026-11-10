// Installed in every page before its own scripts run (context.addInitScript).
// Gives the Node side (interact.mjs, states.mjs) a handle on the page: window.__gate.
// Must stay self-contained: no imports, no outer variables.
export function probe() {
  const clicks = new Set();
  const listen = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) {
    if (type === 'click' && this instanceof Element) clicks.add(this);
    return listen.call(this, type, ...rest);
  };
  const cs = (el) => getComputedStyle(el);
  const CONTROLS = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"])';
  const PRESS = 'button, [role="button"], .btn, input[type="submit"], input[type="button"]';
  const TRIGGERS = '[popovertarget], [commandfor], [aria-expanded], [aria-haspopup], summary, [role="tab"], [data-gate-click]';
  const STABLE = 'h1, h2, nav a, header a, header button, [role="toolbar"] > *, [data-stable]';
  const BUSY = '.skeleton, .spinner, [aria-busy="true"], [role="progressbar"]';
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  const G = (window.__gate = {
    clicks,
    sel(el) {
      let s = el.tagName.toLowerCase();
      if (el.id) return `${s}#${el.id}`;
      const cls = [...el.classList].slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      const t = el.textContent.trim().replace(/\s+/g, ' ');
      return t && t.length <= 24 ? `${s} "${t}"` : s;
    },
    visible(el) {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && cs(el).visibility !== 'hidden';
    },
    // Layout box, ignoring transforms: a press scale or hover lift is not a layout shift.
    box(el) {
      let x = 0, y = 0;
      for (let e = el; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
      return [x, y, el.offsetWidth, el.offsetHeight];
    },
    sig(el) {
      const s = cs(el);
      return ['transform', 'translate', 'scale', 'backgroundColor', 'color', 'boxShadow', 'opacity', 'borderTopColor', 'filter', 'outlineColor', 'outlineWidth', 'outlineStyle', 'textDecorationLine'].map((p) => s[p]).join('|');
    },
    list(q) {
      return [...document.querySelectorAll(q)].filter((e) => e instanceof HTMLElement && G.visible(e) && !e.disabled && !e.closest('[inert]'));
    },
    snap() {
      return G.tracked.map((e) => [...G.box(e), e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(cs(e).overflowX) ? 1 : 0]);
    },

    // ---- hover and press
    collect() {
      G.items = G.list(CONTROLS);
      // watched for movement: every control and everything that holds text
      G.tracked = [...document.body.querySelectorAll('*')]
        .filter((e) => e instanceof HTMLElement && e.offsetWidth > 0 && (e.matches(CONTROLS) || ownText(e))).slice(0, 1500);
      G.rest = new Map(G.items.map((e) => [e, G.sig(e)]));
      return G.items.map((e) => ({ sel: G.sel(e), press: e.matches(PRESS) }));
    },
    aim(i) {
      const el = G.items[i];
      if (!el.isConnected || !G.visible(el)) return null;
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (!el.contains(document.elementFromPoint(x, y))) return null; // covered, or an inline link wrapped over two lines
      G.before = G.snap();
      return { x, y };
    },
    hovered(i, x, y) {
      const el = G.items[i], after = G.snap(), moved = [], cut = [];
      G.tracked.forEach((e, k) => {
        const a = G.before[k], b = after[k];
        if (!a[2] || !b[2]) return; // appeared or went away: that's not a shift
        const d = [0, 1, 2, 3].map((j) => Math.round(b[j] - a[j]));
        if (d.some((v) => Math.abs(v) > 1)) moved.push(`${G.sel(e)} (x ${d[0]}, y ${d[1]}, w ${d[2]}, h ${d[3]})`);
        if (!a[4] && b[4]) cut.push(G.sel(e));
      });
      return { moved, cut, off: !el.contains(document.elementFromPoint(x, y)), sig: G.sig(el) };
    },

    // ---- click triggers
    open() {
      return [...document.querySelectorAll(':popover-open:not([popover="manual"]), dialog[open], [role="dialog"], [role="menu"], [role="listbox"]')].filter(G.visible);
    },
    triggers() { return G.list(TRIGGERS).map(G.sel); },
    arm(i) {
      const el = G.list(TRIGGERS)[i];
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (!el.contains(document.elementFromPoint(x, y))) return null;
      G.trig = el;
      G.trigBox = G.box(el);
      G.openBefore = G.open().length;
      G.running = new Set(document.getAnimations());
      G.mutated = false;
      new MutationObserver(() => { G.mutated = true; }).observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true });
      return { x, y };
    },
    // Freeze whatever is animating so it can be stepped through frame by frame.
    hold() {
      G.anims = document.getAnimations().filter((a) => !G.running.has(a) && a.effect && a.effect.getComputedTiming().endTime !== Infinity);
      let end = 0, others = 0;
      for (const a of G.anims) {
        a.pause();
        if (!/^(display|overlay)$/.test(a.transitionProperty || '')) end = Math.max(end, a.effect.getComputedTiming().endTime);
        if (a.effect.target && !G.trig.contains(a.effect.target)) others++;
      }
      const now = G.open().length, b = G.box(G.trig);
      return {
        end: Math.round(end),
        responded: G.mutated || now !== G.openBefore || others > 0,
        opened: now > G.openBefore,
        moved: Math.abs(b[0] - G.trigBox[0]) > 1 || Math.abs(b[1] - G.trigBox[1]) > 1,
      };
    },
    seek(t) {
      for (const a of G.anims) a.currentTime = Math.max(0, Math.min(t, a.effect.getComputedTiming().endTime - 1));
    },
    // Area to film: the trigger plus everything that animates, measured near the end state.
    clip() {
      const rects = [G.trig, ...G.anims.map((a) => a.effect.target), ...G.open()].filter((e) => e && e.isConnected).map((e) => e.getBoundingClientRect()).filter((r) => r.width);
      const l = Math.max(0, Math.min(...rects.map((r) => r.left)) - 24), t = Math.max(0, Math.min(...rects.map((r) => r.top)) - 24);
      const r = Math.min(innerWidth, Math.max(...rects.map((q) => q.right)) + 24), b = Math.min(innerHeight, Math.max(...rects.map((q) => q.bottom)) + 24);
      return { x: l, y: t, width: Math.max(1, r - l), height: Math.max(1, b - t) };
    },
    release() { for (const a of G.anims) { try { a.finish(); } catch { /* already gone */ } } },

    // ---- keyboard
    focused() {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return { sel: G.sel(el), known: G.rest.has(el), same: G.rest.get(el) === G.sig(el) };
    },

    // ---- view states
    stateNames() {
      return [...new Set([...document.querySelectorAll('[data-states]')].flatMap((r) => r.dataset.states.split(/[\s,]+/).filter(Boolean)))];
    },
    setState(name) {
      for (const r of document.querySelectorAll('[data-states]')) if (r.dataset.states.split(/[\s,]+/).includes(name)) r.dataset.state = name;
    },
    stateInfo() {
      const roots = [...document.querySelectorAll('[data-states]')];
      const scope = roots.length ? roots : [document.querySelector('main') || document.body];
      const inScope = (q) => scope.flatMap((r) => [...r.querySelectorAll(q)]).filter(G.visible);
      const firstWhen = document.querySelector('[data-when]');
      return {
        height: scope.reduce((h, r) => h + r.offsetHeight, 0),
        busy: inScope(BUSY).length,
        actions: inScope('button, a[href]').length,
        text: scope.map((r) => r.innerText.trim()).join(' ').length,
        stable: [...document.querySelectorAll(STABLE)].filter((e) => G.visible(e) && !e.closest('[data-when]')).map((e, i) => {
          const b = G.box(e);
          // Anything before the first swapped block (title, toolbar) must not move at all; below it, only sideways counts.
          const above = firstWhen ? !!(e.compareDocumentPosition(firstWhen) & Node.DOCUMENT_POSITION_FOLLOWING) : !!e.closest('header, nav, [data-stable]');
          return { key: `${i}:${G.sel(e)}`, sel: G.sel(e), x: b[0], y: above ? b[1] : null, w: b[2] };
        }),
      };
    },

    // ---- break pass: real content is longer than the mock-up
    spills() {
      const all = [...document.body.querySelectorAll('*')].filter((e) => e instanceof HTMLElement && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1);
      const out = new Map();
      for (const e of all) {
        const s = cs(e);
        if (s.overflowX === 'visible' && !all.some((o) => o !== e && e.contains(o))) out.set(e, 'spill');
        else if (/hidden|clip/.test(s.overflowX) && s.textOverflow !== 'ellipsis' && ownText(e)) out.set(e, 'cut');
      }
      return out;
    },
    stress() {
      const before = G.spills();
      for (const el of document.querySelectorAll('h1, h2, h3, h4, button, a, th, td, label, dt, dd, li, summary, .badge, .stat-value, .tab, [data-break]')) {
        for (const n of el.childNodes) {
          const t = n.nodeType === 3 ? n.textContent.trim() : '';
          if (!t) continue;
          // Labels double (a long translation); data also gets a word that can't wrap (an email, a URL, a surname).
          const data = el.matches('td, dd, li, .stat-value, [data-break]');
          n.textContent = /^[\s\d.,%$€£¥+−-]+$/.test(t) ? '9,999,999,999' : `${t} ${t}${data ? ' Featherstonehaughington' : ''}`;
        }
      }
      const cw = document.documentElement.clientWidth, found = [];
      if (document.documentElement.scrollWidth > cw + 1) {
        const wide = [...document.body.querySelectorAll('*')].filter((e) => {
          if (e.getBoundingClientRect().right <= cw + 1) return false;
          for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (/auto|scroll|hidden|clip/.test(cs(a).overflowX)) return false;
          return true;
        });
        for (const e of wide.filter((w) => !wide.some((o) => o !== w && w.contains(o))).slice(0, 3)) found.push(['K01', G.sel(e)]);
        if (!wide.length) found.push(['K01', 'page']);
      }
      for (const [e, kind] of G.spills()) if (!before.has(e)) found.push([kind === 'spill' ? 'K02' : 'K03', G.sel(e)]);
      return found;
    },

    // ---- hide secondary copy, to see whether the layout explains itself
    nocopy() {
      const muted = cs(document.documentElement).getPropertyValue('--text-muted').trim();
      const probe = document.body.appendChild(document.createElement('i'));
      probe.style.color = muted || 'inherit';
      const mutedRgb = muted && cs(probe).color;
      probe.remove();
      let n = 0;
      for (const el of document.body.querySelectorAll('*')) {
        if (!(el instanceof HTMLElement) || !ownText(el) || !G.visible(el)) continue;
        if (el.closest('th, label, button, a, nav, footer, .badge, .stat-label, .tab, [data-when]:not([data-when~="filled"])')) continue;
        const named = el.matches('.muted, .lead, .hint, small, [class*="subtitle"], [class*="description"], [class*="helper"], [class*="muted"], [class*="hint"]');
        if (named || cs(el).color === mutedRgb) { el.style.visibility = 'hidden'; n++; }
      }
      return n;
    },
  });
}
