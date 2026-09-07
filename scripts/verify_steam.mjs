import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSteam} from '../web/valley/trains.js';
// Geometry/attribute test only. Real alpha texture and shader are checked in Chromium.
globalThis.document={createElement:()=>({width:128,height:128,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
const scene=new THREE.Scene();const steam=makeSteam(scene);
assert.equal(scene.children.length,1,'steam must use a single batched draw rather than 96 sprites');
const mesh=scene.children[0];assert(mesh.isInstancedMesh);assert.equal(mesh.count,96);
const roster=[{line:0,t:.2},{line:1,t:.3},{line:0,t:.6},{line:1,t:.8}];
steam.update(5,roster);
assert([...mesh.instanceMatrix.array].every(Number.isFinite));
const opacity=mesh.geometry.getAttribute('puffOpacity');
assert.equal(opacity.count,96);assert([...opacity.array].every(v=>v>=0&&v<=.68));
const before=Array.from(mesh.instanceMatrix.array);steam.update(5,roster);assert.deepEqual(Array.from(mesh.instanceMatrix.array),before);
steam.update(6,roster);assert.notDeepEqual(Array.from(mesh.instanceMatrix.array),before);
console.log('Steam checks passed: one instanced batch, 96 finite deterministic puffs, bounded opacity.');
