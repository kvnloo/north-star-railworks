# Active goal: Ravenfell Valley

Status: active. Resumed in Hermes at the user's request from Codex thread `01a07858-6c4b-7972-b59f-ad446dc9fe8f`. The Codex goal was paused, not completed. Work stays on `nightly`; do not promote to `main` or `dev`.

## Exact original objective

Complete and deploy a polished Ravenfell Valley cinematic railway scene on the nightly branch of kvnloo/north-star-railworks. Preserve the illustrated workshop and corrected exploded assembly layout. Build and refine a richly forested mountain environment with convincing track, tunnel, two stations, a small town, multiple moving articulated trains, and polished FPV/tracking/aerial/town/tunnel camera modes inspired by the researched God of War and Assassin's Creed Valhalla forest references. Prioritize rendered output quality, correct geometry and train movement, stable camera behavior, responsive accessible controls, and usable performance. Verify the actual rendered scene and meaningful automated checks, document reproducible code and free-asset licenses, commit and push nightly, and verify successful GitHub Actions / GitHub Pages deployment at https://kvnloo.github.io/north-star-railworks/nightly/scene.html. Continue autonomously until the outcome is complete; report results and any honest material limitations.

## Acceptance and evidence

Keep the objective intact. A build, green check, or feature's mere existence does not establish visual quality. Record actual results in `docs/valley-verification.md`.

- Preserve the illustrated walkthrough and nonoverlapping exploded assembly with replay.
- Inspect rendered forest, mountains, railway, tunnel, both stations, town, and multiple articulated trains.
- Verify wheel/train geometry and movement using exported models and route-based checks.
- Exercise FPV, tracking, aerial/director, town, tunnel, and orbit cameras; check framing, transitions, and terrain clearance.
- Exercise desktop and narrow-screen controls, keyboard behavior, reduced motion, loading/error states, and rendering performance.
- Keep source reproducible and credit free assets and their licenses.
- Run meaningful checks and production build.
- Commit and push only nightly, read back remote SHA, verify Actions and actual deployed scene.
- State material limitations. Leave the goal active if required quality or verification remains incomplete.

## Recovery baseline

The worktree was on nightly at `5b11cec`, two commits ahead of remote nightly at `8c6bec0`. The valley source, scene assets, scene page, geometry verifier, and valley documentation were uncommitted. Main's assembly-fix workflow passed. The nightly scene returned HTTP 404 at recovery. No Codex process appeared in the live process list. Do not discard the recovered changes.
