# Audio pipeline

Three layers, all driven off the same story clock as the visuals: narration (one
clip per caption beat), a looping ambience bed per chapter, and one-shot effects on
the big beats.

## Order of work

```bash
export ELEVENLABS_API_KEY=...
python3 gen_audio.py ambience                    # looping beds, 18–22s each
python3 gen_audio.py sfx                         # one-shots
python3 gen_audio.py narration --voice <VOICE_ID>
python3 gen_audio.py cues                        # writes parts/69_cues.js
node audio_sweep.js                              # assert the cue logic
bash build.sh
```

Check the account first — plan and available voices decide what is possible:

```bash
curl -s -H "xi-api-key: $K" https://api.elevenlabs.io/v1/user/subscription
curl -s -H "xi-api-key: $K" https://api.elevenlabs.io/v1/voices
```

The `category` field on each voice is the one that matters: `premade` works on
every plan, `professional` (the library) does not. See below.

Sound generation (`/v1/sound-generation`, used for ambience and sfx) does **not**
draw on the TTS character quota — measured on a free plan, where eleven beds and
effects moved the counter by zero. Only narration costs characters. A 26-line
script came to ~500.

## Writing narration.json

Each line is sized to the gap between its caption and the next one (the "beat
window"). Measure the voice's real pace with one sample before writing the whole
script — estimates are wrong by 30%+. Observed so far, all on Chinese text:

| voice | category | chars/s |
|---|---|---|
| Ethan Zhang (beijing mandarin) | professional | ~5.5 |
| Brian — Deep, Resonant | premade | **4.41** |

Two voices differ by more than 20% on identical text, so a pace carried over from
a previous build is a guess, not a baseline.

Target ~85% of the window so lines do not collide. After generating, **measure
every clip** and compare against its window:

```bash
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 clip.mp3
```

Trim and regenerate any overrun rather than letting lines overlap. In the 静夜思
build, writing against an inherited 5.5 chars/s made all 26 lines look
comfortable; measured at the real 4.41, one sat at 92% of its window and the
film's opening line at 88%. Both were trimmed and regenerated. Treat anything
over ~88% as a rewrite, and give the first line of the film extra room — it is
the worst place in the artifact to discover a collision.

## Cue table

`gen_audio.py cues` emits `parts/69_cues.js` — a **JS file, not a JSON manifest**.
`fetch()` on `file://` is a CORS error, so a fetched manifest makes the entire
soundtrack vanish for anyone who double-clicks `scene.html`.

## Engine notes

- **Plain `<audio>` elements, not Web Audio.** `decodeAudioData` needs `fetch()`,
  which fails on `file://` for the same reason.
- **Create elements lazily inside `enable()`.** ~40 elements with `preload="auto"`
  constructed at load stall the page before the first frame — and someone who chose
  to watch silently should not pay for a soundtrack they declined.
- **Throttle retries.** A bed that has not started yet will otherwise get a `play()`
  call on every frame for the rest of the film (6,650 calls in one sweep).
- **Give repeated cues two elements** so a cue fired three times (e.g. three fan
  waves) can overlap itself instead of cutting its own tail.
- **Autoplay needs a gesture.** The start gate is unavoidable; make it the title
  card so it earns its place.

## Verifying without hearing

You cannot listen. You can still prove the cue logic, and `templates/audio_sweep.js`
does it: it runs `70_audio.js` verbatim in a Node VM with `<audio>` stubbed out and
steps the story clock across the whole film at 30 Hz, then asserts

- every narration cue fires exactly once,
- in ascending story order,
- in its own chapter and on its own beat,
- every effect fires,
- scrubbing back then forward replays nothing already spent,
- and no ambience bed is retried more than a bounded number of times.

Run it before `build.sh`, and again after the real clips land. Two notes on why it
is shaped the way it is: `CUES` and `audio` are top-level `const`s, i.e. lexical
bindings rather than properties of the sandbox global, so they have to be handed
out explicitly; and if `audio/narration/` is still empty it stands the table up
from `narration.json`, so the timing logic is under test *before* the clips exist.

Say explicitly in `audit_log.md` what remains unverified. That list is always at
least: pronunciation and prosody (and the accent, on route A), loop seams in the
beds, whether the generated effects sound like what they were asked for, and the
level balance between the three layers — the gains in `70_audio.js` are inherited
constants that nobody has tuned against these particular clips.

## Choosing a voice on a free plan

Library ("professional") voices — including the good native-Mandarin ones — work in
the ElevenLabs web app but are refused over the API:

```
402 paid_plan_required — "Free users cannot use library voices via the API."
```

**Stock ("premade") voices are not refused, and under `eleven_multilingual_v2`
they will read any language the model supports.** None of them are native
Chinese, so a Tang poem comes out with an American accent — but the entire
soundtrack then generates from a shell with no browser and no human in it.

That is the fork, and it belongs in Phase 0 rather than being discovered in
Phase 5. Put it to the user plainly: *automatic pipeline with an accent*, or
*native voice with one manual round trip*. Do not assume the accent is
unacceptable; for many projects it is not, and the automation is worth more.

### Route A — premade, fully automatic (default)

Confirm the voice takes the target language before committing the script. One
line costs a dozen characters and rules out an hour of rework:

```bash
curl -s -w '\nHTTP %{http_code}\n' -o /tmp/t.mp3 \
  -H "xi-api-key: $K" -H 'Content-Type: application/json' \
  -d '{"text":"举头望明月","model_id":"eleven_multilingual_v2"}' \
  "https://api.elevenlabs.io/v1/text-to-speech/<VOICE_ID>?output_format=mp3_44100_128"
head -c 3 /tmp/t.mp3     # ID3 = real audio; a JSON error body means refused
```

Then `python3 gen_audio.py narration --voice <VOICE_ID>` and carry on. Known good
on free: `nPczCjzI2devNBz1zQrb` (Brian — deep, unhurried, suits a narrator).

### Route B — library voice, one manual step

Only when a native reading is worth a human in the loop:

1. Write the whole script to a paste file, one line per paragraph, **nothing but
   the spoken text** — any numbering on the page gets read aloud.
2. User pastes it into the web app with the desired voice, downloads one MP3.
3. `python3 split_narration.py <downloaded.mp3>` cuts it back into per-beat clips.
4. `python3 gen_audio.py cues && bash build.sh`.

`split_narration.py` auto-tunes the silence threshold until it finds exactly as
many segments as `narration.json` has lines, cuts on **speech onset** rather than
gap midpoints (midpoints leave ~0.4s of dead air that delays every line off its
beat), and checks each clip against its window. Validate it before relying on it:
concatenate known clips with silences, split, and confirm the durations come back
within ~0.2s of the originals.

Write the paste file either way: it costs nothing and leaves route B open if the
accent turns out to grate.
