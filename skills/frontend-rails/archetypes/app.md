# App screen / dashboard

People come here to get work done, so clarity and density matter more than looks.

## Layout

- Top bar or side nav for moving around. A page title with the main action on the right.
- Filters and actions in one toolbar row above the content.
- Use the full width for tables. Use cards only for things that really are separate. Never a card inside a card.
- The page is flat. Shadows are for things that float (menus, dialogs, toasts).

## Data

- Numbers in tables: `class="num"` (right-aligned, tabular-nums). Put units in the header.
- Use status colors only for status: `.badge-success`, `.badge-danger`, etc.
- Dates and numbers formatted for people ("3 min ago", "1,204"). Past a week, show the date itself, not "340 days ago".
- Wide tables go inside `.table-wrap` so they scroll on phones.

## Every view declares its states

Mark the view with the states it has, and each block with the state it belongs to. `primitives.css` shows only the blocks for the current `data-state`.

```html
<section data-states="filled loading empty error denied offline" data-state="filled">
  <div data-when="filled offline" class="table-wrap">…</div>
  <div data-when="loading" aria-busy="true">…skeleton rows…</div>
  <div data-when="empty" class="empty">…</div>
  <div data-when="error" class="alert alert-danger" role="alert">…</div>
  <div data-when="denied" class="empty">…</div>
  <div data-when="offline" class="alert alert-warning">…</div>
</section>
```

The gate sets `data-state` to each name in turn, screenshots it (`.gate/state-<name>.png`) and checks it. In a framework app that picks its state from data, make the page honour `?state=<name>` and list the names in `DESIGN.md` (`states: loading empty error`).

Required: filled, loading, empty, error. Add the rest when the view can really hit them.

| State | What it needs |
|---|---|
| **filled** | The normal view, with realistic data. Include one long name and one big number. |
| **loading** | `.skeleton` blocks the same shape and height as the content, so nothing jumps when data lands. `.spinner` only for small areas. |
| **empty** | One sentence saying why it's empty and a button for the first thing to do. |
| **error** | What went wrong in plain words, a retry button, and a way to report it. Never a bare "Something went wrong". |
| **denied** | Who can see this, and how to get access. |
| **offline** | Say so, show the last data you have, and offer retry. |
| **partial** | Some rows loaded and some failed. Show what loaded and mark what didn't. |

Whatever sits around the content (title, toolbar, nav) stays exactly where it is in every state. So does a row when its own status changes. Never shorten a title to make room for a status icon, and never let a hover-only button push text aside. Reserve the space up front.

## Actions

- Ask "are you sure?" only for things that can't be undone. For the rest, do it and offer undo in a `.toast`.
- A dangerous action gets a clear verb ("Delete project"), not a wall of red.
- Use `.menu`, `.dialog`, `.drawer`, `.toast`, `data-tip` and `.switch` from `components/usage.md`. They open from the right place and close on Escape, and a dialog keeps focus inside it, all without script.
- A button does something. A link goes somewhere and has a real `href`, so it can open in a new tab.
- Icon-only buttons are fine in toolbars. Each one needs an `aria-label` and a `data-tip`.

## Forms

- Label above each input (`.field`). Hint text only for fields people get wrong.
- Show errors next to the field (`.error-text`, `aria-invalid="true"`).
- Disabled buttons use the `disabled` attribute.
