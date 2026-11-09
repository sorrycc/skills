# Motion

Add motion only after the page looks right without it. Motion should explain what changed, not decorate.

## Tokens (already in every theme's tokens.css)

| Token | Value | Use for |
|---|---|---|
| `--dur-fast` | 120ms | hover, press, toggle, color change |
| `--dur-base` | 200ms | open/close, appear, tab switch |
| `--dur-slow` | 320ms | modal, drawer, page-level change |
| `--ease-out` | cubic-bezier(0.16, 1, 0.3, 1) | things entering |
| `--ease-in` | cubic-bezier(0.7, 0, 0.84, 0) | things leaving (use the next shorter duration) |
| `--ease-std` | cubic-bezier(0.4, 0, 0.2, 1) | state changes |

Animate `transform` and `opacity`. Colors are fine too. Avoid animating width, height, top, left or margins; they cause jank.
`primitives.css` already includes the `prefers-reduced-motion` rule. If you don't use it, add one.

## Good places for motion

| Moment | Recipe |
|---|---|
| Button press | `transform: scale(0.97)`, `--dur-fast`, `--ease-std` (built into `.btn`) |
| Hover | background or border color, `--dur-fast`, `--ease-std` |
| Menu / popover opens | opacity 0→1 + `translateY(-4px)`→0, `--dur-base`, `--ease-out` |
| Menu closes | reverse, `--dur-fast`, `--ease-in` |
| Modal / drawer | opacity + `translateY(8px)` or `translateX(100%)`, `--dur-slow`, `--ease-out` |
| Tab / toggle | indicator moves with transform, `--dur-base`, `--ease-std` |
| Item added to a list | opacity + `scale(0.98)`→1, `--dur-base`, `--ease-out` |
| Success | checkmark fades in, `--dur-base` |
| Error | one horizontal shake, 3 × ±4px, `--dur-slow` total |

## Usually skip

- Whole page flying in on load, one element after another.
- Every section animating as you scroll.
- Endless decorative loops (spinners are fine).
- Motion used to hide a slow load. Fix the loading state instead.
- Anything longer than 400ms in the interface.

## Example

```css
.menu { opacity: 0; transform: translateY(-4px); pointer-events: none;
  transition: opacity var(--dur-fast) var(--ease-in), transform var(--dur-fast) var(--ease-in); }
.menu[data-open] { opacity: 1; transform: none; pointer-events: auto;
  transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }
```

The screenshots only show still frames. Tell the user that timing and feel need a human look.
