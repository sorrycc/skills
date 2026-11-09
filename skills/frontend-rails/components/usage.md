# primitives.css classes

Everything is built from tokens.css. Use these before writing your own CSS.

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
| Buttons | `.btn`, `.btn btn-primary`, `.btn btn-ghost`, `disabled` attribute |
| Form field | `<div class="field"><label>…</label><input class="input">…<span class="hint">…</span></div>` |
| Field error | `aria-invalid="true"` on the input + `<span class="error-text">` |
| Checkbox row | `<label class="check"><input type="checkbox"> Label</label>` |
| Box | `.card` (border) or `.panel` (filled) |
| Status label | `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info` |
| Message box | `.alert` + `.alert-success` / `-warning` / `-danger` / `-info` |
| Top nav | `<header class="container nav"><a>Logo</a><ul><li><a>…</a></li></ul></header>` |
| Tabs | `<div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="true">` |
| Footer | `.footer` |
| Table | `<div class="table-wrap"><table class="table">`; number cells `class="num"` |
| Big number | `<div class="stat"><span class="stat-label">…</span><span class="stat-value">…</span></div>` |
| Loading | `.skeleton` (set width/height), `.spinner` |
| Empty state | `.empty` |
| Screen-reader only text | `.sr-only` |

Headings h1–h6, links, code, `<pre>`, `<hr>` and `<mark>` are styled already.
