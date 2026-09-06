# North Star locomotive collection

Two original locomotives inspired by the train models in [Tom Krcha's thread](https://x.com/tomkrcha/status/2095756085890310311). The reference supplies the modeling method and broad design ideas. These are creative interpretations, not measured historical reconstructions.

## Open the models

- `models/heritage/heritage.blend`: North Star No. 07, a forest-green and brass 2-6-0 steam locomotive with a coal tender.
- `models/commodore/commodore.blend`: a midnight-blue Commodore Vanderbilt interpretation with a rounded nose, swept wheel valances, a 4-6-4 chassis, and a matching tender.

Each Blender file has two scenes. **01 • Assembled** contains the finished train on a display track. **02 • Exploded assemblies** spreads its mechanical assemblies apart for inspection. Choose a scene in Blender's top bar.

Collections 01–09 contain the train parts. Collections 90–91 contain the display track and lighting. Individual spokes, wheel rims, rods, rivets, cab panels, and fittings remain separate named objects. The exploded scene uses separate object transforms with shared geometry, so geometry edits carry across views.

## Separate parts

Each model folder includes a complete `.glb` and one `.glb` for each of these assemblies:

| Assembly | Contents |
| --- | --- |
| Boiler / streamlined casing | Main body, domes or nose, casing details |
| Chassis | Frame rails and cross members |
| Wheels and axles | Wheels, spokes, hubs, tyres, and axles |
| Valve gear | Cylinders, connecting rods, coupling rods, bearings, springs |
| Cab and controls | Cab, windows, roof, steps, controls where exposed |
| Fittings and pilot | Front pilot, lamps, external fittings |
| Tender body | Tank, bunker, coal, lettering, trim, ladder |
| Tender bogies | Wheels, axles, suspension frames |
| Couplers | Drawbar and coupling components |

Assembly exports retain their assembled coordinates. Import them together at the origin to rebuild the complete locomotive. Train exports exclude the display track, lights, and cameras. Parts are editable visual assets; they have no print tolerances or mechanical simulation rig.

## Previews

The `previews` folder contains an assembled and exploded PNG for each locomotive.

## Rebuild

Requires Blender 4.5 or later. No third-party Python packages or image textures are required.

```sh
blender --background --threads 8 --python scripts/build_trains.py
```

Build only one model:

```sh
blender --background --threads 8 --python scripts/build_trains.py -- heritage
blender --background --threads 8 --python scripts/build_trains.py -- commodore
```

The generator writes Blender files, GLB assemblies, manifests, and rendered previews. It replaces generated files at those paths. Materials and geometry are procedural. One Blender unit represents one meter; dimensions are chosen for the composition rather than derived from engineering drawings.

## References inspected

- Original steam locomotive and part separation: https://x.com/tomkrcha/status/2095756085890310311
- Commodore Vanderbilt: https://x.com/tomkrcha/status/2095978631696937047
- The thread's interactive example describes the same two locomotives.

## Verify

```sh
python3 scripts/verify_exports.py
blender --background --python scripts/verify_blend.py
```

The checks compare each complete GLB with its nine assembly exports, validate geometry bounds, and reopen the saved Blender files to check both scenes and object counts.

## Website

Explore the collection at [North Star Railworks](https://kvnloo.github.io/north-star-railworks/). The site loads the actual generated GLB assemblies with Three.js. It supports orbit, zoom, side view, separation, assembly visibility, and Blender downloads. No server or API keys are needed.

```sh
npm ci
npm run dev
npm run check
npm run build
```

The asset preparation step copies the tracked models and previews into `public/generated/`. Vite writes the static site to `dist/`. Generated copies, the local Blender runtime, logs, and dependencies are excluded from Git.

## Model templates

`templates/heritage.json` and `templates/commodore.json` set the model title, material colors, cab number, tender lettering, wheel positions and radii, frame dimensions, coal random seed, and tender length. The heritage template also sets dome positions; the Commodore template sets its body lettering. Each wheel pair is `[longitudinal_position, radius]`, in meters. More extensive shape changes belong in the model builder functions in `scripts/build_trains.py`.

Use a copy of a template to make a variant without overwriting the collection:

```sh
blender --background --threads 8 --python scripts/build_trains.py -- \
  --template templates/heritage.json --output /tmp/my-locomotive
```

Skip preview rendering for a faster geometry iteration:

```sh
blender --background --python scripts/build_trains.py -- heritage --no-render
```

The generator uses Blender's Python API. Shared mesh constructors build the components; the two builder functions arrange them into models. Repeated shapes reuse mesh data while keeping independent named objects and transforms. The JSON templates are the configurable inputs; `.blend`, `.glb`, manifests, and PNGs are generated outputs.

## Branches and GitHub Actions

| Branch | Site | Purpose |
| --- | --- | --- |
| `main` | [Production](https://kvnloo.github.io/north-star-railworks/) | Current work and published collection |
| `dev` | [Development preview](https://kvnloo.github.io/north-star-railworks/dev/) | Development branch |
| `nightly` | [Nightly preview](https://kvnloo.github.io/north-star-railworks/nightly/) | Experimental branch |

A push to any of the three branches runs `pages.yml`. Its matrix builds each branch in a separate runner, then a single deployment combines the outputs. This preserves all three URLs when one branch changes. Deployments share a concurrency group so they cannot overwrite one another mid-publish. The `nightly` name is a branch, not a scheduled job.

Pull requests targeting any of these branches run asset checks and a production build. No merge restrictions are imposed on `main`.

The **Regenerate locomotive assets** workflow can be run manually from Actions on any branch. Select one model or both. It downloads checksum-pinned Blender 4.5.3, reads the templates, regenerates the models and previews, verifies them, commits the results to the selected branch, and dispatches the Pages workflow. Normal site deployments use checked-in assets and do not render Blender scenes.

For a fork, update the repository links in `index.html` and this README, then create `main`, `dev`, and `nightly`. Run `scripts/configure_github.sh OWNER/REPO` to enable Actions-based Pages deployment and allow the three branches in its environment. Deployment paths derive from the repository name.
