"""Check exported GLB structure, finite geometry bounds, and complete assembly coverage."""
import json, math, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read_glb(path):
    data=path.read_bytes()
    magic,version,length=struct.unpack_from('<III',data)
    assert magic==0x46546c67 and version==2 and length==len(data), path
    size,kind=struct.unpack_from('<II',data,12)
    assert kind==0x4e4f534a, path
    doc=json.loads(data[20:20+size])
    assert doc.get('meshes') and doc.get('nodes'),path
    assert not doc.get('cameras'),path
    for acc in doc.get('accessors',[]):
        for key in ['min','max']:
            assert all(math.isfinite(v) for v in acc.get(key,[])),(path,key)
    return doc
for slug in ['heritage','commodore']:
    directory=ROOT/'models'/slug
    manifest=json.loads((directory/'manifest.json').read_text())
    complete=read_glb(directory/(slug+'.glb'))
    names={n['name'] for n in complete['nodes'] if 'mesh' in n}
    parts=[]
    for path in directory.glob('*.glb'):
        if path.stem==slug:continue
        doc=read_glb(path)
        parts.extend(n['name'] for n in doc['nodes'] if 'mesh' in n)
    assert len(list(directory.glob('*.glb')))==10,(slug,'expected full model plus nine assemblies')
    assert len(parts)==len(set(parts)),(slug,'duplicate assembly membership')
    assert set(parts)==names,(slug,'assembly exports do not cover full model')
    assert len(names)==manifest['object_count'],(slug,len(names),manifest['object_count'])
    assert (directory/(slug+'.blend')).stat().st_size>100_000
    for suffix in ['', '-exploded']:
        assert (ROOT/'previews'/(slug+suffix+'.png')).read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
    print(f'{slug}: {len(names)} objects, 9 assemblies, complete coverage, valid GLBs and previews')
