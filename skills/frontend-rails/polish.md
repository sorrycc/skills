# Audit and polish an existing page

For a page that already exists, in any stack. You are not rebuilding it and you are not moving it onto a theme.

## 1. Run the gate in audit mode

Start the app, then:

```
node SKILL_DIR/gate/run.mjs http://localhost:3000/projects --type app --audit
```

`--audit` holds the page to its own scales instead of ours. It reads whatever tokens the page declares on `:root` (`--spacing`, `--text-sm`, `--radius-*`, `--color-*`, `--duration-*`, Tailwind v4 names included). Where the page has no scale, it skips the token rule and counts instead: how many corner radii, text colours, font families and durations are in use (rule A01). Two ways of doing one detail is a bug.

Everything that doesn't depend on tokens runs as usual: contrast, tap targets, overflow, motion, the break pass, hover, press, Tab, Escape, copy.

For view states, make the page honour `?state=loading` and so on, and pass `--states loading,empty,error`. If that's not practical, say so in your report and check those states by hand.

## 2. Fix in this order

Stop and report after each group if the user asked for an audit only.

1. **Broken or blocked interactions.** Controls the keyboard can't reach, clicks that give no answer within 100ms, hover that moves the target, layout that shifts when state changes, overlays Escape won't close, scroll hijacking (B rules).
2. **Remove motion.** Delete before you improve. Anything on a thing used all day, anything that only decorates, page-load fly-ins, scroll reveals. Then fix what's left: ease-in, `transition: all`, over 300ms, layout properties (M rules, R16).
3. **Missing states and fragile layout.** Loading, empty, error. Long names, big numbers, long translations (S and K rules).
4. **Copy.** Delete what the layout can say. One verb per action. Labels and accessible names stay (C rules, `copy.md`).
5. **Visual consistency.** Collapse the A01 inventory: one radius scale, one set of text colours, at most five type sizes on a screen, shadows only on floating layers, concentric corners (R rules).

Then run the screenshot review (`gate/vision-questions.md`) and the first-time-user walk (`gate/walkthrough.md`).

## 3. Report

One table, most serious first:

| Before | After | Why |
|---|---|---|
| Row title shortens when the status icon appears | Icon has a fixed slot, title never changes | People lost their place in the list |

List what you chose not to change and why. If something would not settle after two tries, build three variants and run `gate/compare.mjs` so the user can pick.

## Using the tokens in a Tailwind v4 project

Keep `tokens.css` as the source and point Tailwind's theme at it:

```css
@import "tailwindcss";
@import "./tokens.css";

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-text: var(--text);
  --color-muted: var(--text-muted);
  --color-border: var(--border);
  --color-accent: var(--accent);
  --font-sans: var(--font-body);
  --font-display: var(--font-display);
  --radius-md: var(--radius-md);
  --ease-out: var(--ease-out);
}
```

Then `bg-surface text-muted rounded-md` resolve to the theme. Run the gate without `--audit`, since `tokens.css` is loaded.
