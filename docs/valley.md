# Ravenfell Valley

A browser railway scene built with Three.js. Four services run on two offset loops through a forested mountain valley, a lake, Ravenfell Junction, Pinewatch, a timber town, and a stone tunnel.

The exact ongoing objective is in [active-goal.md](active-goal.md). Verification evidence and unfinished quality requirements are in [valley-verification.md](valley-verification.md). Passing checks does not certify AAA visual quality.

## Run and build

From the repository root:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173/scene.html. A file URL does not provide the required module and asset paths.

```sh
npm run check
npm run build
npm run preview
```

`npm run check` includes the original model/export/assembly tests plus the valley suite. `npm run check:valley` runs the valley checks alone. Vite prepares tracked models, previews, and scene textures under `public/generated/`, then builds `dist/`.

GitHub Actions supplies `BASE_PATH` for the three-branch Pages build. Nightly's scene URL is https://kvnloo.github.io/north-star-railworks/nightly/scene.html. Main and dev remain separate branch builds.

## Controls

- Choose one of four trains to follow.
- Select Director's cut, FPV drone, Trackside, Aerial, Tunnel, Town & stations, or Free orbit.
- Set playback pace and pause with Play. Space also toggles playback when focus is outside interactive controls and dialogs.
- In Free orbit, drag to orbit and scroll or pinch to zoom. Touch pan uses two fingers.
- Hide UI removes controls from keyboard navigation. Show controls restores them and focus. H also toggles the interface outside controls.
- High detail increases render resolution and shadow-map resolution; Balanced reduces GPU cost. Fullscreen is offered when the browser supports it.
- Scene notes explain controls, asset sources, and limitations. Escape closes the dialog and restores focus.

Reduced motion starts playback paused, suppresses decorative camera banking, foliage wind and lake animation, and makes camera changes immediate. Explicit Play still moves trains. Enabling reduced motion while playing pauses the scene. A paused, settled scene stops drawing frames until another interaction. Hidden tabs do not advance the railway.

The tunnel camera watches the west portal. Selecting it no longer teleports the train. A service may take time to reach the portal.

## Source and reproducibility

- `geography.js` defines the seeded landscape, route and rail offsets.
- `environment.js` builds the terrain, rocks, forest, ferns and lake. `placement.js` clears whole boulder volumes from both tracks and the town, rather than checking only their origins.
- `forest.js` divides the unchanged 1,410 tree placements into spatial chunks. Nearby trees retain their detailed geometry. Distant trees use eight-view atlases rendered from the same geometry and foliage maps. LOD hysteresis reduces switching around the distance threshold. Wind updates the material used by the actual instances.
- `railway.js` builds sleepers, rails, ballast, a textured irregular ridge, stone portal courses and retaining walls. The 7.2-unit bore was widened after actual GLB vertices exposed clipping missed by a rail-only check.
- `town.js` builds the settlement and stations.
- `trains.js` reuses the original exported locomotives, merges static parts by material, retains rotating axle pivots and coupling/connecting rods, and articulates tenders, coaches and bogies. Both lines use physical arc distance. Steam uses one instanced batch rather than 96 separate draws.
- `cameras.js` computes shots, portrait framing, orientation blending, and terrain/tunnel clearance. `scene.js` owns rendering and playback; `controls.js` handles UI visibility, focus, loading recovery, and fullscreen state.

Source modules above live under `web/valley/`. No model source or editable assembly export is replaced by the runtime batching.

## Browser verification

Install Playwright Chromium once, then run the app or production preview in another terminal:

```sh
npx playwright install chromium
npm run check:browser
```

`SCENE_URL` selects a local or deployed scene; `OUTPUT_DIR` selects the evidence directory, defaulting to `artifacts/valley`. `CHROME_PATH` can select an existing compatible Chromium executable. The script requests ANGLE's OpenGL backend and records the actual GPU, rather than treating software rendering as hardware performance.

The browser suite records screenshots, errors, functional assertions, and a short FPS sample in `browser-results.json`. It tests camera controls, train selection, quality selection, reduced motion, pause/idle behavior, keyboard/modal/focus flows, portrait and landscape layouts, both original workshops, replay endpoints, and a failed-texture recovery path. The intentionally failed load runs separately from the clean-console checks.

The deterministic suite checks actual GLB rest bounds, axle alignment, rolling direction, bogie yaw, rod linkage, train hull/tunnel clearance, route wrapping, camera positions and transitions, forest placement/LOD/shader generation, boulder clearances, steam attributes, rendered tunnel triangles, and real EffectComposer target sizes. Geometry tests using renderer doubles do not claim to verify pixels or frame rate.

## Assets and licenses

The machine-readable record is [scene-assets/credits.json](../scene-assets/credits.json).

- Forest Leaves 02 and Aerial Rocks 02 are by Rob Tuytel, from Poly Haven, under CC0. Four checked-in 2048-square JPGs provide diffuse and OpenGL normal maps. Sources: https://polyhaven.com/a/forest_leaves_02 and https://polyhaven.com/a/aerial_rocks_02. License: https://polyhaven.com/license.
- EZ-Tree 1.1.0, by Daniel Greenheck, is MIT licensed. Its tree geometry, foliage maps and runtime-baked atlases retain the credit and [copied license](../scene-assets/ez-tree-LICENSE.txt). Source: https://github.com/dgreenheck/ez-tree.
- Three.js is MIT licensed. Its license is included in the installed dependency at `node_modules/three/LICENSE`.
- DM Sans is requested from Google Fonts under SIL Open Font License 1.1: https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt. A system sans-serif fallback works without the font request.

God of War, Assassin's Creed Valhalla and Tom Krcha's thread are visual/process references. Their artwork and game assets are not redistributed.

## Limits

This is a procedural cinematic scene, not a railway simulator. There is no dispatching, collision response, timetable, station-stop simulation, wheel adhesion or steam physics. Vehicle motion and rods are kinematic. Distant foliage atlases have discrete view/LOD changes and baked lighting; shadows update less often in Balanced mode. The lake is a shaded plane, not simulated water. The town and passenger coaches remain simplified procedural models. Rendering performance depends on hardware; software WebGL is not a supported performance target. Physical-phone, Safari and Firefox testing remain outstanding.
