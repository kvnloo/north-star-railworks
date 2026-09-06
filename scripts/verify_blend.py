"""Open the delivered Blender files and check saved scenes and editable assemblies."""
import bpy, json, math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
for slug in ['heritage','commodore']:
    path=root/'models'/slug
    manifest=json.loads((path/'manifest.json').read_text())
    bpy.ops.wm.open_mainfile(filepath=str(path/(slug+'.blend')))
    assert len(bpy.data.scenes)==2
    assembled=bpy.data.scenes['01 • Assembled']
    exploded=bpy.data.scenes['02 • Exploded assemblies']
    parts=[o for o in assembled.objects if o.get('model')==manifest['title']]
    moved=[o for o in exploded.objects if o.get('model')==manifest['title']]
    assert len(parts)==len(moved)==manifest['object_count']
    assert assembled.camera and exploded.camera and assembled.camera!=exploded.camera
    assert len({o['assembly'] for o in parts})==9
    assert all(math.isfinite(v) for o in parts+moved for v in o.location)
    assert all(o.type in {'MESH','CURVE','FONT'} for o in parts)
    assert all(len(o.data.materials)>0 for o in parts)
    print('BLEND_VERIFIED',slug,len(parts),'editable objects, 2 scenes, 9 assemblies',flush=True)
