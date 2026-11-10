// Runs inside the page (via page.evaluate) at one viewport width.
// Must stay self-contained: no imports, no outer variables.
// Rule ids: R = looks, M = motion, B = behaviour, C = copy, A = audit-mode inventory.
export function audit({ width, type, bans = [], audit: auditMode = false, reduced = false, freq = [], verbs = [], banText = [] }) {
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
  const cssFlags = []; // [id, sev, detail] found while walking the stylesheets
  const scaleSels = []; // selectors that scale something (a closed popover has no computed transform to read)
  const zeroScale = (st) => /scale\(\s*0(\.0+)?\s*[,)]/.test(st.transform) || /^0(\.0+)?(\s|$)/.test(st.scale);
  (function walk(rules, starting) {
    for (const r of rules) {
      if (r.media && /prefers-reduced-motion/.test(r.media.mediaText)) hasReducedMotion = true;
      if (r.type === 7) { // CSSKeyframesRule
        keyframes[r.name] = r;
        const first = [...r.cssRules].find((k) => k.keyText === '0%');
        if (first && zeroScale(first.style)) cssFlags.push(['M03', 'error', `@keyframes ${r.name} starts at scale(0). Nothing appears from nothing: start at scale(0.95) with opacity 0.`]);
      }
      if (r.selectorText) {
        if (/scale\(/.test(r.style.transform) || r.style.scale) scaleSels.push(r.selectorText.replace(/:popover-open/g, ''));
        if (starting && zeroScale(r.style)) cssFlags.push(['M03', 'error', `${r.selectorText} enters from scale(0). Start at scale(0.95) with opacity 0.`]);
        if (/:(hover|active|focus)/.test(r.selectorText) && !r.selectorText.includes(':has(') && r.style.animationName && r.style.animationName !== 'none')
          cssFlags.push(['M04', 'warn', `${r.selectorText} runs @keyframes ${r.style.animationName}; keyframes can't be interrupted half-way. Use a transition for interactive states.`]);
        if (/:root|^html|\[data-theme/.test(r.selectorText)) {
          for (let i = 0; i < r.style.length; i++) if (r.style[i].startsWith('--')) names.add(r.style[i]);
        }
      }
      if (r.cssRules && r.type !== 7) walk(r.cssRules, starting || r.constructor.name === 'CSSStartingStyleRule');
    }
  })([...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } }), false);

  if (!cs(root).getPropertyValue('--bg').trim() && !auditMode) {
    add('R00', 'error', null, 'tokens.css not loaded: no --bg on :root. Link tokens.css before other CSS, or pass --audit to check a page that was not built on these tokens.');
    return out;
  }

  // Tokens are recognised by value and name, so the page's own names work in --audit mode
  // (--spacing, --text-sm, --rounded-*, --duration-*, --color-*).
  const T = { color: [], space: [], fs: [], radius: [], dur: [], ease: [], font: [] };
  const lenRe = /^-?[\d.]+(px|rem|em)$|^(clamp|calc|min|max)\(/;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  document.body.append(probe);
  for (const n of names) {
    const v = cs(root).getPropertyValue(n).trim();
    if (!v || /line-height|leading|tracking|weight/.test(n)) continue;
    probe.removeAttribute('style');
    probe.style.cssText = 'position:absolute;visibility:hidden';
    if (CSS.supports('color', v)) { probe.style.color = v; T.color.push(rgba(cs(probe).color)); }
    else if (/^--(space|spacing)/.test(n) && lenRe.test(v)) { probe.style.paddingLeft = `var(${n})`; T.space.push(parseFloat(cs(probe).paddingLeft)); }
    else if (/^--(fs|font-size|text)/.test(n) && lenRe.test(v)) { probe.style.fontSize = `var(${n})`; T.fs.push(parseFloat(cs(probe).fontSize)); }
    else if (/^--(radius|rounded)/.test(n) && lenRe.test(v)) { probe.style.borderTopLeftRadius = `var(${n})`; T.radius.push(parseFloat(cs(probe).borderTopLeftRadius)); }
    else if (/^--(dur|duration)|duration$/.test(n) && /^[\d.]+m?s$/.test(v)) T.dur.push(parseFloat(v) * (v.endsWith('ms') ? 1 : 1000));
    else if (/^--ease/.test(n)) { probe.style.transitionTimingFunction = `var(${n})`; T.ease.push(cs(probe).transitionTimingFunction); }
    else if (/^--font/.test(n) && !/^[\d.]/.test(v)) T.font.push(firstFamily(v));
  }
  probe.remove();
  const has = (k) => T[k].length > 0; // a scale the page doesn't declare can't be checked
  const onScale = (v, scale, tol = 0.5) => scale.some((t) => Math.abs(Math.abs(v) - t) <= tol);
  // One --spacing base (Tailwind) means "any half-step multiple of it".
  const spaceOk = (v) => {
    if (T.space.length !== 1) return onScale(v, T.space);
    const half = T.space[0] / 2, m = Math.abs(v) % half;
    return m < 0.5 || half - m < 0.5;
  };
  const dur = (v) => parseFloat(v) * (v.trim().endsWith('ms') ? 1 : 1000);
  for (const [id, sev, detail] of cssFlags) add(id, sev, null, detail);
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
  const flush = () => {
    for (const g of groups.values()) out.push({ id: g.id, sev: g.sev, sel: sel(g.el), detail: g.n > 1 ? `${g.detail} (${g.n} elements)` : g.detail });
    return out;
  };
  const motionEls = [...new Set([...els, ...document.querySelectorAll('[popover], dialog')])];
  const moving = /transform|translate|scale|rotate|filter|^all$|width|height|top|left|right|bottom|margin|inset/;

  // Reduced-motion pass (the page was loaded with prefers-reduced-motion: reduce): fades may stay, movement may not.
  if (reduced) {
    out.length = 0;
    for (const el of motionEls) {
      const s = cs(el);
      const durs = s.transitionDuration.split(','), props = s.transitionProperty.split(',').map((p) => p.trim());
      for (let i = 0; i < Math.max(durs.length, props.length); i++) {
        const prop = props[i % props.length];
        if (dur(durs[i % durs.length]) > 1 && moving.test(prop))
          group('M06', 'error', prop, el, `still transitions ${prop} under prefers-reduced-motion. Keep opacity and colour fades, drop movement and scale.`);
      }
      const r = el.getBoundingClientRect();
      if (s.animationName === 'none' || dur(s.animationDuration.split(',')[0]) <= 1 || Math.max(r.width, r.height) <= 32 || el.matches('.spinner, [role="progressbar"]')) continue;
      for (const name of s.animationName.split(',').map((n) => n.trim())) {
        const kf = keyframes[name];
        if (kf && [...kf.cssRules].some((k) => [...k.style].some((p) => moving.test(p))))
          group('M06', 'error', name, el, `@keyframes ${name} still moves under prefers-reduced-motion. Swap it for a fade.`);
      }
    }
    return flush();
  }

  const sizes = new Map(), inv = { radius: new Set(), color: new Set(), font: new Set(), dur: new Set() };
  for (const el of els) {
    const s = cs(el);
    const text = ownText(el);
    if (text) {
      const px = Math.round(parseFloat(s.fontSize) * 2) / 2;
      if (!sizes.has(px)) sizes.set(px, el);
      inv.color.add(fmt(rgba(s.color)));
      inv.font.add(firstFamily(s.fontFamily));
    }

    // R01 colors outside tokens
    const checkColor = (prop, val) => {
      const c = rgba(val);
      if (!has('color') || c[3] === 0 || T.color.some((t) => nearColor(c, t))) return;
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
      if (has('font') && !T.font.includes(f)) group('R02', 'error', f, el, `font "${f}" is not a token font`);
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
      if (has('space') && !Number.isNaN(v) && Math.abs(v) > 2 && !spaceOk(v))
        group('R12', 'warn', prop + v, el, `${prop} ${v}px is not on the --space scale`);
    }

    // R13 font size off the scale
    if (has('fs') && text && !onScale(parseFloat(s.fontSize), T.fs))
      group('R13', 'error', s.fontSize, el, `font-size ${s.fontSize} is not on the --fs scale`);

    // R15 radius off scale (concentric check below)
    const rad = s.borderTopLeftRadius;
    if (!rad.endsWith('%') && parseFloat(rad) > 0) {
      if (parseFloat(rad) < 999) inv.radius.add(rad);
      if (has('radius') && !onScale(parseFloat(rad), T.radius)) group('R15', 'warn', rad, el, `border-radius ${rad} is not on the --radius scale`);
    }

    // R20 flat by default: lift, glow and glass are for layers that really float
    const floating = /fixed|absolute|sticky/.test(s.position) || el.closest('[popover], dialog, [role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"]');
    if (s.boxShadow !== 'none') {
      for (const part of s.boxShadow.split(/,(?![^(]*\))/)) {
        if (part.includes('inset')) continue;
        const px = (part.replace(/[a-z-]+\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
        const c = rgba((part.match(/[a-z-]+\([^)]*\)/) || ['rgb(0,0,0)'])[0]);
        if (px[2] >= 12 && c[3] > 0.2 && hueSat(c)[1] > 0.4) group('R20', 'warn', 'glow', el, 'coloured glow (saturated box-shadow). Drop it.');
        else if (px[2] > 8 && !floating) group('R20', 'warn', 'lift', el, `box-shadow with ${px[2]}px blur on an element that sits in the page. Keep shadows for menus, dialogs and toasts.`);
      }
    }
    if (s.backdropFilter && s.backdropFilter !== 'none') group('R20', 'warn', 'glass', el, 'backdrop-filter (frosted glass). Use a solid --surface.');
  }

  // R19 too many type sizes on one page
  const sizeCap = type === 'app' ? 5 : 6;
  if (width >= 1024 && sizes.size > sizeCap)
    add('R19', 'warn', [...sizes.values()].pop(), `${sizes.size} font sizes on the page (${[...sizes.keys()].sort((a, b) => a - b).join(', ')}px); keep it to ${sizeCap}`);

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
  const easeList = (v) => v.match(/cubic-bezier\([^)]*\)|steps\([^)]*\)|linear\([^)]*\)|[a-z-]+/g) || [];
  const easeIn = (e) => {
    if (e === 'ease-in') return true;
    const m = e.match(/^cubic-bezier\(([^)]+)\)$/);
    if (!m) return false;
    const [x1, y1, x2] = m[1].split(',').map(Number);
    return y1 <= 0.05 && x1 >= 0.3 && x2 >= 0.6;
  };
  // How often people see it decides whether it may move at all: data-freq in the markup, "freq:" lines in DESIGN.md,
  // and a guess for list rows, options and tabs.
  const colorish = /^(opacity|color|background(-color)?|border(-\w+)*-color|outline-color|box-shadow|fill|stroke|text-decoration-color|display|overlay|visibility)$/;
  const freqOf = (el) => {
    const a = el.closest('[data-freq]');
    if (a) return [a.dataset.freq, 'error'];
    for (const f of freq) { try { if (el.closest(f.sel)) return [f.level, 'error']; } catch { /* bad selector in DESIGN.md */ } }
    return el.matches('[role="option"], [role="menuitem"], [role="row"], tbody tr, [role="tab"], .menu-item') ? ['often', 'warn'] : null;
  };
  for (const el of motionEls) {
    const s = cs(el);
    const limit = el.closest('.drawer, [data-motion="drawer"]') ? 500 : 300;
    const fq = freqOf(el);
    if (fq && fq[0] === 'constant' && s.animationName !== 'none') group('M01', 'error', 'anim', el, `animation "${s.animationName}" in a part marked constant (seen 100+ times a day). Make it instant.`);
    const durs = s.transitionDuration.split(','), props = s.transitionProperty.split(',').map((p) => p.trim()), eases = easeList(s.transitionTimingFunction);
    for (let i = 0; i < Math.max(durs.length, props.length); i++) {
      const d = dur(durs[i % durs.length]), prop = props[i % props.length], ease = eases[i % eases.length];
      if (!(d > 0)) continue;
      anyMotion = true;
      inv.dur.add(d);
      if (fq && fq[0] === 'constant') group('M01', 'error', 'c' + prop, el, `transition on ${prop} in a part marked constant (seen 100+ times a day). Make it instant.`);
      else if (fq && fq[0] === 'often' && (d > 150 || !colorish.test(prop)))
        group('M02', fq[1], 'o' + prop + d, el, `transition ${prop} ${d}ms on something seen dozens of times a day. Only opacity or colour, 150ms at most.`);
      if (d > limit) group('R16', 'error', 'long' + d, el, `transition ${prop} ${d}ms is longer than ${limit}ms`);
      else if (has('dur') && !onScale(d, T.dur, 1)) group('R16', 'warn', 'dur' + d, el, `transition ${d}ms is not a --dur token`);
      if (layoutProp.test(prop)) group('R16', 'error', 'prop' + prop, el, `transition on ${prop}; animate transform/opacity instead`);
      if (prop === 'all') group('R16', 'error', 'all', el, 'transition: all; list the properties (transform, opacity, color…)');
      if (/^(display|overlay|visibility)$/.test(prop)) continue; // discrete: easing means nothing
      if (ease && easeIn(ease)) group('R16', 'error', 'easein' + ease, el, `easing ${ease} is an ease-in: it starts slow, so the UI feels late. Use --ease-out, for exits too (just shorter).`);
      else if (has('ease') && ease && ease !== 'linear' && !T.ease.includes(ease)) group('R16', 'warn', 'ease' + ease, el, `easing ${ease} is not an --ease token`);
    }
    if (s.animationName !== 'none') {
      anyMotion = true;
      const d = dur(s.animationDuration.split(',')[0]);
      const infinite = s.animationIterationCount.includes('infinite');
      const r = el.getBoundingClientRect();
      if (infinite && (r.width > 64 || r.height > 64)) add('R16', 'warn', el, `infinite animation "${s.animationName}" on a large element; keep loops for spinners only`);
      if (!infinite && d > limit) add('R16', 'error', el, `animation "${s.animationName}" ${d}ms is longer than ${limit}ms`);
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
    if (t.iterations !== Infinity && t.duration > 300) add('R16', 'error', a.effect.target, `JS animation ${t.duration}ms is longer than 300ms`);
  }
  if (staggered >= 4) add('R16', 'warn', null, `${staggered} elements use staggered entrance animations; drop the page-load fly-in`);
  if (anyMotion && !hasReducedMotion) add('R16', 'error', null, 'page has motion but no @media (prefers-reduced-motion) rule');

  for (const p of document.querySelectorAll('[popover]')) {
    const scales = scaleSels.some((q) => { try { return p.matches(q); } catch { return false; } });
    if (scales && /^(50% 50%|center)/.test(cs(p).transformOrigin))
      add('M05', 'warn', p, 'popover scales from its own centre. Set transform-origin to the side its trigger is on (dialogs stay centred).');
  }

  // A01 audit mode: no token scale to hold the page to, so count how many ways it does one thing
  if (auditMode && width >= 1024) {
    const over = (label, set, cap) => {
      if (set.size > cap) add('A01', 'warn', null, `${set.size} different ${label} (${[...set].slice(0, 10).join(', ')}); about ${cap} is enough. Two ways of doing one detail is a bug.`);
    };
    over('corner radii', inv.radius, 4);
    over('text colours', inv.color, 8);
    over('font families', inv.font, 3);
    over('transition durations in ms', inv.dur, 4);
  }

  // ---- behaviour (what can be read off a still page; interact.mjs drives the rest)
  const clicks = window.__gate ? window.__gate.clicks : new Set();
  const native = 'a[href], button, input, select, textarea, label, summary, option, [contenteditable]';
  for (const el of els) {
    if (el === document.body || el.closest(native)) continue;
    const listens = el.hasAttribute('onclick') || (clicks.has(el) && !el.querySelector(`${native}, [tabindex]`)); // skip delegation roots
    if (!listens && !(cs(el).cursor === 'pointer' && cs(el.parentElement).cursor !== 'pointer')) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') add('B08', 'error', el, `link without href${snippet(el)}: no middle-click, no "open in new tab". Give it a real href.`);
    else if (el.tabIndex < 0) add('B07', 'error', el, `clickable <${tag}>${snippet(el)} can't be reached with the keyboard. Use <button>, or <a href> if it navigates.`);
    else if (!el.getAttribute('role')) add('B07', 'warn', el, `clickable <${tag}>${snippet(el)} has no role. Use <button>.`);
  }
  for (const b of document.querySelectorAll('button[onclick], [role="button"][onclick]'))
    if (/location|window\.open/.test(b.getAttribute('onclick'))) add('B08', 'error', b, `button that navigates${snippet(b)}. Use <a href> so it opens in a new tab.`);
  if ([root, document.body].some((e) => cs(e).scrollSnapType.includes('mandatory'))) add('B09', 'warn', null, 'scroll-snap: mandatory on the page takes scrolling away from the reader. Remove it.');
  if ([root, document.body].some((e) => cs(e).cursor === 'none')) add('B11', 'error', null, 'cursor: none on the page (a custom cursor follower). Give the real cursor back.');
  const unseen = els.filter((el) => {
    const s = cs(el), r = el.getBoundingClientRect();
    return parseFloat(s.opacity) < 0.1 && r.top > innerHeight && !/fixed|absolute/.test(s.position) && s.pointerEvents !== 'none' &&
      (el.textContent.trim() || el.querySelector('img, svg, video')) && !el.closest('[hidden], [aria-hidden="true"], [popover], dialog');
  });
  if (unseen.length) add('B10', unseen.length >= 3 ? 'error' : 'warn', unseen[0], `${unseen.length} blocks below the fold stay invisible until scrolled to. Show content as it is; don't fade every section in.`);

  // ---- copy
  const nameOf = (el) => (el.getAttribute('aria-label') ||
    (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim() ||
    el.textContent.trim() || el.value || el.querySelector('img[alt]')?.alt || el.title || '').trim().replace(/\s+/g, ' ');
  for (const el of document.querySelectorAll('button, a[href], [role="button"], [role="tab"], summary, input[type="submit"], input[type="button"]'))
    if (visible(el) && !nameOf(el)) add('C06', 'error', el, 'control with no text and no aria-label. Icon-only is fine, nameless is not.');
  for (const el of document.querySelectorAll('input:not([type="hidden"], [type="submit"], [type="button"], [type="reset"], [type="image"]), select, textarea'))
    if (visible(el) && !(el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title))
      add('C09', 'error', el, el.placeholder ? `placeholder "${el.placeholder.slice(0, 30)}" is not a label. Add a <label> or aria-label.` : 'form control with no label');

  // C01 one action, one verb. DESIGN.md "verb: delete" makes the other words for it an error.
  const SYN = [['delete', 'remove', 'erase', 'trash'], ['create', 'add', 'new'], ['edit', 'modify', 'change'], ['save', 'submit', 'apply'],
    ['删除', '移除'], ['新建', '创建', '添加', '新增'], ['编辑', '修改'], ['保存', '提交']];
  const ctls = [...document.querySelectorAll('button, [role="button"], a.btn, input[type="submit"], input[type="button"]')].filter(visible);
  const used = new Map();
  for (const el of ctls) {
    const low = nameOf(el).toLowerCase();
    for (const g of SYN) {
      const v = g.find((w) => low === w || low.startsWith(w + ' ') || (/[^\x00-\x7f]/.test(w) && low.startsWith(w)));
      if (!v) continue;
      if (!used.has(g)) used.set(g, new Map());
      if (!used.get(g).has(v)) used.get(g).set(v, el);
    }
    const t = el.textContent.trim();
    if (cs(el).textTransform === 'uppercase' || (/\p{Lu}{4,}/u.test(t) && t === t.toUpperCase())) group('C02', 'warn', 'caps', el, `all-caps button${snippet(el)}. Use sentence case.`);
  }
  for (const [g, m] of used) {
    const chosen = g.find((v) => verbs.includes(v)), stray = [...m.keys()].filter((v) => v !== chosen);
    if (chosen && stray.length) add('C01', 'error', m.get(stray[0]), `"${stray.join('", "')}" used where DESIGN.md picked "${chosen}". One action, one verb.`);
    else if (!chosen && m.size > 1) add('C01', 'warn', m.get(stray[1]), `"${stray.join('", "')}" on the same page. If they are the same action, pick one verb and add "verb: <word>" to DESIGN.md.`);
  }

  // C07 pages that read like a manual
  if (type !== 'report') {
    const heads = [...document.querySelectorAll('h2, h3')].filter((h) => visible(h) && !h.closest('.prose, article'));
    const subbed = heads.filter((h) => h.nextElementSibling?.tagName === 'P' && h.nextElementSibling.textContent.trim().length <= 140);
    if (heads.length >= 4 && subbed.length / heads.length > 0.75)
      add('C07', 'warn', subbed[0].nextElementSibling, `${subbed.length} of ${heads.length} headings carry a one-line subtitle. Keep the ones a first-time user needs; let the layout explain the rest.`);
    const fields = [...document.querySelectorAll('.field')].filter(visible), hinted = fields.filter((f) => f.querySelector('.hint'));
    if (fields.length >= 3 && hinted.length / fields.length > 0.6)
      add('C07', 'warn', hinted[0], `${hinted.length} of ${fields.length} fields have hint text. Keep hints for fields people get wrong.`);
  }

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
  const NOUN = 'member|item|result|file|user|comment|day|hour|minute|second|project|task|message|view|vote|point|seat|error|warning|page|row|week|month|year';
  const reOne = new RegExp(`(?<![\\d.,])1\\s+(${NOUN})s\\b`, 'i');
  const reAgo = /(\d+)\s+(day|week|month|year)s?\s+ago|(\d+)\s*(天|周|个月|年)前/i;
  const reUrge = /\b(buy now|act now|hurry|limited time|don['’]?t miss|last chance|only \d+ left)\b|立即(购买|抢购)|马上抢|限时|手慢无/i;
  let lorem = false;
  for (let n; (n = walker.nextNode());) {
    const t = n.textContent, p = n.parentElement;
    if (!t.trim() || !p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(p.tagName)) continue;
    if (!lorem && /lorem ipsum|dolor sit amet/i.test(t)) { lorem = true; add('R18', 'error', p, 'lorem ipsum placeholder text'); }
    let m;
    if ((m = t.match(reOne))) group('C04', 'error', m[0], p, `"${m[0]}" is the wrong plural. Use Intl.PluralRules.`);
    if ((m = t.match(reAgo))) {
      const count = +(m[1] || m[3]), unit = (m[2] || m[4]).toLowerCase();
      if (/day|天/.test(unit) ? count > 7 : /week|周/.test(unit) ? count > 1 : true) group('C03', 'warn', 'ago', p, `"${m[0]}": past a week, show the date itself.`);
    }
    if ((m = t.match(reUrge))) group('C05', 'warn', 'urge', p, `"${m[0]}" pushes the reader. Say what the button does.`);
    if ((t.match(/\s·\s/g) || []).length >= 2) group('C08', 'warn', 'dots', p, 'several things chained with "·". Let layout separate them.');
    for (const b of banText) if (t.toLowerCase().includes(b.toLowerCase())) add('BAN', 'error', p, `"${b}" is banned in DESIGN.md`);
  }
  for (const img of document.images) if (img.complete && img.naturalWidth === 0) add('R18', 'error', img, `broken image ${img.getAttribute('src') || '(no src)'}`);
  for (const a of document.querySelectorAll('a[href="#"], a[href=""], a[href^="javascript:"]')) group('R18', 'error', 'deadlink', a, 'dead link (href="#" or empty). Point it somewhere real or use a <button>.');

  // Project bans from DESIGN.md
  // "ban: backdrop-filter" bans any use; "ban: text-transform: uppercase" bans one value
  for (const ban of bans) {
    const [prop, want] = ban.split(':').map((x) => x.trim());
    const hit = els.filter((el) => {
      const v = cs(el).getPropertyValue(prop);
      return want ? v.toLowerCase().includes(want.toLowerCase()) : v && !/^(none|normal|auto|0px|0s|initial)$/.test(v);
    });
    if (hit.length) add('BAN', 'error', hit[0], `${ban} is banned in DESIGN.md (${hit.length} elements)`);
  }

  return flush();
}
