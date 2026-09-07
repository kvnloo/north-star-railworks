# Performance audit checkpoint

Status: verified implementation checkpoint, not a completed ten-reviewer critique or an AAA/mobile performance certification. Baseline is nightly commit 0f45925692556121ada0ca3eb681313ef341cad7.

## Included changes

- Warm material textures, color shaders, shadow/depth variants and culled geometry before revealing playback. A plain compileAsync experiment did not remove the stall; the retained implementation also exercises the offscreen variants in a temporary render target and restores visibility/culling/target state.
- Freeze immutable scene transforms before adding trains. Geometry, texture content, lighting and all original placements remain unchanged.
- Auto detail uses measured frame timing, hysteresis and cooldown. It adds supersampling only with sustained headroom and never drops below the existing Balanced resolution or removes scene content. Manual High and Balanced remain available.
- Test actual EffectComposer objects through High/Balanced/adaptive sizes instead of extracting production source with a regex. Avoid reallocating unchanged shadow maps.
- Add reproducible capture, CPU profiling and frame-time collection scripts.

## Verification

npm run check and production build passed. Production-browser checks passed 49 assertions with no unexpected errors. Thirty matched screenshot regions, the upper 62% of each viewport excluding the changed lower controls, were pixel-identical. This is a scoped image comparison, not proof of every pixel or every possible motion state.

All run summaries, including unsuccessful experiments and variable repeats, are retained in performance-checkpoint-results.json. Raw local evidence remains under artifacts/audit/ and is git-ignored.

The initial matched desktop runs used 1280x720, Radeon R9 M370X, a ten-second warmup and 240-second director-camera sampling:

| Metric | Baseline | Candidate |
|---|---:|---:|
| Average FPS | 29.86 | 30.12 |
| p99.9 frame time | 83.4 ms | 83.3 ms |
| Average slowest 0.1% FPS | 4.49 | 11.99 |
| Maximum frame time | 983.3 ms | 83.4 ms |
| Frames above 100 ms | 5 | 0 |

There were only eight samples in each slowest-0.1% bucket. The gain is removal of rare severe stalls, not an overall frame-rate breakthrough. A repeated baseline was substantially worse and overlapped reviewer-process restarts; do not treat these runs as a controlled device-lab guarantee. Preserve that result rather than hiding the variance.

A 390x844 desktop test with DPR 2 and 4x CPU throttling averaged 8.90 FPS before and 9.89 after. Its tail remained poor and variable. This is NOT a physical smartphone test and does NOT meet the user's desired old-phone experience. Auto preserves the quality floor rather than concealing this limitation with reduced scenery.

## Still open

- Complete and adjudicate ten authenticated Grok high-effort critiques. Non-Grok fallback responses are excluded; the orchestration is still local work in progress.
- Attribute remaining periodic shadow/submission cost and investigate multi-draw with identical visual output. No experimental batching changes are included here.
- Physical Android/iOS testing, thermal/power/memory behavior and longer repeated tail sampling.
- Full visual/art-direction and mesh-intersection findings remain separate from this performance checkpoint.
- WebGPU/TSL backend parity is not implemented. requestAdapter returned null in the tested browser configuration; the working WebGL2 path is retained. See rendering-research.md for migration prerequisites and sources.

Only nightly is authorized for this work; do not promote to main or dev.
