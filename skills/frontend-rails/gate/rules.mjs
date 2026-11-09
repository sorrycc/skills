// Runs inside the page (via page.evaluate) at one viewport width.
// Must stay self-contained: no imports, no outer variables.
export function audit({ width, type, bans }) {
  const out = [];
  const add = (id, sev, el, detail) => out.push({ id, sev, sel: el ? sel(el) : 'page', detail });
  const cs = (el) => getComputedStyle(el);
  const root = document.documentElement;

  function sel(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) return `${s}#${el.id}`;
    const cls = [...el.classList].slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    const p = el.parentElement;
    if (p && p !== document.body && p !== root) {
      const ps = p.id ? `#${p.id}` : p.tagName.toLowerCase() + (p.classList[0] ? '.' + p.classList[0] : '');
      s = `${ps} > ${s}`;
    }
    return s;
  }
  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = cs(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  }
  const ownText = (el) =>
    [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
  const snippet = (el) => {
    const t = el.textContent.trim().replace(/\s+/g, ' ');
    return t ? ` "${t.slice(0, 30)}${t.length > 30 ? '…' : ''}"` : '';
  };
  const firstFamily = (v) => v.split(',')[0].trim().replace(/["']/g, '');

  // Any CSS color string -> [r, g, b, a]
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = 1;
  const ctx = cvs.getContext('2d', { willReadFrequently: true });
  function rgba(str) {
    const m = str.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p[3] ?? 1];
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = str;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  }
  const fmt = (c) => `rgb(${c.slice(0, 3).map(Math.round).join(', ')})`;

  // ---- tokens: custom properties declared on :root / html / [data-theme]
  const names = new Set();
  let hasReducedMotion = false;
  const keyframes = {};
  (function walk(rules) {
    for (const r of rules) {
      if (r.media && /prefers-reduced-motion/.test(r.media.mediaText)) hasReducedMotion = true;
      if (r.type === 7) keyframes[r.name] = r; // CSSKeyframesRule
      if (r.selectorText && /:root|^html|\[data-theme/.test(r.selectorText)) {
        for (let i = 0; i < r.style.length; i++) if (r.style[i].startsWith('--')) names.add(r.style[i]);
      }
      if (r.cssRules && r.type !== 7) walk(r.cssRules);
    }
  })([...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } }));

  if (!cs(root).getPropertyValue('--bg').trim()) {
    add('R00', 'error', null, 'tokens.css not loaded: no --bg on :root. Link tokens.css before other CSS.');
    return out;
  }

  const T = { color: [], space: [], fs: [], radius: [], dur: [], ease: [], font: [] };
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  document.body.append(probe);
  for (const n of names) {
    const v = cs(root).getPropertyValue(n).trim();
    if (!v) continue;
    probe.removeAttribute('style');
    probe.style.cssText = 'position:absolute;visibility:hidden';
    if (n.startsWith('--space')) { probe.style.paddingLeft = `var(${n})`; T.space.push(parseFloat(cs(probe).paddingLeft)); }
    else if (n.startsWith('--fs')) { probe.style.fontSize = `var(${n})`; T.fs.push(parseFloat(cs(probe).fontSize)); }
    else if (n.startsWith('--radius')) { probe.style.borderTopLeftRadius = `var(${n})`; T.radius.push(parseFloat(cs(probe).borderTopLeftRadius)); }
    else if (n.startsWith('--dur')) T.dur.push(parseFloat(v) * (v.endsWith('ms') ? 1 : 1000));
    else if (n.startsWith('--ease')) { probe.style.transitionTimingFunction = `var(${n})`; T.ease.push(cs(probe).transitionTimingFunction); }
    else if (n.startsWith('--font')) T.font.push(firstFamily(v));
    else if (CSS.supports('color', v)) { probe.style.color = v; T.color.push(rgba(cs(probe).color)); }
  }
  probe.remove();
  const onScale = (v, scale, tol = 0.5) => scale.some((t) => Math.abs(Math.abs(v) - t) <= tol);
  const nearColor = (a, b) => Math.abs(a[0] - b[0]) <= 2 && Math.abs(a[1] - b[1]) <= 2 && Math.abs(a[2] - b[2]) <= 2;

  const els = [document.body, ...document.body.querySelectorAll('*')]
    .filter((e) => !['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'BR'].includes(e.tagName))
    .filter((e) => !(e.closest('svg') && e.tagName.toLowerCase() !== 'svg'))
    .slice(0, 5000)
    .filter(visible);

  // Group repeated findings: one line per (id, key) with a count.
  const groups = new Map();
  const group = (id, sev, key, el, detail) => {
    const g = groups.get(id + key);
    if (g) g.n++;
    else groups.set(id + key, { id, sev, el, detail, n: 1 });
  };

  for (const el of els) {
    const s = cs(el);
    const text = ownText(el);

    // R01 colors outside tokens
    const checkColor = (prop, val) => {
      const c = rgba(val);
      if (c[3] === 0 || T.color.some((t) => nearColor(c, t))) return;
      group('R01', 'error', prop + fmt(c), el, `${prop} ${fmt(c)} is not a token color`);
    };
    if (text) checkColor('color', s.color);
    checkColor('background', s.backgroundColor);
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(s[`border${side}Width`]) > 0) { checkColor('border', s[`border${side}Color`]); break; }
    }

    // R02 font families
    if (text) {
      const f = firstFamily(s.fontFamily);
      if (!T.font.includes(f)) group('R02', 'error', f, el, `font "${f}" is not a token font`);
    }

    // R03 gradient text
    if ((s.backgroundClip === 'text' || s.webkitBackgroundClip === 'text') && s.backgroundImage !== 'none')
      add('R03', 'error', el, 'gradient text (background-clip: text). Use a solid token color.');

    // R04 purple-blue gradient
    if (s.backgroundImage.includes('gradient')) {
      const hues = (s.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(rgba).filter((c) => c[3] > 0.1).map(hueSat).filter(([, sat]) => sat > 0.25).map(([h]) => h);
      if (hues.length >= 2 && hues.every((h) => h >= 200 && h <= 300) && hues.some((h) => h >= 250))
        add('R04', 'error', el, 'blue-purple gradient. Use a flat token color or the theme accent.');
    }

    // R12 spacing off the scale
    const sp = [['padding-top', s.paddingTop], ['padding-right', s.paddingRight], ['padding-bottom', s.paddingBottom], ['padding-left', s.paddingLeft],
      ['margin-top', s.marginTop], ['margin-bottom', s.marginBottom]];
    if (Math.abs(parseFloat(s.marginLeft) - parseFloat(s.marginRight)) >= 1) sp.push(['margin-left', s.marginLeft], ['margin-right', s.marginRight]);
    if (/flex|grid/.test(s.display)) sp.push(['row-gap', s.rowGap], ['column-gap', s.columnGap]);
    for (const [prop, raw] of sp) {
      const v = parseFloat(raw);
      if (!Number.isNaN(v) && Math.abs(v) > 2 && !onScale(v, T.space))
        group('R12', 'warn', prop + v, el, `${prop} ${v}px is not on the --space scale`);
    }

    // R13 font size off the scale
    if (text && !onScale(parseFloat(s.fontSize), T.fs))
      group('R13', 'error', s.fontSize, el, `font-size ${s.fontSize} is not on the --fs scale`);

    // R15 radius off scale (concentric check below)
    const rad = s.borderTopLeftRadius;
    if (!rad.endsWith('%') && parseFloat(rad) > 0 && !onScale(parseFloat(rad), T.radius))
      group('R15', 'warn', rad, el, `border-radius ${rad} is not on the --radius scale`);
  }

  function hueSat([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return [0, 0];
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const l = (max + min) / 2;
    return [(h * 60 + 360) % 360, d / (1 - Math.abs(2 * l - 1))];
  }

  // R05 card inside card
  const cardCache = new Map();
  const isCard = (el) => {
    if (cardCache.has(el)) return cardCache.get(el);
    const s = cs(el), r = el.getBoundingClientRect();
    const v = r.width >= 120 && r.height >= 60 && parseFloat(s.borderTopLeftRadius) > 0 &&
      ((parseFloat(s.borderTopWidth) > 0 && parseFloat(s.borderLeftWidth) > 0) || s.boxShadow !== 'none') &&
      !['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'IMG', 'A'].includes(el.tagName);
    cardCache.set(el, v);
    return v;
  };
  for (const el of els) {
    if (!isCard(el)) continue;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (isCard(a)) { group('R05', 'warn', sel(a), el, `card inside card (${sel(a)}). Drop the inner border/shadow.`); break; }
    }
  }

  // R06 small uppercase labels above headings
  const eyebrows = [...document.querySelectorAll('h1, h2')].filter(visible).map((h) => h.previousElementSibling).filter((p) => {
    if (!p || !visible(p)) return false;
    const t = p.textContent.trim(), s = cs(p);
    const hs = parseFloat(cs(p.nextElementSibling).fontSize);
    return t && t.length <= 40 && parseFloat(s.fontSize) <= hs * 0.6 &&
      (s.textTransform === 'uppercase' || parseFloat(s.letterSpacing) >= 0.05 * parseFloat(s.fontSize));
  });
  if (eyebrows.length > 2) add('R06', 'warn', eyebrows[0], `${eyebrows.length} small uppercase labels above headings. Keep at most 2.`);

  // R07 three identical icon+title+text cards in a row
  for (const el of els) {
    const kids = [...el.children].filter(visible);
    if (kids.length !== 3 || new Set(kids.map((k) => k.tagName)).size !== 1) continue;
    const rs = kids.map((k) => k.getBoundingClientRect());
    const sameRow = rs.every((r) => Math.abs(r.top - rs[0].top) < 2 && Math.abs(r.width - rs[0].width) < 2);
    const shaped = kids.every((k) => k.querySelector('svg, img, i, [class*="icon"]') && k.querySelector('h2, h3, h4, strong') && k.querySelector('p'));
    if (sameRow && shaped) add('R07', 'warn', el, 'three equal icon + title + text cards. Pick a different section pattern from the archetype.');
  }

  // R08 emoji used as icons
  const emoji = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/u;
  const emojiEls = [...document.querySelectorAll('button, a, h1, h2, h3, h4, h5, h6, li, th, label, summary, dt, [role="button"]')]
    .filter((e) => visible(e) && emoji.test(e.textContent));
  for (const e of emojiEls) {
    if (!emojiEls.some((o) => o !== e && e.contains(o))) add('R08', 'error', e, `emoji used as icon:${snippet(e)}. Use an SVG icon or plain text.`);
  }

  // R09 contrast
  function bgOf(el) {
    const stack = [];
    for (let a = el; a; a = a.parentElement) {
      const s = cs(a);
      if (s.backgroundImage !== 'none') return null;
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; }
    }
    let base = [255, 255, 255, 1];
    for (const c of stack.reverse()) base = blend(c, base);
    return base;
  }
  const blend = (c, b) => [0, 1, 2].map((i) => c[i] * c[3] + b[i] * (1 - c[3])).concat(1);
  const lum = (c) => {
    const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const el of els) {
    if (!ownText(el) || el.closest(':disabled, [aria-disabled="true"]')) continue;
    const s = cs(el), bg = bgOf(el);
    if (!bg) continue;
    const fg = blend(rgba(s.color), bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    const ratio = (a + 0.05) / (b + 0.05);
    const fs = parseFloat(s.fontSize), large = fs >= 24 || (fs >= 18.6 && +s.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5))
      group('R09', 'error', fmt(fg) + fmt(bg), el, `contrast ${ratio.toFixed(2)} (${fmt(fg)} on ${fmt(bg)}), needs ${large ? 3 : 4.5}`);
  }

  // R10 tap targets on phone widths
  if (width <= 480) {
    for (const el of document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"]')) {
      if (!visible(el)) continue;
      if (el.tagName === 'A') {
        const p = el.parentElement;
        if (el.closest('p') || (p && p.textContent.trim().length > el.textContent.trim().length + 3)) continue; // inline link in a sentence
      }
      const box = (/checkbox|radio/.test(el.type) && el.closest('label')) || el;
      const r = box.getBoundingClientRect(), m = Math.min(r.width, r.height);
      if (m < 24) add('R10', 'error', el, `tap target ${Math.round(r.width)}×${Math.round(r.height)}px (min 24, aim 44)${snippet(el)}`);
      else if (m < 44) group('R10', 'warn', sel(el), el, `tap target ${Math.round(r.width)}×${Math.round(r.height)}px, aim for 44`);
    }
  }

  // R11 horizontal overflow
  const cw = root.clientWidth;
  if (root.scrollWidth > cw + 1) {
    const clipped = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement)
        if (/auto|scroll|hidden|clip/.test(cs(a).overflowX)) return true;
      return false;
    };
    const culprits = els.filter((el) => el !== document.body && el.getBoundingClientRect().right > cw + 1 && !clipped(el));
    const top = culprits.filter((el) => !culprits.includes(el.parentElement)).slice(0, 5);
    if (!top.length) add('R11', 'error', null, `page scrollWidth ${root.scrollWidth} > ${cw}`);
    for (const el of top) add('R11', 'error', el, `overflows viewport: right edge ${Math.round(el.getBoundingClientRect().right)}px > ${cw}px`);
  }

  // R14 line length
  for (const el of els) {
    if (!/^(P|LI|DD|BLOCKQUOTE)$/.test(el.tagName) || el.textContent.trim().length < 160) continue;
    const s = cs(el);
    ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const ch = el.getBoundingClientRect().width / ctx.measureText('0').width;
    if (ch > 80) group('R14', 'warn', sel(el.parentElement), el, `line length ~${Math.round(ch)}ch, keep body text under 75ch (max-width: var(--measure))`);
  }

  // R15 nested corners not concentric
  for (const el of els) {
    const ps = cs(el), outer = parseFloat(ps.borderTopLeftRadius);
    if (!(outer > 0) || (rgba(ps.backgroundColor)[3] === 0 && !(parseFloat(ps.borderTopWidth) > 0))) continue;
    const pr = el.getBoundingClientRect();
    for (const c of el.children) {
      if (!visible(c)) continue;
      const inner = parseFloat(cs(c).borderTopLeftRadius);
      if (!(inner > 0)) continue;
      const r = c.getBoundingClientRect();
      const ix = Math.min(r.left - pr.left, pr.right - r.right), iy = Math.min(r.top - pr.top, pr.bottom - r.bottom);
      if (ix < 0 || iy < 0 || ix > 24 || iy > 24 || r.width < pr.width / 2) continue;
      const want = Math.max(0, outer - Math.min(ix, iy));
      if (inner > want + 2) group('R15', 'warn', sel(c), c, `inner radius ${inner}px inside ${outer}px with ${Math.round(Math.min(ix, iy))}px inset; use ~${Math.round(want)}px`);
    }
  }

  // R16 motion
  let anyMotion = false, staggered = 0;
  const layoutProp = /^(width|height|top|left|right|bottom|margin.*|padding.*|max-height|max-width|min-height|min-width)$/;
  const dur = (v) => parseFloat(v) * (v.trim().endsWith('ms') ? 1 : 1000);
  const easeList = (v) => v.match(/cubic-bezier\([^)]*\)|steps\([^)]*\)|linear\([^)]*\)|[a-z-]+/g) || [];
  for (const el of els) {
    const s = cs(el);
    const durs = s.transitionDuration.split(','), props = s.transitionProperty.split(',').map((p) => p.trim()), eases = easeList(s.transitionTimingFunction);
    for (let i = 0; i < Math.max(durs.length, props.length); i++) {
      const d = dur(durs[i % durs.length]), prop = props[i % props.length], ease = eases[i % eases.length];
      if (!(d > 0)) continue;
      anyMotion = true;
      if (d > 400) group('R16', 'error', 'long' + d, el, `transition ${prop} ${d}ms is longer than 400ms`);
      else if (!onScale(d, T.dur, 1)) group('R16', 'warn', 'dur' + d, el, `transition ${d}ms is not a --dur token`);
      if (layoutProp.test(prop)) group('R16', 'error', 'prop' + prop, el, `transition on ${prop}; animate transform/opacity instead`);
      if (prop === 'all') group('R16', 'warn', 'all', el, 'transition: all; list the properties (transform, opacity, color…)');
      if (ease && ease !== 'linear' && !T.ease.includes(ease)) group('R16', 'warn', 'ease' + ease, el, `easing ${ease} is not an --ease token`);
    }
    if (s.animationName !== 'none') {
      anyMotion = true;
      const d = dur(s.animationDuration.split(',')[0]);
      const infinite = s.animationIterationCount.includes('infinite');
      const r = el.getBoundingClientRect();
      if (infinite && (r.width > 64 || r.height > 64)) add('R16', 'warn', el, `infinite animation "${s.animationName}" on a large element; keep loops for spinners only`);
      if (!infinite && d > 400) add('R16', 'error', el, `animation "${s.animationName}" ${d}ms is longer than 400ms`);
      if (parseFloat(s.animationDelay) > 0) staggered++;
      for (const name of s.animationName.split(',').map((n) => n.trim())) {
        const kf = keyframes[name];
        if (!kf) continue;
        const ps = new Set([...kf.cssRules].flatMap((k) => [...k.style]));
        for (const p of ps) if (layoutProp.test(p)) group('R16', 'error', 'kf' + name + p, el, `@keyframes ${name} animates ${p}; use transform/opacity`);
      }
    }
  }
  for (const a of document.getAnimations()) {
    if (a instanceof CSSTransition || a instanceof CSSAnimation) continue;
    anyMotion = true;
    const t = a.effect.getTiming();
    if (t.iterations !== Infinity && t.duration > 400) add('R16', 'error', a.effect.target, `JS animation ${t.duration}ms is longer than 400ms`);
  }
  if (staggered >= 4) add('R16', 'warn', null, `${staggered} elements use staggered entrance animations; drop the page-load fly-in`);
  if (anyMotion && !hasReducedMotion) add('R16', 'error', null, 'page has motion but no @media (prefers-reduced-motion) rule');

  // R17 numbers in tables
  const cols = new Map();
  for (const td of document.querySelectorAll('td')) {
    const t = td.textContent.trim();
    if (!visible(td) || t.length > 20 || !/^[-+−]?[$€£¥]?\s?\d[\d,.\s]*(%|[kKmMbB])?$/.test(t)) continue;
    const s = cs(td), key = sel(td.closest('table')) + '#' + td.cellIndex;
    const problems = [];
    if (!s.fontVariantNumeric.includes('tabular-nums')) problems.push('tabular-nums');
    if (!/right|end/.test(s.textAlign)) problems.push('text-align: right');
    if (problems.length && !cols.has(key)) cols.set(key, [td, problems]);
  }
  for (const [td, problems] of cols.values()) add('R17', 'error', td, `numeric column ${td.cellIndex + 1} needs ${problems.join(' + ')} (use class="num")`);

  // R18 placeholder content
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    if (/lorem ipsum|dolor sit amet/i.test(n.textContent)) { add('R18', 'error', n.parentElement, 'lorem ipsum placeholder text'); break; }
  }
  for (const img of document.images) if (img.complete && img.naturalWidth === 0) add('R18', 'error', img, `broken image ${img.getAttribute('src') || '(no src)'}`);
  for (const a of document.querySelectorAll('a[href="#"], a[href=""], a[href^="javascript:"]')) group('R18', 'error', 'deadlink', a, 'dead link (href="#" or empty). Point it somewhere real or use a <button>.');

  // Project bans from DESIGN.md
  for (const prop of bans) {
    const hit = els.filter((el) => { const v = cs(el).getPropertyValue(prop); return v && !/^(none|normal|auto|0px|0s|initial)$/.test(v); });
    if (hit.length) add('BAN', 'error', hit[0], `${prop} is banned in DESIGN.md (${hit.length} elements)`);
  }

  for (const g of groups.values()) out.push({ id: g.id, sev: g.sev, sel: sel(g.el), detail: g.n > 1 ? `${g.detail} (${g.n} elements)` : g.detail });
  return out;
}
