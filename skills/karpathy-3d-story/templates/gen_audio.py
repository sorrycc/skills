#!/usr/bin/env python3
"""Generate every audio asset for scene.html from ElevenLabs.

  python3 gen_audio.py ambience|sfx|narration|all [--voice VOICE_ID] [--force]

Skips files that already exist unless --force, so re-running is cheap and a
failed batch can be resumed. Validates every response is really an MP3 -- the
API returns JSON errors with HTTP 200-ish shapes and silently writing those to
.mp3 is exactly how you end up with a scene that is quietly missing its audio.
"""
import json, os, sys, time, urllib.request, urllib.error

API = "https://api.elevenlabs.io/v1"
KEY = os.environ.get("ELEVENLABS_API_KEY", "").strip()
if not KEY:
    sys.exit("set ELEVENLABS_API_KEY")

AMBIENCE = [
    ("ch1", "Distant ocean surf against rock, a large waterfall echoing in a valley, "
            "soft wind, a few far-off birds. Calm continuous outdoor ambience. No music."),
    ("ch2", "Ethereal celestial ambience high above clouds: soft airy wind, a distant "
            "temple bell decaying slowly, faint metallic shimmer. Serene, vast. No music."),
    ("ch3", "Lonely wind over an empty grass plain, very sparse, occasional distant crow, "
            "faint dust and grit. Desolate, patient, cold. No music."),
    ("ch4", "Roaring wall of fire at a distance, crackling embers, dry superheated wind "
            "over stone. Continuous, threatening. No music."),
    ("ch5", "Mountain temple ambience: deep bell resonance fading, faint low chanting far "
            "away, high thin wind, spacious stone reverberation. Reverent. No music."),
]

SFX = [
    ("stone-split", 5.0, "A giant boulder cracking open with a deep stone boom, "
                         "shards falling, followed by a bright magical shimmer."),
    ("cudgel-blow", 4.0, "An enormous iron staff slamming down, heavy metallic impact "
                         "with a deep shockwave and armour scattering."),
    ("mountain-break", 6.0, "A mountainside splitting apart: deep rumbling crack, "
                            "landslide of heavy rock, dust settling."),
    ("fan-wave", 4.0, "One colossal whoosh of wind from a giant fan, sweeping and "
                      "extinguishing a roaring fire."),
    ("heaven-light", 6.0, "A radiant celestial swell: soft golden chime blooming, "
                          "gentle choir-like shimmer rising, no melody."),
]


