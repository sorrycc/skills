# Pitfalls

Every item below was found by rendering a frame and looking at it during the
reference build. Treat as a pre-flight checklist: most can be avoided by
construction, and the rest are what to hunt for in each audit round.

## The invisible-geometry class

The signature failure of this kind of project: the code is correct, the object
exists, and it is not on screen. Reading the code will never find these.

1. **A cave/door/opening cut into a slope that closes over it.** Surfaces that
   flare outward as they descend swallow anything set into them a few units below
   the lip. Give the opening its own buttress with a flat front face.
2. **Anything anchored to the "top" of a centred mesh floats.** Cylinders, cones and
   capsules are centred on their own middle. Wrap them so the origin is the base.
3. **Props parented to the chapter instead of the character.** The character turns
   during the beat; the effect does not, and fires into the scenery.
4. **A hero dwarfed by the set.** A 4-unit actor on a 55-unit mountain is a
   handful of pixels. Move the camera to ~15–25 units, not 100.
5. **Actors placed at y=0 on non-flat terrain.** Always `y = groundY(x, z)`.

## Camera and framing

6. **Scenery standing between lens and subject.** Every keyframe is its own
   composition with its own occluders. Reserve clear sectors: place scatter only in
   the arc away from the camera side, and keep a corridor along the axis the camera
   travels.
7. **Camera inside an explosion.** Debris that travels 22 units reaches a camera
   parked 20 units away.
8. **Camera inside the terrain.** Check the mountain's surface height at the
   camera's radius before trusting a keyframe.
9. **Subject behind the camera.** Verify where actors actually end up: a climb that
   stops short of the terrace leaves them out of frame for the whole finale.
10. **Establishing shots that are distant postcards.** Move in.
11. **Cropped set-pieces.** The chapter's icon shot should contain the whole thing.

## Particles and materials

12. **Unclamped `gl_PointSize`.** Clamp to ~26 × pixelRatio.
13. **Mist/spray sized like boulders.** Sizes in the 1–6 range, not 6–16.
14. **Blown-out additive stacks.** A sheet at 0.9 opacity plus embers plus a
    60-intensity point light is a white slab. Dial all three down together.
15. **Hard rectangular edges on additive planes.** Fade alpha to zero at every
    edge, including the top; a 0.35 floor still shows the silhouette.
16. **Coplanar surfaces z-fight.** Offset by ~0.8 units.
17. **Atmosphere placed on the set.** Sea mist needs a `minR` so it starts offshore
    instead of sitting on the island like ice floes.

## Animation

18. **A latched pose.** An arm raised for one beat and never reset stays raised for
    the rest of the chapter. Drive poses from pulses, not assignments.
19. **Wrong-axis body parts.** A capsule barrel rotated about Z instead of X lays a
    horse across its own direction of travel.
20. **Riders.** Seating a figure on a mount is fiddly; walking it alongside reads
    unambiguously and needs no maths.
21. **Uniform crowd trajectories.** Fourteen soldiers blown out on the same curve
    read as a pattern at the wide shot.
22. **Empty aftermath.** A spotless terrace after a battle reads as "nothing
    happened here". Leave wreckage, revealed at the moment of impact.

## Process

23. **A fix regresses an approved frame.** Making spires sit on the ground doubled
    their visible height and put one dead centre in a hero shot that had already
    passed. Always re-shoot approved beats after a global change.
24. **Auditing one beat per chapter.** Not enough — shoot every camera keyframe.
25. **Claiming a clean render.** State what you did not look at. The reference build
    audited 21 frames of a 218-second film; the rest is unverified and says so.
