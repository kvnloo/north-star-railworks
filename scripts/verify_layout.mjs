import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createExplodedLayout,projectedBounds,assemblyProgress,fitZoom,VIEW_DIRECTION,corners} from '../web/exploded-layout.js';
for (const slug of ['heritage','commodore']) {
  const manifest = JSON.parse(await readFile(`models/${slug}/manifest.json`));
  const assemblies = new Map();
  for (const name of Object.keys(manifest.assemblies)) {
    const [id,title] = name.split(' • ');
    const data = await readFile(`models/${slug}/${title.toLowerCase().replaceAll(' ','-')}.glb`);
    const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
    const group = new THREE.Group(); group.add(gltf.scene);
    assemblies.set(id,{group});
  }
  const layout = createExplodedLayout(assemblies);
  const rectangles = [...layout.entries].map(([id,entry]) => ({id,box:projectedBounds(entry.box,layout.offsets.get(id))}));
  for (let a=0;a<rectangles.length;a++) for(let b=a+1;b<rectangles.length;b++) assert.ok(!rectangles[a].box.intersectsBox(rectangles[b].box),`${slug}: ${rectangles[a].id} overlaps ${rectangles[b].id}`);
  for (const aspect of [0.65,1,1.8,2.5]) {
    const span=Math.max(11,18/aspect);
    const camera=new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,0.1,150);
    const target = new THREE.Vector3(1.5,1.5,0);
    camera.position.copy(target).addScaledVector(VIEW_DIRECTION,24); camera.lookAt(target);
    for(let progress=0;progress<=1.001;progress+=0.025) {
      for(const [id,entry] of assemblies) entry.group.position.copy(layout.offsets.get(id)).multiplyScalar(assemblyProgress(id,Math.min(progress,1)));
      camera.zoom=fitZoom(assemblies,camera,target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      for(const {group,bounds} of assemblies.values()) for(const corner of corners(bounds.clone().translate(group.position))) {
        corner.project(camera);
        assert.ok(Math.abs(corner.x)<1 && Math.abs(corner.y)<1,`${slug}: clipped at ${aspect}, ${progress}`);
      }
    }
  }
  for(const id of assemblies.keys()) {
    assert.equal(assemblyProgress(id,0),0); assert.equal(assemblyProgress(id,1),1);
    let previous=0;
    for(let p=0;p<=1;p+=.001) { const next=assemblyProgress(id,p); assert.ok(next>=previous && next<=1); previous=next; }
  }
  console.log(`${slug}: nine non-overlapping projected assembly bounds; all motion frames fit at four aspect ratios; continuous ordered motion.`);
}
