# primitives.css classes

Everything is built from tokens.css. Use these before writing your own CSS.

## Layout and text

| Need | Class / markup |
|---|---|
| Centered page width | `.container` |
| Vertical spacing between children | `.stack` (`.stack-sm`, `.stack-lg`) |
| Row of items that wraps | `.cluster` |
| Responsive grid | `.grid` (auto columns, min 16rem) |
| Two columns that stack on phones | `.split` |
| Section padding | `.section` |
| Readable text column | `.prose` |
| Grey text / intro text | `.muted`, `.lead` |

## Controls

| Need | Class / markup |
|---|---|
| Buttons | `.btn`, `.btn btn-primary`, `.btn btn-ghost`, `disabled` attribute. Press feedback is built in. |
| Icon-only button | `<button class="icon-btn" aria-label="Copy" data-tip="Copy"><svg>…</svg></button>` |
| Form field | `<div class="field"><label>…</label><input class="input">…<span class="hint">…</span></div>` |
| Field error | `aria-invalid="true"` on the input + `<span class="error-text">` |
| Checkbox row | `<label class="check"><input type="checkbox"> Label</label>` |
| Switch | `<label class="check"><input class="switch" type="checkbox" role="switch"> Label</label>` |
| Top nav | `<header class="container nav"><a>Logo</a><ul><li><a>…</a></li></ul></header>` |
| Tabs | `<div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="true">` |

## Things that float

These use the browser's own popover and `<dialog>`, so they need no script to open, close on Escape, and keep focus where it belongs. Enter and exit timing is built in.

| Need | Markup |
|---|---|
| Menu / popover | `<button class="btn" popovertarget="m">Sort</button>` then `<div id="m" popover class="menu"><button class="menu-item">Newest</button>…</div>`. Put the menu right after its button. It opens under the button and grows from that corner. |
| Dialog | `<button command="show-modal" commandfor="d">` then `<dialog id="d" class="dialog" closedby="any" aria-labelledby="d-title">`. Close with `<button command="close" commandfor="d">` or a `<form method="dialog">`. |
| Drawer | Same as dialog with `class="drawer"`. Slides in from the right. |
| Toast | `<div id="t" popover="manual" class="toast" role="status">Saved</div>`, then `t.showPopover()` and `t.hidePopover()` after about 4 seconds. Offer Undo in it instead of asking "are you sure?" beforehand. |
| Tooltip | `data-tip="Refresh"` on any control. The first waits 400ms, the next ones show at once. It is not read by screen readers, so the control still needs text or `aria-label`. |

## Surfaces and data

| Need | Class / markup |
|---|---|
| Box | `.card` (border) or `.panel` (filled). Never one inside another. |
| Status label | `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info` |
| Message box | `.alert` + `.alert-success` / `-warning` / `-danger` / `-info` |
| Avatar | `<img class="avatar" alt="…">` (never squashed, thin inner edge) |
| Photo or screenshot | `class="frame"` adds a 1px inner edge so it doesn't melt into the page |
| Footer | `.footer` |
| Table | `<div class="table-wrap"><table class="table">`; number cells `class="num"` |
| Big number | `<div class="stat"><span class="stat-label">…</span><span class="stat-value">…</span></div>` |

## States

| Need | Class / markup |
|---|---|
| View states | `data-states="filled loading empty error"` and `data-state="filled"` on the view, `data-when="loading"` on each block (see `archetypes/app.md`) |
| Loading | `.skeleton` (set width/height to match the content), `.spinner` for small areas |
| Empty state | `.empty` |
| Never animate (used all day) | `data-freq="constant"` on the container |
| Screen-reader only text | `.sr-only` |

Headings h1–h6, links, code, `<pre>`, `<hr>` and `<mark>` are styled already. Long words wrap instead of overflowing.
