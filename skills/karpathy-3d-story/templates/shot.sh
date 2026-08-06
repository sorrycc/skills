#!/usr/bin/env bash
# shot.sh <chapter> <t> <out.png> [w] [h] [settle_ms]
#
# Renders one deterministic frame of scene.html: chapter <chapter> at local
# story time <t> seconds, frozen (one frame, no animation advance). Freezing
# matters -- otherwise the animation phase at screenshot time is a random
# variable and you end up "fixing" geometry that was only out of frame.
#
# The shipped scene.html loads three.js from the CDN, but headless Chrome here
# has no network, so we screenshot a temp copy with the CDN URL rewritten to
# vendor/three.min.js. scene.html itself is never modified.

set -euo pipefail

CH="${1:?usage: shot.sh <chapter> <t> <out.png> [w] [h] [settle_ms]}"
T="${2:?usage: shot.sh <chapter> <t> <out.png> [w] [h] [settle_ms]}"
OUT="${3:?usage: shot.sh <chapter> <t> <out.png> [w] [h] [settle_ms]}"
W="${4:-1280}"
H="${5:-800}"
SETTLE="${6:-8000}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$DIR/scene.html"
VENDOR="$DIR/vendor/three.min.js"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

[ -f "$SRC" ]    || { echo "shot.sh: missing $SRC" >&2; exit 1; }
[ -f "$VENDOR" ] || { echo "shot.sh: missing $VENDOR (curl the CDN file into vendor/)" >&2; exit 1; }

TMP="$DIR/.shot_tmp.html"
sed "s#https://unpkg.com/three@0.160.0/build/three.min.js#vendor/three.min.js#" "$SRC" > "$TMP"
trap 'rm -f "$TMP"' EXIT

# Capture shim, injected here and NOT present in scene.html.
# This headless build will not composite the WebGL canvas into a screenshot --
# the capture comes back as flat page background even though the canvas holds a
# correct frame (verified with toDataURL). So we read the frame back out of the
# canvas and hand the screenshotter a plain <img> of exactly those pixels.
cat >> "$TMP" <<'SHIM'
<script>
(function () {
  const img = document.createElement('img');
  img.src = renderer.domElement.toDataURL('image/png');
  img.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:1';
  document.body.appendChild(img);
  renderer.domElement.style.visibility = 'hidden';
})();
</script>
SHIM

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

"$CHROME" \
  --headless=new \
  --disable-gpu \
  --use-gl=angle \
  --use-angle=swiftshader \
  --enable-unsafe-swiftshader \
  --hide-scrollbars \
  --no-sandbox \
  --allow-file-access-from-files \
  --virtual-time-budget="$SETTLE" \
  --window-size="$W,$H" \
  --screenshot="$OUT" \
  "file://$TMP?chapter=$CH&t=$T&freeze=1" >/dev/null 2>&1 || true

if [ ! -s "$OUT" ]; then
  echo "shot.sh: FAILED to produce $OUT" >&2
  exit 1
fi

# Dominant-colour readout: a black or near-uniform canvas is a failure that is
# easy to miss when you are only skimming thumbnails.
python3 -c "
from PIL import Image
import sys
im = Image.open(sys.argv[1]).convert('RGB')
colors = im.getcolors(maxcolors=2_000_000) or []
colors.sort(reverse=True)
top = colors[0] if colors else (0, (0,0,0))
frac = top[0] / (im.size[0]*im.size[1])
flag = '  <-- SUSPECT (near-uniform canvas)' if frac > 0.60 or len(colors) < 500 else ''
print(f'{sys.argv[1]}: {im.size[0]}x{im.size[1]} distinct_colors={len(colors)} '
      f'dominant={top[1]} covers={frac:.1%}{flag}')
" "$OUT"
