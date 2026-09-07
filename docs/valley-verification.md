# Ravenfell Valley verification

## Goal status

The exact [original Codex objective](active-goal.md) remains active. This is a verified implementation milestone, not a claim that the original AAA visual-quality target is complete.

The recovered scene was uncommitted and the nightly scene URL returned 404. This work preserved the original workshop and continued on `nightly`; it does not promote changes to `main` or `dev`.

## Executed checks

Verified on 2026-09-07:

- `npm run check` passed the original export, replay and assembly-layout checks plus all seven valley verification scripts and valley source syntax checks.
- The complete exports retain 793 North Star objects and 873 Commodore objects, each in nine assemblies. Both workshop models loaded in Chromium, exploded correctly, and returned to the assembled replay endpoint.
- The GLB-backed motion suite checks both locomotives across 240 route poses each, their axle pivots, tyres meeting rail tops, steering bogies, coupling and connecting rods, physical arc-distance speed, consist spacing, deterministic seeking, route wrapping and actual hull vertices inside the tunnel.
- A rail-only test initially passed while actual train hulls clipped the old tunnel. The hull sweep required radius greater than 6.7827; the bore is now 7.2, with a 7.0 clear envelope including lamps. The tunnel mesh check passed 1,824 upward rail raycasts against real rendered triangles, with minimum measured rail headroom 4.4106.
- Camera tests passed 7,560 route/viewport samples and 1,120 transition frames for finite positions, framing parameters, terrain and tunnel clearance, normalized orientation and reduced-motion behavior. These do not prove universal tree/building occlusion avoidance.
- Forest checks preserve all 1,410 original tree placements, six species, 520 rocks and 1,700 ferns. They verify deterministic rebuilding, spatial chunks, full LOD coverage, material wind updates and shader generation. The boulder checks now account for whole volumes around the town and both rail lines.
- The browser caught a GLSL negative-literal substitution error in the new foliage-atlas shader that geometry-only tests missed. A regression now rejects the malformed shader text, and the real browser compiles the corrected shader without errors.
- Steam checks verify 96 deterministic puffs in one instanced draw, with finite matrices and bounded opacity.
- An independent source review caught High detail leaving EffectComposer at the old pixel ratio. A separate fix and regression now verify both real composer buffers switch from 1280×720 to 1920×1080 at DPR 2, then return to 1280×720 in Balanced mode. The second independent review reported no actionable security or logic errors.
- `npm audit --omit=dev` reported zero known vulnerabilities.
- `BASE_PATH=/north-star-railworks/nightly/ npm run build` passed.

## Production browser evidence

`npm run check:browser` ran against the actual production preview under `/north-star-railworks/nightly/`, not only the development server. It passed 42 distinct assertions, with seven camera-view captures and no recorded runtime, shader, console or failed-network errors on successful scene loads.

The suite exercised camera changes without teleporting trains, train selection, quality selection, pause/idle rendering, normal movement, live reduced-motion changes, hidden-control focus behavior, modal focus restoration, Space activation, responsive layouts at 390×844, 320×568 and 844×390, expandable small-screen settings, both original workshops and replay endpoints. A separate intentionally blocked texture request verified loading recovery and the workshop escape link.

The latest production sample rendered 248 frames in 6.023 seconds, approximately 41.2 FPS, at 1280×720 Balanced on ANGLE / AMD Radeon R9 M370X / OpenGL ES 3.2. Earlier viewpoints/runs measured lower rates. This short sample is not a sustained benchmark, worst-case guarantee or physical-phone result. The default software-rendered automation browser was unsuitable for performance measurement; the test records the actual GPU string.

Machine-readable results and original PNG captures are in the local ignored `artifacts/production/` directory. Re-run the committed browser script to reproduce them. The independent review is preserved locally at `artifacts/final-review.json`.

## Inspected renders

These are actual Chromium screenshots, converted to JPEG for repository size, not concept illustrations.

- [Initial shot](../previews/valley/cinematic.jpg)
- [FPV corridor](../previews/valley/fpv.jpg)
- [Aerial overview](../previews/valley/aerial.jpg)
- [Town and stations](../previews/valley/town.jpg)
- [Widened tunnel and rocky ridge](../previews/valley/tunnel.jpg)
- [Small-screen controls and train framing](../previews/valley/responsive-320x568.jpg)

Visual inspection led to changes beyond the passing geometry checks: removing boulder intrusion into the town, clearing the FPV route through the forest, keeping Trackside between the running lines, reducing excessive haze, widening the aerial shot, replacing the extruded tunnel exterior, and moving train framing above the controls. Small-screen playback/display settings now collapse so the interface leaves more of the scene visible.

## Deployment gate

Publication targets only https://kvnloo.github.io/north-star-railworks/nightly/scene.html. After push, verification must read the exact remote nightly SHA, wait for the corresponding Pages workflow to succeed, and exercise the deployed page. A local build or successful push alone is not deployment evidence. The original branch baselines are main `5b11cec34bd59d7a0e3d6736f1342d2df803ab66` and dev `8c6bec0c21886d601690aa3eff02d9a1663bd2db`.

## Still open under the original goal

- The settlement, passenger coaches, terrain material treatment and some vegetation details remain visibly procedural and simplified. The game-reference visual target is not yet met.
- Camera framing was inspected at representative poses, not every possible orbit, route phase, viewport and tree occlusion. Atlas view changes, LOD transitions, shadows and cinematic continuity need longer motion review.
- Sustained frame pacing, slow-network cold starts, physical phones, Safari and Firefox remain unverified.
- Train motion is kinematic, with no timetable, dispatching, stops, collision response or physical steam simulation. Those are honest implementation limits, not features verified by the geometry checks.

Next art pass should prioritize the town/coach detail and ground/vegetation rendering while preserving the verified train geometry and controls. Do not mark the complete objective achieved merely because this milestone builds and deploys.
