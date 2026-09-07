# Rendering research and decisions

Stack under audit: Three.js WebGLRenderer, EffectComposer/UnrealBloomPass, custom onBeforeCompile GLSL for foliage/atlas/steam/water, EZ Tree geometry, GLB articulated trains, Vite static Pages deployment. Consult package-lock.json for exact installed revisions.

## Sources inspected

- Three.js WebGPURenderer migration guide: https://threejs.org/manual/en/webgpurenderer.html
- Three.js renderer capabilities and compileAsync: https://threejs.org/docs/pages/WebGLRenderer.html
- Nonblocking shader completion: https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile
- WebGL resource/pipeline practices: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- BatchedMesh/multi-draw and per-object culling: https://threejs.org/docs/pages/BatchedMesh.html
- WebGPU specification and explicit pipelines: https://gpuweb.github.io/gpuweb
- Android WebGPU rollout and timestamp queries, historical compatibility context, not a current exhaustive device list: https://developer.chrome.com/blog/new-in-webgpu-121
- Frame pacing and responsiveness: https://web.dev/articles/rendering-performance
- Rust wgpu scope and browser backends: https://docs.rs/wgpu/latest/wgpu/

## Decisions grounded in this scene

1. Precompile scene materials and upload textures before revealing the scene. The baseline CPU trace attributes multiple seconds to WebGLProgram's first-use shader status/log inspection. The four-minute baseline includes a 983.3 ms animation frame. compileAsync uses KHR_parallel_shader_compile where available. Keep shader error checks enabled. Moving cost to an explicit loading phase is not eliminating loading cost; report both.
2. Freeze only immutable scene transforms before adding moving trains and steam. Runtime shaders/instance buffers remain live. Compare rendered output and moving-part tests. This removes repeated matrix composition without changing geometry, textures, lighting or density.
3. Automatic detail must use measured sustained frame timing with hysteresis, cooldown and pause/visibility resets. Device RAM/core-count hints are not performance measurements. Preserve the existing Balanced quality floor; use spare capacity for supersampling and return to baseline under sustained pressure. If baseline is too expensive for an old phone, report that limitation rather than silently thinning the forest or promising impossible parity.
4. Do not blindly swap WebGLRenderer for WebGPURenderer. Custom GLSL injection and EffectComposer need TSL/node-material and postprocessing migration with visual parity on both backends. The actual test laptop exposes navigator.gpu but requestAdapter returns null. No WebGPU speedup or native-phone result can be claimed from that machine.
5. wgpu is a Rust graphics library and browser implementation component, not a performance switch for this JavaScript application. Rewriting this scene in Rust/Wasm is not justified without a measured CPU bottleneck that dominates crossing/porting costs. The suitable incremental experiment is a Three.js WebGPU/TSL parity branch on capable hardware.
6. Evaluate GPU-driven frustum/occlusion culling, indirect drawing and compute-driven particles only after a real WebGPU backend is available. Draw-call-bound scenes can benefit; fill-rate/triangle-bound scenes may not. Preserve foliage wind, normals, alpha coverage, shadow silhouettes and route articulation in comparisons.
7. Existing instancing/material merging already reduces train submission count. Further batching must preserve per-object culling. A single world-sized merge can worsen invisible geometry work. BatchedMesh multi-draw availability and fallback behavior require a real device benchmark, not a draw-call-count claim alone.
8. Offline mesh optimization, glTF meshopt compression and KTX2/Basis textures are candidates for startup/bandwidth/VRAM, not automatic frame-time improvements. Validate decoding cost and retained normals/tangents/alpha edges. Lossy texture or geometry compression needs explicit visual acceptance; do not slip it into a no-quality-loss performance pass.
9. Prebaked tree atlases and worker-based geometry generation could reduce startup main-thread stalls. They need reproducible asset generation, source-license preservation and reduced runtime bundle size. They do not automatically fix shader or shadow frame spikes. OffscreenCanvas/worker rendering also requires tested DOM/control/error integration and should follow attribution rather than precede it.
10. Shadow work is periodic and high-geometry. A static/dynamic shadow cache could reduce worst frames while preserving shadows, but blindly lowering update rate makes moving-train shadows less accurate. Treat caching as a separate image-equivalence experiment. Do not disable bloom, shadows or near-tree detail to manufacture a benchmark win.

## Measurement limits

requestAnimationFrame intervals measure delivered animation cadence, not pure GPU execution time. CPU traces perturb timing and run separately. A four-minute baseline contains only eight samples in the slowest 0.1% bucket, so tail estimates are diagnostic, not precise population guarantees. Report raw data, repeat tests and compare distributions. Mobile viewport/CPU throttling does not emulate mobile GPU bandwidth, drivers, memory limits, battery or thermal throttling. Physical Android/iOS testing remains required.
