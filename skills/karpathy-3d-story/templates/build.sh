#!/usr/bin/env bash
# Concatenates parts/* (in filename order) into the single self-contained
# scene.html. scene.html is the deliverable -- no build step is needed to *run*
# it, only to regenerate it after editing a part.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: > "$DIR/scene.html"
for f in "$DIR"/parts/*; do
  cat "$f" >> "$DIR/scene.html"
  printf '\n' >> "$DIR/scene.html"
done
echo "scene.html: $(wc -l < "$DIR/scene.html" | tr -d ' ') lines, $(wc -c < "$DIR/scene.html" | tr -d ' ') bytes"
