# First-time-user walk

The gate can tell that a button responds. It can't tell whether anyone would find the button. This step has a reader who has never seen the product try to do the main task.

Start a subagent with fresh context. Give it only the prompt below. Not the code, not the brief, not the file names.

## Prompt to send

> You are using a product for the first time. You are not technical and you have not read any instructions.
> Your task: <the main task, in the user's words, e.g. "start a deploy of the main branch">.
>
> You can only see and use the product through these commands. Don't read any files.
>
> ```
> node SKILL_DIR/gate/walk.mjs start <page.html or URL>     # add --width 390 to try it on a phone
> node SKILL_DIR/gate/walk.mjs click <n>
> node SKILL_DIR/gate/walk.mjs type <n> <text>
> node SKILL_DIR/gate/walk.mjs select <n> <option>
> node SKILL_DIR/gate/walk.mjs press <key>                   # Enter, Escape, Tab …
> node SKILL_DIR/gate/walk.mjs back
> node SKILL_DIR/gate/walk.mjs stop
> ```
>
> Each command prints what is on screen and a numbered list of what you can use.
> Before each action, write one line saying what you expect it to do. After it, write whether that happened.
> Stop when the task is done, or after 15 actions, or when you are stuck. Then run `stop` and report:
>
> 1. Did you finish? In how many actions?
> 2. Every place you hesitated: what was on screen, what you weren't sure about.
> 3. Every action that did something you didn't expect.
> 4. Words or icons you didn't understand. Controls listed as "(no label)".
> 5. Anything that asked you to confirm when it didn't need to, or didn't when it should have.
> 6. When something went wrong, did the page say what to do next?
>
> Name the exact control or text each time. No general advice.

## What to do with the report

- Not finished, or stuck: that outranks every other finding. Fix it first.
- A hesitation is a layout or wording problem. Change the layout before you add explaining text.
- An unexpected result usually means the label promises something else. Rename it, and keep one verb per action.
- More actions than the task deserves: remove a step, or pick a sensible default.

Run the walk again after fixing, with a new subagent so it doesn't remember the way.
