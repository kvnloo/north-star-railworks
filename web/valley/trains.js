import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {railPoint,route} from './geography.js';
function mergeModel(root) {
 root.updateMatrixWorld(true);const buckets=new Map();
 root.traverse(object=>{if(!object.isMesh)return;const key=object.material.uuid+Object.keys(object.geometry.attributes).sort().join(',')+Boolean(object.geometry.index);if(!buckets.has(key))buckets.set(key,{material:object.material,geometries:[]});const geometry=object.geometry.clone();geometry.applyMatrix4(object.matrixWorld);buckets.get(key).geometries.push(geometry);});
 const group=new THREE.Group();
 for(const {material,geometries} of buckets.values()){
  const mesh=new THREE.Mesh(mergeGeometries(geometries),material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);for(const geometry of geometries)geometry.dispose();
 }
 return group;
}
// The GLBs use -X forward, Y up and Z axles. Keep rotating parts out of
// the static material merge; their spoke origins are not wheel pivots.
function rigVehicle(source,center=0,isTender=false) {
 source.updateMatrixWorld(true);
 const meshes=[];source.traverse(o=>{if(o.isMesh)meshes.push(o);});
 const tyres=meshes.filter(o=>o.name.endsWith('steel_tyre'));
 const axles=tyres.filter(o=>o.position.z>0).map(o=>({
  x:o.position.x,y:o.position.y,radius:new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).x/2,
  prefix:o.name.replace(/(?:L|R|-?1)_steel_tyre$/,''),
 })).sort((a,b)=>a.x-b.x);
 const vehicle=new THREE.Group(),body=new THREE.Group();
 const maxRadius=Math.max(...axles.map(a=>a.radius));
 const drivers=axles.filter(a=>a.radius>=maxRadius*.8);
 const coupling=new THREE.Group();
 const pin=meshes.find(o=>/^Crank_pin/.test(o.name));
 const crank=pin?{x:pin.position.x-drivers[0].x,y:pin.position.y-drivers[0].y,radius:maxRadius}:null;
 if(crank){coupling.userData.linkage={kind:'coupled',...crank};vehicle.add(coupling);}
 const bogieSets=isTender?[axles.slice(0,2),axles.slice(2)]:[
  axles.filter(a=>a.radius<maxRadius*.8&&a.x<0),
  axles.filter(a=>a.radius<maxRadius*.8&&a.x>0),
 ];
 const bogies=bogieSets.filter(a=>a.length).map(set=>{
  const group=new THREE.Group(),x=set.reduce((sum,a)=>sum+a.x,0)/set.length;
  group.position.x=x-center;group.userData.bogieX=x-center;group.userData.wheelbase=set.length>1?set.at(-1).x-set[0].x:.5;
  vehicle.add(group);for(const axle of set)axle.bogie=group;
  return group;
 });
 for(const axle of axles){
  const group=new THREE.Group();group.name=`Axle pivot ${axle.x}`;
  group.userData.wheelRadius=axle.radius;group.userData.axleX=axle.x-center;
  group.position.set(axle.x-center-(axle.bogie?.position.x||0),axle.y,0);
  (axle.bogie||vehicle).add(group);axle.group=group;
 }
 for(const mesh of meshes){
  let axle=axles.find(a=>mesh.name.startsWith(a.prefix)&&/^(Wheel_|Tender_\d)/.test(mesh.name));
  if(/^(Axle_\d|Tender_axle)/.test(mesh.name))axle=axles.find(a=>Math.abs(a.x-mesh.position.x)<1e-4);
  let parent=axle?.group;
  if(!parent&&/^Bogie_/.test(mesh.name))parent=bogies.reduce((a,b)=>Math.abs(a.position.x+center-mesh.position.x)<Math.abs(b.position.x+center-mesh.position.x)?a:b);
  parent ||= body;
  const copy=mesh.clone();copy.applyMatrix4(mesh.parent.matrixWorld);copy.position.x-=center;
  if(crank&&/^(Crank_pin|Coupling_rod|Rod_bearing)/.test(mesh.name)){coupling.add(copy);continue;}
  if(crank&&/^Main_connecting_rod/.test(mesh.name)){
   copy.geometry.computeBoundingBox();const bounds=copy.geometry.boundingBox;
   const start=new THREE.Vector3(0,bounds.min.y,0).applyQuaternion(copy.quaternion).add(copy.position);
   const end=new THREE.Vector3(0,bounds.max.y,0).applyQuaternion(copy.quaternion).add(copy.position);
   copy.userData.linkage={kind:'connecting',...crank,axleX:end.x-crank.x,axleY:end.y-crank.y,sliderY:start.y,length:start.distanceTo(end),z:copy.position.z};
   copy.castShadow=true;copy.receiveShadow=true;vehicle.add(copy);continue;
  }
  if(parent!==body){copy.position.sub(parent.position);if(axle?.bogie)copy.position.sub(axle.bogie.position);}
  parent.add(copy);
 }
 vehicle.add(mergeModel(body));
 if(crank){const parts=new THREE.Group();for(const child of [...coupling.children])parts.add(child);coupling.add(mergeModel(parts));}
 for(const bogie of bogies){const parts=new THREE.Group();for(const child of [...bogie.children])if(child.isMesh)parts.add(child);bogie.add(mergeModel(parts));}
 for(const axle of axles){const group=axle.group;const parts=new THREE.Group();for(const child of [...group.children])parts.add(child);group.add(mergeModel(parts));}
 const supports=isTender?bogies.map(b=>b.position.x):[drivers[0].x-center,drivers.at(-1).x-center];
 vehicle.userData.supports=supports;
 vehicle.userData.railLift=.225-Math.min(...axles.map(a=>a.y-a.radius));
 return vehicle;
}
export function rigModel(loco,tender) {
 const tenderCenter=new THREE.Box3().setFromObject(tender).getCenter(new THREE.Vector3()).x;
 return {locomotive:rigVehicle(loco),coal:rigVehicle(tender,tenderCenter,true),tenderCenter};
}
export async function loadTrains(scene,onProgress) {
 const loader=new GLTFLoader(),models={};
 for(const slug of ['heritage','commodore']) {
  onProgress(`Preparing ${slug==='heritage'?'North Star':'Commodore Vanderbilt'}…`);
  const base=`${import.meta.env.BASE_URL}generated/models/${slug}/`;
  const manifest=await fetch(base+'manifest.json').then(r=>r.json());
  const loco=new THREE.Group(),tender=new THREE.Group();
  for(const name of Object.keys(manifest.assemblies)) {
   const [id,title]=name.split(' • ');const gltf=await loader.loadAsync(base+title.toLowerCase().replaceAll(' ','-')+'.glb');
   (Number(id)>=7?tender:loco).add(gltf.scene);
  }
  models[slug]=rigModel(loco,tender);
 }
 const roster=[{name:'North Star · Morning service',slug:'heritage',line:0,offset:.73},{name:'Commodore · Highland express',slug:'commodore',line:1,offset:.25},{name:'North Star · Valley local',slug:'heritage',line:0,offset:.23},{name:'Commodore · Evening mail',slug:'commodore',line:1,offset:.75}];
 const coachTemplate=makeCoach();
 for(const train of roster){const template=models[train.slug];train.loco=template.locomotive.clone();train.tender=template.coal.clone();train.gap=template.tenderCenter;train.coaches=[coachTemplate.clone(),coachTemplate.clone()];scene.add(train.loco,train.tender,...train.coaches);}
 return roster;
}
export function makeCoach() {
 const group=new THREE.Group();
 const paint=new THREE.MeshStandardMaterial({color:0x344b3b,roughness:.4,metalness:.3});const trim=new THREE.MeshStandardMaterial({color:0xbaa778,metalness:.7,roughness:.35});const steel=new THREE.MeshStandardMaterial({color:0x252b2d,metalness:.7,roughness:.5});const glass=new THREE.MeshStandardMaterial({color:0xd5d3ae,emissive:0x765a2f,emissiveIntensity:.25,metalness:.35,roughness:.15});
 const box=(size,p,material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...p);group.add(mesh);};
 box([8.6,2.1,2.5],[0,2,0],paint);box([8.9,.22,2.7],[0,3.15,0],steel);box([9,.16,2.65],[0,1.1,0],trim);box([8.8,.5,2],[0,.85,0],steel);
 for(const z of [-1.26,1.26])for(let x=-3.2;x<=3.21;x+=1.08){box([.7,1,.035],[x,2.25,z],glass);box([.035,1,.045],[x,2.25,z],trim);}
 const vehicle=mergeModel(group);vehicle.userData.supports=[-2.4,2.4];vehicle.userData.railLift=.075;
 for(const x of [-2.4,2.4]){
  const bogie=new THREE.Group();bogie.position.x=x;bogie.userData.bogieX=x;bogie.userData.wheelbase=1;vehicle.add(bogie);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1.7,.18,1.8),steel);frame.position.y=.69;bogie.add(frame);
  for(const dx of [-.5,.5]){
   const axle=new THREE.Group();axle.position.set(dx,.61,0);axle.userData.wheelRadius=.46;axle.userData.axleX=x+dx;bogie.add(axle);
   const parts=new THREE.Group();
   for(const z of [-.92,.92]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.46,.46,.16,16),steel);wheel.rotation.x=Math.PI/2;wheel.position.z=z;parts.add(wheel);}
   axle.add(mergeModel(parts));
  }
 }
 return vehicle;
}
const lineDistances=new Map();
const wrap=t=>((t%1)+1)%1;
function distanceTable(line) {
 if(!lineDistances.has(line)){
  const distances=[0];let previous=railPoint(0,line);
  for(let i=1;i<=4096;i++){const p=railPoint(i/4096,line);distances.push(distances.at(-1)+p.distanceTo(previous));previous=p;}
  lineDistances.set(line,distances);
 }
 return lineDistances.get(line);
}
function distanceAt(t,line){const a=distanceTable(line),index=wrap(t)*4096,i=Math.floor(index);return THREE.MathUtils.lerp(a[i],a[i+1],index-i);}
function parameterAt(distance,line){
 const a=distanceTable(line),d=((distance%a.at(-1))+a.at(-1))%a.at(-1);let lo=0,hi=4096;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(a[mid]>d)hi=mid;else lo=mid;}
 return (lo+(d-a[lo])/(a[hi]-a[lo]))/4096;
}
function placeVehicle(object,distance,line,travel) {
 const supports=object.userData.supports||[-2.4,2.4],front=supports[0],rear=supports.at(-1);
 const a=railPoint(parameterAt(distance-front,line),line),b=railPoint(parameterAt(distance-rear,line),line);
 const direction=a.clone().sub(b).normalize();
 object.rotation.set(0,Math.atan2(direction.z,-direction.x),0);
 object.position.copy(a).addScaledVector(direction,front);
 object.position.y+=object.userData.railLift??.075;
 object.updateMatrixWorld(true);
 object.traverse(part=>{
  if(part.userData.bogieX!==undefined){
   const x=part.userData.bogieX,d=distance-x,half=part.userData.wheelbase/2;
   const p=railPoint(parameterAt(d+half,line),line),q=railPoint(parameterAt(d-half,line),line),tangent=p.clone().sub(q).normalize();
   p.add(q).multiplyScalar(.5);p.y+=object.userData.railLift;
   part.position.copy(object.worldToLocal(p));
   const yaw=Math.atan2(tangent.z,-tangent.x)-object.rotation.y;
   part.rotation.y=Math.atan2(Math.sin(yaw),Math.cos(yaw));
  }
  if(part.userData.wheelRadius)part.rotation.z=(travel/part.userData.wheelRadius)%(Math.PI*2);
  const link=part.userData.linkage;
  if(link){
   const angle=travel/link.radius,c=Math.cos(angle),s=Math.sin(angle),x=link.x*c-link.y*s,y=link.x*s+link.y*c;
   if(link.kind==='coupled')part.position.set(x-link.x,y-link.y,0);
   else {
    const end=new THREE.Vector3(link.axleX+x,link.axleY+y,link.z);
    const start=new THREE.Vector3(end.x-Math.sqrt(link.length**2-(end.y-link.sliderY)**2),link.sliderY,link.z);
    part.position.copy(start).add(end).multiplyScalar(.5);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());
   }
  }
 });
 object.updateMatrixWorld(true);
}
export function positionTrain(train,seconds) {
 const travel=seconds*7.5,distance=distanceAt(train.offset,train.line)+travel;
 train.t=parameterAt(distance,train.line);
 placeVehicle(train.loco,distance,train.line,travel);
 train.tenderT=parameterAt(distance-train.gap,train.line);
 placeVehicle(train.tender,distance-train.gap,train.line,travel);
 train.coaches.forEach((coach,i)=>placeVehicle(coach,distance-train.gap-7-i*9.6,train.line,travel));
}
export function makeSteam(scene) {
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');const gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(235,232,217,0.4)');gradient.addColorStop(.4,'rgba(230,232,222,0.25)');gradient.addColorStop(1,'rgba(230,232,222,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 const texture=new THREE.CanvasTexture(canvas);
 const geometry=new THREE.PlaneGeometry(1,1);
 const opacity=new THREE.InstancedBufferAttribute(new Float32Array(96),1);
 geometry.setAttribute('puffOpacity',opacity);
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute float puffOpacity; varying float vPuffOpacity;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   vPuffOpacity=puffOpacity;
   vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
   mvPosition.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
   gl_Position=projectionMatrix*mvPosition;
  `);
  shader.fragmentShader='varying float vPuffOpacity;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.a*=vPuffOpacity;');
 };
 material.customProgramCacheKey=()=> 'valley-steam-batch-v1';
 const mesh=new THREE.InstancedMesh(geometry,material,96);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 scene.add(mesh);const dummy=new THREE.Object3D();
 return {update(seconds,trains){
  for(let i=0;i<96;i++){
   const train=trains[i%trains.length],age=((seconds*1.4+Math.floor(i/trains.length)*.23)%5);
   const past=parameterAt(distanceAt(train.t,train.line)-age*7.5,train.line);
   const p=railPoint(past,train.line),dir=route.getTangentAt(((past%1)+1)%1);p.addScaledVector(dir,2.8);
   dummy.position.copy(p);dummy.position.y+=3.6+age*1.5;dummy.position.x+=age*.55;
   dummy.scale.setScalar(.6+age*1.15);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   opacity.setX(i,(1-age/5)*.68);
  }
  opacity.needsUpdate=true;mesh.instanceMatrix.needsUpdate=true;
 }};
}
