# Reference study

Reviewed the author’s connected outputs on September 6, 2026, including their media in X’s viewer.

1. [Drawing to Blender](https://x.com/tomkrcha/status/2095756085890310311): a historical engineering sheet with side/front/tender views appears beside a gray steam locomotive. The video shows editable geometry and wireframe selections. The post reports 3,295 editable objects.
2. [Separated parts](https://x.com/tomkrcha/status/2095769596049682643): the clip lifts the cab roof, walls and boiler components, and spreads the running gear around the track.
3. [Vanderbilt study](https://x.com/tomkrcha/status/2095978631696937047): four images show a historical photograph, a completed three-quarter model render, its front view, and exposed running gear beneath the casing. The text mentions additional 2D plans as inputs and identifies the nose’s roundness as needing refinement; those plans are not among these four images.
4. [Python explanation](https://x.com/tomkrcha/status/2096043800875663374): a Blender selection and Python source appear side by side. Geometry is created through scripts.
5. [Interactive demo](https://x.com/tomkrcha/status/2096082580554777041): browser-based locomotive visualization. The author describes generating both trains at runtime with TypeScript and Three.js, without model files.
6. [Railway simulation](https://x.com/tomkrcha/status/2096362653480562751): a later environment and camera demonstration extends the model work into a railway scene.

## Our implementation

The site follows drawing study → parameterized geometry → rendered finish → separate assemblies → assembly replay → interactive inspection. Our generator creates geometry in Python/Blender ahead of time. The browser loads nine exported GLBs per train; it does not regenerate the train geometry in TypeScript.

Our sepia drawing studies are retrospective illustrations generated from our completed renders, not historical drawings, measured plans, or original modeling inputs. Their exact prompts are in `previews/studies/prompts.json`. Render previews come from the procedural Blender models. The assembly replay animates group positions over 12 seconds; it is not a simulation of wheel, piston, steam, or railway physics.

The model review adjusted the heritage frame proportions and the streamlined nose, headlamp and valance surfaces. JSON templates and reusable Python mesh functions preserve those decisions across rebuilds. Original interpretations are intended for visual exploration, not engineering manufacture.