def post(path, payload, out, tries=3):
    if os.path.exists(out) and "--force" not in sys.argv:
        print(f"  skip (exists) {out}")
        return True
    body = json.dumps(payload).encode()
    for attempt in range(1, tries + 1):
        req = urllib.request.Request(f"{API}/{path}", data=body,
                                     headers={"xi-api-key": KEY,
                                              "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
        except urllib.error.HTTPError as e:
            detail = e.read()[:300].decode("utf8", "replace")
            print(f"  HTTP {e.code} on {out} (try {attempt}/{tries}): {detail}")
            time.sleep(3 * attempt)
            continue
        except Exception as e:
            print(f"  {type(e).__name__} on {out} (try {attempt}/{tries}): {e}")
            time.sleep(3 * attempt)
            continue
        if data[:3] != b"ID3" and data[:2] != b"\xff\xfb":
            print(f"  NOT AUDIO for {out}: {data[:200]!r}")
            time.sleep(3 * attempt)
            continue
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "wb").write(data)
        print(f"  wrote {out}  {len(data):>7} bytes  ~{len(data)/16000:4.1f}s")
        return True
    print(f"  FAILED {out}")
    return False


def do_ambience():
    print("ambience:")
    ok = True
    for name, prompt in AMBIENCE:
        ok &= post("sound-generation",
                   {"text": prompt, "duration_seconds": 22,
                    "prompt_influence": 0.4, "loop": True},
                   f"audio/ambience/{name}.mp3")
    return ok


def do_sfx():
    print("sfx:")
    ok = True
    for name, dur, prompt in SFX:
        ok &= post("sound-generation",
                   {"text": prompt, "duration_seconds": dur,
                    "prompt_influence": 0.5, "loop": False},
                   f"audio/sfx/{name}.mp3")
    return ok


def do_narration(voice):
    spec = json.load(open("narration.json"))
    model = spec.get("model", "eleven_multilingual_v2")
    print(f"narration: voice={voice} model={model}")
    ok = True
    for line in spec["lines"]:
        ok &= post(
            f"text-to-speech/{voice}?output_format=mp3_44100_128",
            {"text": line["text"], "model_id": model,
             "voice_settings": {"stability": 0.5, "similarity_boost": 0.75,
                                "style": 0.3, "use_speaker_boost": True}},
            f"audio/narration/{line['id']}.mp3")
    return ok


# ---------------------------------------------------------------------------
#  Cue table generation
#
#  scene.html cannot fetch() a manifest: from file:// that is a CORS error and
#  the whole soundtrack would silently vanish. So the cue list is emitted as a
#  plain JS file and concatenated into scene.html by build.sh. It must sort
#  BEFORE 70_audio.js — that module reads CUES the moment it is defined.
# ---------------------------------------------------------------------------
SFX_CUES = [
    ("stone-split",    1, 25.3),   # the stone splits on the summit
    ("cudgel-blow",    2, 29.3),   # the ranks are swept off the terrace
    ("mountain-break", 3, 30.3),   # 五行山 breaks open
    ("fan-wave",       4, 29.9),   # 一扇熄火
    ("fan-wave",       4, 31.5),   # 二扇生风
    ("fan-wave",       4, 32.9),   # 三扇下雨
    ("heaven-light",   5, 28.8),   # the scriptures are granted
]


def mp3_seconds(path):
    """Duration from the constant 128 kbps CBR we request, minus the ID3 tag."""
    n = os.path.getsize(path)
    if open(path, "rb").read(3) == b"ID3":
        with open(path, "rb") as f:
            f.seek(6); sz = f.read(4)
        n -= 10 + ((sz[0] & 0x7f) << 21 | (sz[1] & 0x7f) << 14 |
                   (sz[2] & 0x7f) << 7 | (sz[3] & 0x7f))
    return round(n / 16000.0, 2)


def do_cues():
    spec = json.load(open("narration.json"))
    nar = []
    missing = []
    for line in spec["lines"]:
        p = f"audio/narration/{line['id']}.mp3"
        if not os.path.exists(p):
            missing.append(line["id"]); continue
        nar.append({"id": line["id"], "ch": line["ch"], "t": line["t"],
                    "src": p, "dur": mp3_seconds(p), "text": line["text"]})
    amb = [{"ch": int(n[2:]), "src": f"audio/ambience/{n}.mp3",
            "dur": mp3_seconds(f"audio/ambience/{n}.mp3")}
           for n, _ in AMBIENCE if os.path.exists(f"audio/ambience/{n}.mp3")]
    sfx = [{"name": n, "ch": c, "t": t, "src": f"audio/sfx/{n}.mp3"}
           for n, c, t in SFX_CUES if os.path.exists(f"audio/sfx/{n}.mp3")]

    out = ["", "// ==========================================================="
               "=================",
           "//  Audio cue table — GENERATED by gen_audio.py, do not hand-edit.",
           "// ==========================================================="
           "=================", "const CUES = {",
           "  narration: ["]
    for c in nar:
        out.append(f"    {{ id: '{c['id']}', ch: {c['ch']}, t: {c['t']}, "
                   f"dur: {c['dur']}, src: '{c['src']}' }},   // {c['text'][:18]}…")
    out.append("  ],")
    out.append("  ambience: [")
    for c in amb:
        out.append(f"    {{ ch: {c['ch']}, dur: {c['dur']}, src: '{c['src']}' }},")
    out.append("  ],")
    out.append("  sfx: [")
    for c in sfx:
        out.append(f"    {{ name: '{c['name']}', ch: {c['ch']}, t: {c['t']}, "
                   f"src: '{c['src']}' }},")
    out.append("  ],")
    out.append("};")
    out.append("")
    open("parts/69_cues.js", "w").write("\n".join(out))
    print(f"parts/69_cues.js: {len(nar)} narration, {len(amb)} ambience, {len(sfx)} sfx")
    if missing:
        print(f"  MISSING narration clips ({len(missing)}): {', '.join(missing)}")
    return not missing


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    voice = None
    if "--voice" in sys.argv:
        voice = sys.argv[sys.argv.index("--voice") + 1]
    good = True
    if what in ("ambience", "all"): good &= do_ambience()
    if what in ("sfx", "all"):      good &= do_sfx()
    if what in ("narration", "all"):
        if not voice: sys.exit("narration needs --voice VOICE_ID")
        good &= do_narration(voice)
    if what in ("cues", "all"): good &= do_cues()
    sys.exit(0 if good else 1)
