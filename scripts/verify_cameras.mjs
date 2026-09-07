import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cameraShot,cameraFloor,blendCamera,CAMERA_MODES} from '../web/valley/cameras.js';
let shots=0,transitions=0;
for(const mode of CAMERA_MODES)for(const line of [0,1])for(const aspect of [16/9,1,390/844])for(let i=0;i<180;i++){
 const desired=cameraShot({mode,seconds:i,t:i/180,line,aspect});
 assert.ok([...desired.eye.toArray(),...desired.target.toArray(),desired.fov].every(Number.isFinite));
 assert.ok(desired.eye.y>=cameraFloor(desired.eye.x,desired.eye.z)-1e-8);
 assert.ok(desired.eye.distanceTo(desired.target)>5);
 assert.ok(desired.fov>=40&&desired.fov<=66);
 shots++;
}
const camera=new THREE.PerspectiveCamera();
for(const mode of CAMERA_MODES){
 const desired=cameraShot({mode,seconds:25,t:.33});
 for(let frame=0;frame<160;frame++){
  blendCamera(camera,desired,1/60);
  assert.ok(camera.position.y>=cameraFloor(camera.position.x,camera.position.z)-1e-8);
  assert.ok(Math.abs(camera.quaternion.length()-1)<1e-8);
  transitions++;
 }
}
const a=cameraShot({mode:'fpv',seconds:0,t:.4,reduced:true}),b=cameraShot({mode:'fpv',seconds:50,t:.4,reduced:true});
assert.deepEqual(a.eye.toArray(),b.eye.toArray());assert.equal(a.bank,0);
assert.throws(()=>cameraShot({mode:'unknown',seconds:0,t:0}),/Unknown camera/);
console.log(`Camera checks passed: ${shots} route/viewport shots, ${transitions} transition frames, terrain and tunnel clearance, reduced-motion FPV.`);
