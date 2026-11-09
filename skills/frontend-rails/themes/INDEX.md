# Themes

| Theme | Feel | Good for | Density |
|---|---|---|---|
| editorial-ink | magazine, serif headlines, ink-red accent | essays, reports, studios, publications | normal |
| warm-craft | paper and terracotta, friendly serif | cafés, shops, small businesses, food | normal |
| cold-tool | crisp grey and blue, one sans family | dev tools, SaaS apps, settings, docs-like apps | compact |
| dense-ledger | quiet neutral with teal, small type | tables, finance, admin, dashboards | dense |
| mono-print | black and white with a red spot, square corners | portfolios, agencies, bold reports, events | normal |
| soft-consumer | warm off-white, coral, round corners | consumer apps, wellness, onboarding, booking | normal |
| tech-docs | white page, petrol blue, readable sans | documentation, technical write-ups, changelogs | normal |
| bold-brand | heavy display type, orange on cream or black | launches, campaigns, brand pages | normal |

App screens and dashboards: start with **dense-ledger** or **cold-tool**.
Reports: start with **editorial-ink**, **tech-docs** or **mono-print**.

Every theme has the same token names, light and dark mode, and status colors (success, warning, danger, info, disabled).
To add a theme: copy a folder, change the values, then run `node gate/check-theme.mjs themes/<name>/tokens.css` to check contrast.
