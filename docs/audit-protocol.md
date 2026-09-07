# Frozen independent critique protocol

Baseline: 0f45925692556121ada0ca3eb681313ef341cad7, nightly scene. No implementation changes are exposed to initial reviewers.

Ten separate Grok 4.6 sessions request high reasoning effort. Each receives the same requirements and source snapshot, a pair-specific screenshot contact sheet, and a primary examination area. Five pairs provide independent overlap. No reviewer receives author identity, previous reviews, benchmark claims, another reviewer's findings, or implementation plans. Review output is anonymized before adjudication. This is a blinded independent review protocol, not a claim of a clinical double-blind experiment or ten independent model families. The coordinator necessarily knows the implementation.

Requirements derived from docs/active-goal.md:
R1 Preserve illustrated workshop, nonoverlapping exploded assemblies and replay.
R2 Convincing richly forested mountain environment inspired by God of War and Assassin's Creed Valhalla; no sparse substitutions or primitive-looking stand-ins.
R3 Convincing continuous track, tunnel, two stations, town; no unintended overlapping, floating, clipping, z-fighting meshes or implausible scale/material mapping.
R4 Multiple moving articulated trains with correct wheel pivots, rods, bogies, rail contact and spacing.
R5 Stable FPV/tracking/aerial/town/tunnel/orbit cameras, clear subject framing, safe transitions, no environment penetration or occlusion that hides the subject.
R6 Polished readable responsive accessible controls, touch/keyboard, reduced motion, loading and error paths.
R7 Usable sustained performance, reproducible source, free-asset license traceability, actual rendered verification.
Additional current request R8: prioritize 0.1% FPS lows, investigate modern Three.js/WebGPU techniques and automatic per-device optimization without quietly lowering the accepted visual target.

Evidence rules: source supports code findings only; still images support visible-state findings only. Do not invent motion observations, frame rates, physical-device results, browser actions or benchmark numbers. State uncertainty. Return maximum 12 nonduplicative meaningful findings per reviewer, including requirement ID, severity, precise evidence, reproduction, suggested correction, and verification. Scores are subjective and must not imply measured FPS.

Performance protocol: one browser at a time, production bundles, fixed camera itinerary and simulation start; baseline and candidate same viewport/backend; retain raw requestAnimationFrame timestamps, long tasks and resource timing. Warm and cold phases separate. Report mean FPS, p50/p95/p99/p99.9 frame times, reciprocal p99.9 FPS and average slowest 0.1% FPS as different metrics. Record tail sample counts; do not imply stable p99.9 from a few hundred frames. Throttled desktop is a sensitivity experiment, never an old-phone measurement. No thermal or device-wide guarantee from headless tests. WebGPU adapter must actually be available, and backend/feature parity must be verified before claiming a migration gain.
