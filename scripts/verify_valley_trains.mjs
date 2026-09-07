import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {railPoint,route} from '../web/valley/geography.js';
import * as trains from '../web/valley/trains.js';
import {TUNNEL_CLEARANCE_RADIUS} from '../web/valley/railway.js';

const fixtures=[];
let maxTunnelRadius=0;
for(const slug of ['heritage','commodore']) {
 const manifest=JSON.parse(await readFile(new URL(`../models/${slug}/manifest.json`,import.meta.url)));
 const loco=new THREE.Group(),tender=new THREE.Group();
 for(const key of Object.keys(manifest.assemblies)) {
  const [id,title]=key.split(' • ');
  const bytes=await readFile(new URL(`../models/${slug}/${title.toLowerCase().replaceAll(' ','-')}.glb`,import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  (Number(id)>=7?tender:loco).add(gltf.scene);
 }
 fixtures.push({slug,loco,tender});
}
assert.equal(typeof trains.rigModel,'function','Exported GLB wheels must survive merging as axle-centred moving rigs');
for(const {slug,loco,tender} of fixtures) {
 const sourceBounds=new THREE.Box3().setFromObject(loco),tenderBounds=new THREE.Box3().setFromObject(tender);
 const model=trains.rigModel(loco,tender);
 const recenteredTender=new THREE.Box3().setFromObject(model.coal).translate(new THREE.Vector3(model.tenderCenter,0,0));
 assert.ok(recenteredTender.min.distanceTo(tenderBounds.min)<1e-5&&recenteredTender.max.distanceTo(tenderBounds.max)<1e-5,'Tender recentering preserves its exported geometry');
 const bounds=new THREE.Box3().setFromObject(model.locomotive);
 assert.ok(bounds.min.distanceTo(sourceBounds.min)<1e-5 && bounds.max.distanceTo(sourceBounds.max)<1e-5,'Rigging preserves exported rest geometry');
 const wheels=[];model.locomotive.traverse(o=>{if(o.userData.wheelRadius)wheels.push(o);});
 assert.equal(wheels.length,slug==='heritage'?4:7,'Every real axle has a wheel pivot');
 for(const wheel of wheels) {
  const box=new THREE.Box3().setFromObject(wheel);
  assert.ok(Math.abs(box.getCenter(new THREE.Vector3()).x-wheel.getWorldPosition(new THREE.Vector3()).x)<1e-5,'Tyres rotate about axle, not individual spoke origins');
 }
 assert.equal(typeof trains.makeCoach,'function','Coach rig is testable without browser');
 const coach=trains.makeCoach(),coachBogies=[],coachWheels=[];
 coach.traverse(o=>{if(o.userData.bogieX!==undefined)coachBogies.push(o);if(o.userData.wheelRadius)coachWheels.push(o);});
 assert.equal(coachBogies.length,2,'Coach has independently steering two-axle bogies');
 assert.equal(coachWheels.length,4,'Coach has four rolling axle groups');
 const train={loco:model.locomotive,tender:model.coal,gap:model.tenderCenter,coaches:[coach,coach.clone()],line:1,offset:.001};
 trains.positionTrain(train,0);
 const wheel=wheels[0],before=wheel.rotation.z;
 trains.positionTrain(train,.1);
 assert.ok(wheel.rotation.z>before,'Forward -X travel rotates wheels positively about Z');
 assert.ok(Math.abs((wheel.rotation.z-before)*wheel.userData.wheelRadius-.75)<1e-6,'Wheel rotation equals travelled distance / exported tyre radius');
 const linkage=[];model.locomotive.traverse(o=>{if(o.userData.linkage)linkage.push(o);});
 assert.equal(linkage.length,3,'Coupled crank pins/rods and both connecting rods remain animated');
 const linksBefore=linkage.map(o=>o.position.clone());
 trains.positionTrain(train,.2);
 for(let i=0;i<linkage.length;i++)assert.ok(linkage[i].position.distanceTo(linksBefore[i])>.01,'Valve gear follows rotating crank pins');
 const vehicles=[train.loco,train.tender,...train.coaches];
 let meshes=0;for(const v of vehicles)v.traverse(o=>{if(o.isMesh)meshes++;});
 assert.ok(meshes<100,`Merged train draw-call budget, got ${meshes} meshes`);
 const triangles=root=>{let total=0;root.traverse(o=>{if(o.isMesh)total+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return total;};
 assert.equal(triangles(model.locomotive),triangles(loco),'Static merging and wheel rigging preserve every locomotive triangle');
 assert.equal(triangles(model.coal),triangles(tender),'Tender rigging preserves every exported triangle');
 assert.ok(triangles(model.locomotive)<250000,'Locomotive triangle budget');
 const samples=[0,1].map(line=>Array.from({length:8192},(_,i)=>railPoint(i/8192,line)));
 let maxRailError=0,maxGap=0,maxBogieYaw=0;
 for(const line of [0,1])for(let i=0;i<120;i++){
  train.line=line;train.offset=i/120;trains.positionTrain(train,0);
  const facing=new THREE.Vector3(-1,0,0).applyQuaternion(train.loco.quaternion);
  assert.ok(facing.dot(route.getTangentAt(train.t))>.995,'Locomotive nose points down the track');
  assert.ok(train.t>=0&&train.t<1&&train.tenderT>=0&&train.tenderT<1,'Wrapped route parameters');
  for(const v of vehicles)v.traverse(o=>{
   if(o.userData.bogieX!==undefined)maxBogieYaw=Math.max(maxBogieYaw,Math.abs(o.rotation.y));
   if(!o.userData.wheelRadius)return;
   const p=o.getWorldPosition(new THREE.Vector3());p.y=4;
   const error=Math.sqrt(Math.min(...samples[line].map(q=>q.distanceToSquared(p))));
   maxRailError=Math.max(maxRailError,error);
   assert.ok(error<.12,`${slug} line ${line} axle off centerline by ${error}`);
   const axleY=o.getWorldPosition(new THREE.Vector3()).y;
   assert.ok(Math.abs(axleY-o.userData.wheelRadius-4.225)<1e-5,'Tyres meet rail tops, not sleepers');
  });
  for(const vehicle of vehicles){
   if(Math.abs(vehicle.position.x)>48||vehicle.position.z>-65)continue;
   vehicle.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const positions=mesh.geometry.getAttribute('position'),world=new THREE.Vector3();
    for(let vertex=0;vertex<positions.count;vertex++){
     world.fromBufferAttribute(positions,vertex).applyMatrix4(mesh.matrixWorld);
     if(Math.abs(world.x)<29&&world.z<-60){
      const radius=Math.hypot(world.y-3.6,world.z+84);
      maxTunnelRadius=Math.max(maxTunnelRadius,radius);
     }
    }
   });
  }
  for(let n=1;n<vehicles.length;n++){
   const gap=vehicles[n].position.distanceTo(vehicles[n-1].position);maxGap=Math.max(maxGap,gap);
   assert.ok(gap>4&&gap<10,'Consist spacing stays bounded around curves');
  }
  const trackStart=railPoint(train.t,line);trains.positionTrain(train,.01);
  assert.ok(Math.abs(trackStart.distanceTo(railPoint(train.t,line))-.075)<.001,'Both track lines use physical arc distance, not the inner route length');
  for(const rod of linkage.filter(o=>o.userData.linkage.kind==='connecting')){
   const link=rod.userData.linkage,axis=new THREE.Vector3(0,1,0).applyQuaternion(rod.quaternion);
   const end=rod.position.clone().addScaledVector(axis,link.length/2),start=rod.position.clone().addScaledVector(axis,-link.length/2);
   const coupled=linkage.find(o=>o.userData.linkage.kind==='coupled');
   assert.ok(Math.abs(end.x-(link.axleX+link.x+coupled.position.x))<1e-5&&Math.abs(end.y-(link.axleY+link.y+coupled.position.y))<1e-5,'Connecting rod stays on the animated crank pin');
   assert.ok(Math.abs(start.y-link.sliderY)<1e-5,'Piston end slides horizontally without changing rod length');
  }
 }
 assert.ok(maxBogieYaw>.005&&maxBogieYaw<.2,`Bogie yaw stays local to car, got ${maxBogieYaw}`);
 const snapshot=()=>vehicles.flatMap(v=>{const values=[];v.traverse(o=>values.push(...o.position.toArray(),...o.quaternion.toArray()));return values;});
 trains.positionTrain(train,83.2);const first=snapshot();trains.positionTrain(train,-2);trains.positionTrain(train,83.2);assert.deepEqual(snapshot(),first,'Seek/replay has no accumulated transforms');
 train.offset=.999999;trains.positionTrain(train,0);const p=train.loco.position.clone();trains.positionTrain(train,.002);assert.ok(p.distanceTo(train.loco.position)<.02,'No positional jump at route seam');
 console.log(`${slug}: ${wheels.length} locomotive axles, ${meshes} meshes/service; 240 route poses, max axle error ${maxRailError.toFixed(4)}, max spacing ${maxGap.toFixed(3)}, bogie yaw ${maxBogieYaw.toFixed(3)}; rolling, rail height, replay and seam passed`);
}
assert.ok(maxTunnelRadius<TUNNEL_CLEARANCE_RADIUS-.1,`Actual train hull needs tunnel radius greater than ${maxTunnelRadius}`);
