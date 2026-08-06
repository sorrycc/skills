#!/usr/bin/env python3
"""Split one long narration MP3 into the 28 per-beat clips.

  python3 split_narration.py <input.mp3> [--out audio/narration] [--dry]

The web app can use library voices that the free API cannot, so the practical
route is: generate the whole script in one go there, then cut it here on the
pauses. Auto-tunes the silence threshold until it finds exactly as many
segments as narration.json has lines, so a bad threshold is a loud failure
rather than 28 mysteriously misaligned files.
"""
import json, os, re, shutil, subprocess, sys

SPEC = json.load(open("narration.json"))
LINES = SPEC["lines"]
WANT = len(LINES)
CH_DUR = {1: 44, 2: 46, 3: 42, 4: 42, 5: 44}


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stderr


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    return float(out) if out else 0.0


def find_silences(src, noise, mind):
    err = run(["ffmpeg", "-hide_banner", "-i", src,
               "-af", f"silencedetect=noise={noise}dB:d={mind}", "-f", "null", "-"])
    starts = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", err)]
    return list(zip(starts, ends))


def segments_from(sils, total):
    """The speech spans themselves — from the end of one silence to the start
    of the next. Cutting at silence midpoints instead leaves half a gap of dead
    air on the front of every clip, which delays each line off its beat."""
    bounds = [0.0]
    for s, e in sils:
        bounds.append(s)      # speech ends here
        bounds.append(e)      # next speech starts here
    bounds.append(total)
    segs = []
    for i in range(0, len(bounds) - 1, 2):
        a, b = bounds[i], bounds[i + 1]
        if b - a > 0.35:                      # ignore slivers
            segs.append((a, b))
    return segs


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "audio/narration"
    dry = "--dry" in sys.argv
    if not os.path.exists(src):
        sys.exit(f"no such file: {src}")
    total = duration(src)
    print(f"input: {src}  {total:.1f}s, want {WANT} segments")

    best = None
    for noise in (-30, -35, -40, -45, -25, -50):
        for mind in (0.45, 0.35, 0.6, 0.28, 0.8):
            segs = segments_from(find_silences(src, noise, mind), total)
            print(f"  noise={noise}dB d={mind}s -> {len(segs)} segments")
            if len(segs) == WANT:
                best = (segs, noise, mind)
                break
        if best:
            break
    if not best:
        sys.exit("FAILED: could not find a threshold giving exactly "
                 f"{WANT} segments. Re-generate with a clear pause between "
                 "every line, or split by hand.")

    segs, noise, mind = best
    print(f"using noise={noise}dB d={mind}s")

    os.makedirs(out, exist_ok=True)
    ok = True
    by = {}
    for l in LINES:
        by.setdefault(l["ch"], []).append(l)
    win = {}
    for ch, ls in by.items():
        for i, l in enumerate(ls):
            nxt = ls[i + 1]["t"] if i + 1 < len(ls) else CH_DUR[ch]
            win[l["id"]] = nxt - l["t"]

    for (a, b), line in zip(segs, LINES):
        dst = os.path.join(out, line["id"] + ".mp3")
        pad_a = max(0.0, a - 0.08)                       # a breath of head
        dur = (b - a) + 0.08 + 0.18                      # and let the tail ring
        if not dry:
            subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                            "-i", src, "-ss", f"{pad_a:.3f}", "-t", f"{dur:.3f}",
                            "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100",
                            "-ac", "1", dst], check=True)
        d = duration(dst) if not dry else dur
        w = win[line["id"]]
        flag = ""
        if d > w:
            flag = f"  OVERRUNS its {w:.1f}s beat by {d - w:.1f}s"
            ok = False
        elif d > w - 0.5:
            flag = "  tight"
        print(f"  {line['id']}  {d:5.2f}s / win {w:4.1f}s{flag}")
    print("OK" if ok else "SOME CLIPS OVERRUN — shorten those lines and redo")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
