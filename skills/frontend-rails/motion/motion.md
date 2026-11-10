# Motion

Most interfaces get better when you delete motion. Decide whether a thing should move before you decide how.

## 1. Should it move?

Ask how often one person sees it in a day.

| Seen | Examples | Motion |
|---|---|---|
| 100+ times | command palette, keyboard shortcuts, anything opened from the keyboard | None. Mark it `data-freq="constant"` and `primitives.css` turns transitions off inside it. |
| Dozens of times | hover on list rows, tabs, menu items, moving through a list | Colour or opacity only, 150ms at most. Mark your own with `data-freq="often"`. |
| Now and then | menus, dialogs, drawers, toasts | Yes, if it has a reason from the list below. |
| Rarely or once | onboarding, first success, a finished upload | You may add a little delight here. |

Reasons that count: it shows where something came from or went, it shows a state changed, it answers a press, or it stops a jarring jump. "It looks nice" is not a reason. An animation is charming the first time and a delay the fiftieth.

If you can't mark the element itself, add `freq: constant <selector>` to the `gate` block in `DESIGN.md`. The gate enforces both.

## 2. How it moves

Tokens, already in every theme's `tokens.css`:

| Token | Value | Use for |
|---|---|---|
| `--dur-fast` | 120ms | hover, press, toggle, every exit |
| `--dur-base` | 200ms | things entering: menu, popover, dialog, toast |
| `--dur-slow` | 300ms | drawer entering, page-level change. Nothing in the interface is slower, except a drawer may take up to 500ms |
| `--ease-out` | cubic-bezier(0.23, 1, 0.32, 1) | anything entering or leaving |
| `--ease-in-out` | cubic-bezier(0.77, 0, 0.175, 1) | something already on screen moving to a new place |
| `--ease-std` | cubic-bezier(0.4, 0, 0.2, 1) | colour changes |
| `--ease-drawer` | cubic-bezier(0.32, 0.72, 0, 1) | drawers and sheets |

Rules the gate checks:

- Never ease-in. It starts slow, so the interface feels late. Exits use `--ease-out` too, with the shorter duration and a smaller distance.
- Something must change within 100ms of a press. A 300ms animation is fine if it starts at once.
- Enter from `scale(0.95)` with `opacity: 0`, never from `scale(0)`.
- A popover grows from its trigger. Set `transform-origin` to the side the trigger is on. Dialogs stay centred.
- Use transitions for interactive states, not `@keyframes`. A transition can be interrupted half-way and reverse; a keyframe animation can't.
- Animate `transform` and `opacity`. Colours are fine. Never width, height, top, left or margins.
- Never `transition: all`. List the properties.
- With `prefers-reduced-motion`, keep the fades and drop movement, scale and blur. `primitives.css` does this for you. Don't make things pop in with no fade.
- Motion is never the only signal. A state that animates also changes colour, icon or text.

## 3. Recipes

The first six are built into `primitives.css`. Use those classes instead of rewriting them.

| Moment | Recipe |
|---|---|
| Button press | `transform: scale(0.97)`, `--dur-fast`, `--ease-out` (`.btn`, `.icon-btn`). Disabled buttons don't scale. |
| Hover | background or border colour, `--dur-fast`, `--ease-std` |
| Menu or popover | opacity + `scale(0.95)` from the trigger corner. In `--dur-base`, out `--dur-fast` (`.menu`) |
| Dialog | opacity + `scale(0.96)`, centred, backdrop fades with it (`.dialog`) |
| Drawer | `translateX(100%)` with `--ease-drawer`. In `--dur-slow`, out `--dur-base` (`.drawer`) |
| Tooltip | First one waits 400ms. While one is showing, the next appear at once with no animation (`data-tip`) |
| Tab or toggle indicator | moves with `transform`, `--dur-base`, `--ease-in-out` |
| Item added to a list | opacity + `scale(0.98)`, `--dur-base`, `--ease-out` |
| Icon swap (copy → check) | cross-fade, new icon from `scale(0.5)`, `--dur-base` |
| Error | one horizontal shake, 3 × ±4px, `--dur-slow` total |

## 4. Feeling fast

- Animate the result, not the wait. If you can show the outcome before the server answers (optimistic update), do that and skip the spinner.
- Use a skeleton shaped like the content for anything that takes over 300ms. A spinner is for small areas only.
- Open the page with everything already in place. No entrance animation for the default state.

## 5. Usually skip

- The whole page flying in on load, one element after another.
- Every section fading in as you scroll. The gate fails pages that hide content until scrolled to.
- Endless decorative loops.
- Anything that blocks a click while it finishes.
- Scroll hijacking, custom cursors, parallax.

## 6. Example

```css
.card-menu { opacity: 0; transform: scale(0.95); transform-origin: top right;
  transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.card-menu[data-open] { opacity: 1; transform: none; transition-duration: var(--dur-base); }
```

## 7. Checking it

The gate writes `.gate/motion-<n>-<trigger>.png` for everything it could open. Each is a strip of six frames from start to end, one row for opening and one for closing. Look at them, and pass them to the screenshot reviewer. A strip shows shape, origin and overlap. It can't show whether the timing feels right at full speed, so when motion is the point of the work, ask the user to try it.
