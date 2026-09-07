import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';

// Geometry/LOD verification only. No WebGL, image decode, shader compilation,
// rendered-quality or FPS claim is made by this script.
THREE.TextureLoader.prototype.load=function(url,onLoad){
 const texture=new THREE.Texture({width:1,height:1,complete:true});
 queueMicrotask(()=>onLoad?.(texture));return texture;
};
const {makeEnvironment}=await import('../web/valley/environment.js');
const {FOREST_LOD_DISTANCE,FOREST_LOD_HYSTERESIS}=await import('../web/valley/forest.js');
const {terrainHeight,distanceToRail,inTown,inTunnel,random,fbm,railPoint}=await import('../web/valley/geography.js');

// Frozen placement algorithm from the recovered environment, including RNG
// consumed by rock transforms and both branch/leaf colour passes.
function originalPlacements(){
 const rng=random(918),result=[];
 let rocks=0;
 for(let i=0;i<1500&&rocks<520;i++){
  const x=(rng()-.5)*670,z=(rng()-.5)*550,h=terrainHeight(x,z);
  if(h<0||distanceToRail(x,z)<7||inTown(x,z)||inTunnel(x,z))continue;
  for(let j=0;j<6;j++)rng();rocks++;
 }
 for(let species=0;species<6;species++){
  const points=[],wanted=species<3?340:species===5?240:75;
  for(let attempt=0;attempt<wanted*8&&points.length<wanted;attempt++){
   const x=(rng()-.5)*510,z=(rng()-.5)*410,h=terrainHeight(x,z);
   if(h<.9||h>115||distanceToRail(x,z)<12||inTown(x,z)||inTunnel(x,z))continue;
   if(fbm(x*.02+30,z*.02)<.32&&rng()<.7)continue;
   const base=species<3?.34:species===5?.17:.3;
   points.push({x,z,h,scale:base*(.65+rng()*.8),angle:rng()*Math.PI*2});
  }
  for(let i=0;i<points.length*6;i++)rng();result.push(...points);
 }
 return result;
}
function rendererDouble(){
 let target=null,color=new THREE.Color(0x123456),alpha=.5;
 return {
  capabilities:{getMaxAnisotropy:()=>8},autoClear:true,toneMapping:THREE.ACESFilmicToneMapping,renders:0,
  getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},getClearColor:out=>out.copy(color),getClearAlpha:()=>alpha,
  setClearColor:(value,a)=>{color.set(value);alpha=a;},clear(){},
  render(scene,camera){
   assert(target?.isWebGLRenderTarget);assert.equal(target.viewport.z,256);assert.equal(target.viewport.w,256);
   assert(camera.isOrthographicCamera);assert.equal(scene.children.length,3);this.renders++;
  }
 };
}
const scene=new THREE.Scene(),renderer=rendererDouble();
const environment=await makeEnvironment(scene,renderer);
assert.equal(renderer.renders,48);assert.equal(renderer.getRenderTarget(),null);assert.equal(renderer.autoClear,true);
assert.equal(renderer.toneMapping,THREE.ACESFilmicToneMapping);assert.equal(renderer.getClearAlpha(),.5);
assert.equal(renderer.getClearColor(new THREE.Color()).getHex(),0x123456);
assert.equal(environment.treeCount,1410);assert.equal(environment.fernCount,1700);
const {forest}=environment;
const rocks=scene.children.find(object=>object.isInstancedMesh&&object.geometry.type==='IcosahedronGeometry');
rocks.geometry.computeBoundingSphere();
const protectedTown=new THREE.Box2(new THREE.Vector2(-52,88),new THREE.Vector2(52,149));
for(let i=0;i<rocks.count;i++){
 const matrix=new THREE.Matrix4();rocks.getMatrixAt(i,matrix);
 const sphere=rocks.geometry.boundingSphere.clone().applyMatrix4(matrix);
 const footprint=new THREE.Box2(new THREE.Vector2(sphere.center.x-sphere.radius,sphere.center.z-sphere.radius),new THREE.Vector2(sphere.center.x+sphere.radius,sphere.center.z+sphere.radius));
 assert(!footprint.intersectsBox(protectedTown),'rock volume must not intrude into town');
 for(const line of [0,1])for(let sample=0;sample<360;sample++){
  const p=railPoint(sample/360,line);
  assert(Math.hypot(p.x-sphere.center.x,p.z-sphere.center.z)>sphere.radius+2.9,'rock volume must clear both tracks');
 }
}
const points=forest.chunks.flatMap(chunk=>chunk.points);
assert.equal(points.length,1410);
assert.equal(new Set(points.map(p=>`${p.x},${p.z}`)).size,1410);
const placementRows=rows=>rows.map(({x,z,h,scale,angle})=>[x,z,h,scale,angle]).sort((a,b)=>a[0]-b[0]);
assert.deepEqual(placementRows(points),placementRows(originalPlacements()),'do not move or remove the recovered forest');
for(const p of points){assert.equal(p.h,terrainHeight(p.x,p.z));assert(distanceToRail(p.x,p.z)>=12);assert(!inTown(p.x,p.z));assert(!inTunnel(p.x,p.z));assert(p.h>=.9&&p.h<=115);}
for(const chunk of forest.chunks){
 assert(chunk.points.length<100,'spatial chunks must stay local');
 assert.equal(chunk.meshes.length,3);
 for(const mesh of chunk.meshes){
  assert(mesh.frustumCulled);assert.equal(mesh.count,chunk.points.length);
  for(let i=0;i<mesh.count;i++){
   const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);
   assert(Math.abs(matrix.elements[12]-chunk.points[i].x)<.00002);
   assert(Math.abs(matrix.elements[14]-chunk.points[i].z)<.00002);
  }
 }
}
const tri=geometry=>(geometry.index?.count??geometry.attributes.position.count)/3;
const detailedTriangles=forest.chunks.reduce((sum,c)=>sum+c.points.length*(tri(c.meshes[0].geometry)+tri(c.meshes[1].geometry)),0);
assert.equal(detailedTriangles,8606770,'retain original near-tree geometry');
for(const atlas of forest.atlases){
 assert.equal(tri(atlas.geometry),2);assert.equal(atlas.target.width,1024);assert.equal(atlas.target.height,512);
 const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};
 atlas.material.onBeforeCompile(shader);
 assert(!shader.vertexShader.includes('#include <project_vertex>'));
 assert(!/position\.[xy]--/.test(shader.vertexShader),'negative atlas centers must not produce GLSL decrement operators');
 assert(!shader.fragmentShader.includes('#include <map_fragment>'));
 assert(shader.vertexShader.includes('vTreeView ='));
 assert(shader.fragmentShader.includes('texture2D(map,atlasUv)'));
}
const camera=new THREE.PerspectiveCamera(55,16/9,.2,1800);
function coverage(){
 let near=0,far=0,triangles=0;
 for(const c of forest.chunks){
  assert.equal(c.meshes[0].visible,c.meshes[1].visible);assert.notEqual(c.meshes[0].visible,c.meshes[2].visible);
  if(c.far)far+=c.points.length;else near+=c.points.length;
  for(const mesh of c.meshes)if(mesh.visible)triangles+=tri(mesh.geometry)*mesh.count;
 }
 assert.equal(near+far,1410);return {near,far,triangles};
}
camera.position.set(10000,10000,10000);environment.update(camera,19.5);
assert.deepEqual(coverage(),{near:0,far:1410,triangles:2820});
for(const material of forest.materials){
 environment.update(null,19.5);
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader};material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.uTime.value,19.5);
 environment.update(null,23);assert.equal(shader.uniforms.uTime.value,23);
}
for(const chunk of forest.chunks){
 chunk.bounds.getCenter(camera.position);environment.update(camera,0);assert.equal(chunk.far,false);
 camera.position.set(chunk.bounds.max.x+FOREST_LOD_DISTANCE+FOREST_LOD_HYSTERESIS+1,(chunk.bounds.min.y+chunk.bounds.max.y)/2,(chunk.bounds.min.z+chunk.bounds.max.z)/2);
 environment.update(camera,0);assert.equal(chunk.far,true);
 camera.position.x=chunk.bounds.max.x+FOREST_LOD_DISTANCE;environment.update(camera,0);assert.equal(chunk.far,true,'hysteresis retains far');
 camera.position.x=chunk.bounds.max.x+FOREST_LOD_DISTANCE-FOREST_LOD_HYSTERESIS-1;environment.update(camera,0);assert.equal(chunk.far,false);
 coverage();
}
const views=[];
for(const position of [[-115,13,0],[48,36,156],[-52,9,-65],[100,110,100],[0,400,0]]){
 camera.position.fromArray(position);camera.lookAt(0,10,0);camera.updateMatrixWorld();environment.update(camera,4);
 const full=coverage();
 const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 let culledChunks=0,visibleTriangles=0,draws=0;
 for(const chunk of forest.chunks){
  if(!frustum.intersectsBox(chunk.bounds))culledChunks++;
  for(const mesh of chunk.meshes)if(mesh.visible&&frustum.intersectsObject(mesh)){visibleTriangles+=tri(mesh.geometry)*mesh.count;draws++;}
 }
 assert(full.triangles<detailedTriangles);assert(culledChunks>0||position[1]===400);
 views.push({position,...full,culledChunks,visibleTriangles,draws});
}
const hash=env=>createHash('sha256').update(JSON.stringify(env.forest.chunks.map(c=>c.points))).digest('hex');
const second=await makeEnvironment(new THREE.Scene(),rendererDouble());
assert.equal(hash(environment),hash(second),'repeated construction must reset seeded RNG');
assert.equal(second.rockCount,environment.rockCount);assert.equal(second.fernCount,environment.fernCount);
console.log(JSON.stringify({pass:true,trees:environment.treeCount,species:environment.trees.length,chunks:forest.chunks.length,rocks:environment.rockCount,ferns:environment.fernCount,detailedTriangles,allFarTriangles:2820,placementHash:hash(environment),views,limitations:'Geometry-only renderer double; parent must inspect real atlas textures, shaders, LOD transitions and FPS.'},null,2));
