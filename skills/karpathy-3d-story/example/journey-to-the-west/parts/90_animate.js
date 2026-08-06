
// ============================================================================
//  The loop
//
//  One clock, one render call. In freeze mode we draw exactly one frame at the
//  requested story time and stop, so a screenshot is a pure function of the
//  URL — no dependence on how fast the machine got through the first seconds.
// ============================================================================

const clock = new THREE.Clock();
let booted = false;

function dropBoot() {
  if (booted) return;
  booted = true;
  if (dom.boot && dom.boot.parentNode) dom.boot.parentNode.removeChild(dom.boot);
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  director.advance(dt);
  director.update(dt);
  ui.update();
  renderer.render(scene, camera);
  dropBoot();
}

if (P_FREEZE) {
  // Deterministic single frame, rendered SYNCHRONOUSLY during page parse.
  // Both details are load-bearing for headless capture:
  //   - via requestAnimationFrame the pixels never reach the screenshot at all
  //     (the tool captures a compositor frame that predates the canvas), which
  //     looks exactly like a scene that renders nothing;
  //   - without preserveDrawingBuffer the buffer is discarded before the
  //     screenshot is taken, giving a black PNG.
  // Two passes: the first compiles shaders, the second is the photograph.
  director.update(1 / 60);
  renderer.render(scene, camera);
  director.update(1 / 60);
  renderer.render(scene, camera);
  dropBoot();
} else {
  renderer.setAnimationLoop(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- keyboard ---------------------------------------------------------------
//   space  pause      [ ]  chapter      < >  ±5s      m  mute
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    ui.setPaused(!director.paused);
  } else if (e.code === 'BracketRight' || e.code === 'BracketLeft') {
    const dir = e.code === 'BracketRight' ? 1 : -1;
    const next = clamp(activeIdx + dir, 0, chapters.length - 1);
    director.seekTo(chapters[next].start + 0.05);
  } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
    director.seekTo(director.time + (e.code === 'ArrowRight' ? 5 : -5));
  } else if (e.code === 'KeyM') {
    document.getElementById('btn-mute').click();
  }
});
