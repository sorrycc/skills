---
name: frontend-rails
description: Build frontend pages (landing pages, app screens and dashboards, HTML reports) that look right and feel right in use, or audit and polish an existing one. Pick a ready-made theme, build with its tokens and components, then let a browser script use the page (hover, press, Tab, every view state, long content) and tell you what to fix. Use when asked to make, redesign, review or polish a web page, UI, dashboard, or HTML artifact.
---

# frontend-rails

You don't have to invent a look, and you don't have to guess whether the page feels right. Pick a theme, use its values, build, then let the gate use the page and tell you what to fix.

Order of importance, always: the page solves the problem, then it is easy to use, then it looks good. Polish never covers a broken interaction.

`SKILL_DIR` below means the folder this file is in.

## Which job is this?

- **Build** a new page: follow steps 1 to 10.
- **Audit or polish** a page that already exists, in any stack: read `polish.md` instead. It uses the same gate with `--audit`.

## 1. Read the project memory

If the project has a `DESIGN.md`, read it first. It names the theme, the main task, the words the product uses, and what the user has rejected. Don't bring back anything listed as rejected.

## 2. Pick the page type

- **landing**: marketing page, home page, product page
- **app**: dashboard, admin, settings, any screen with data or forms
- **report**: HTML report, doc, write-up, comparison, artifact

Read `archetypes/<type>.md`. Write down the one main task a first-time user comes to do. Step 8 tests it.

## 3. Pick a theme

Read `themes/INDEX.md` and pick the theme that fits the product. If `DESIGN.md` already names one, use that. Then read `themes/<name>/theme.md`.

Copy into the project:
- `themes/<name>/tokens.css` → `tokens.css`
- `components/primitives.css` → `primitives.css`

You can change token values to fit the brand (for example, set `--accent` to the brand color). You can add a token if you need one. Keep the names and put all values in `tokens.css`. In a Tailwind project, see the mapping in `polish.md`.

## 4. Build

- In `<head>`: the font `<link>` from the top of `tokens.css`, then `tokens.css`, then `primitives.css`, then your own CSS.
- Use `var(--…)` for every color, font, font size, spacing, radius, and duration.
- Use the classes in `components/usage.md` before writing new CSS. Menus, dialogs, drawers, toasts, tooltips and switches are in there, already timed and keyboard-ready. Don't hand-roll them.
- App screens declare their view states in the markup (`archetypes/app.md`). The gate flips through them.
- Read `copy.md` before writing any text. Write real copy. No lorem ipsum.

## 5. Motion (only if the page needs it)

Read `motion/motion.md`. It starts with whether a thing should move at all, which depends on how often people see it. Add motion after the page works without it.

## 6. Run the gate

First time only: `cd SKILL_DIR/gate && npm install`

```
node SKILL_DIR/gate/run.mjs page.html --type landing|app|report [--dark]
```

The gate looks at the page and then uses it. Each line it prints says what's wrong and where.

| Rules | What the gate does |
|---|---|
| R | Opens the page at 1440, 768 and 390 px and checks tokens, contrast, tap targets, overflow, type sizes, shadows |
| M | Checks motion: durations, easing, what animates, how often it is seen, and a second load with reduced motion |
| S | Flips through every declared view state, screenshots each, and checks nothing around them moves |
| K | Break pass. Doubles the labels, makes the data long, and checks the layout holds |
| B | Hovers and presses every control, clicks what opens, presses Escape, Tabs through the page, scrolls |
| C | Reads the copy: one verb per action, plurals, stale dates, nameless icon buttons, unlabelled inputs |

Screenshots land in `.gate/` next to the page: one per width, one per state, `break-*.png`, `1440-nocopy.png` (secondary text hidden) and `motion-*.png` (six frames of each open and close).

- Fix every **error**. Fix **warnings** when it's easy.
- Run it again. Stop after 3 rounds.
- If the same error is still there after 2 fixes, go to step 9 instead of trying a third time.
- If a rule is wrong for this project, add `ignore: R07` (optionally with a selector, like `ignore: R07 .pricing`) to the `gate` block in `DESIGN.md` and write down why.

`--no-interact` and `--no-break` skip those passes when you only changed colors or type.

## 7. Look at the screenshots

Start a subagent with fresh context. Give it only the brief and the screenshot paths from `.gate/`, not the code. Ask it the questions in `gate/vision-questions.md` for this page type. Fix every answer that points to a problem, then run the gate once more.

## 8. Walk the main task as a first-time user

Start another fresh subagent and follow `gate/walkthrough.md`. It gets the main task from step 2 and a browser it drives through `gate/walk.mjs`. It never sees the code. Fix every place it hesitated or got stuck. Skip this step for reports.

## 9. When it still isn't right, show three

If two fixes didn't settle something, or the user says it feels off and can't say why, stop iterating on one version. Build three variants that differ in one clear way each, then:

```
node SKILL_DIR/gate/compare.mjs a.html b.html c.html --type app
```

It writes `.gate/compare/compare.html` with the three side by side at desktop and phone width, with gate results. Show that to the user and let them pick.

## 10. Update DESIGN.md

Create it from `templates/DESIGN.md` if it doesn't exist. Write down the theme, the tokens you changed, the main task, and the verbs the product uses.

Every time the user rejects something, record it twice. Once in words under Rejected, and once as a line in the `gate` block so the gate fails the next page that does it:

- a CSS effect → `ban: backdrop-filter` or `ban: text-transform: uppercase`
- a wording → `ban-text: Get started`
- a second word for an action → `verb: delete`
- motion on something used all day → `freq: constant .command-palette`

In your final message, list what you changed as a table with columns Before, After, Why.
