import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeTunnel,makeRailway,TUNNEL_CLEARANCE_RADIUS} from '../web/valley/railway.js';
import {railPoint,route,routeLength} from '../web/valley/geography.js';

const scene=new THREE.Scene();
const material=new THREE.MeshStandardMaterial();
const tunnel=makeTunnel(scene,material);
scene.updateMatrixWorld(true);
const localBounds=new THREE.Box3();
let triangles=0,minRadius=Infinity,maxRadius=0;
const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
const instance=new THREE.Matrix4(),matrix=new THREE.Matrix4();
const inverse=tunnel.matrixWorld.clone().invert();
function edgeDistance(a,b){
 const dy=b.y-a.y,dz=b.z-a.z;
 const t=THREE.MathUtils.clamp(-(a.y*dy+a.z*dz)/(dy*dy+dz*dz||1),0,1);
 return Math.hypot(a.y+t*dy,a.z+t*dz);
}
function radialDistance(a,b,c){
 const cross=(a,b)=>a.y*b.z-a.z*b.y;
 const signs=[cross(a,b),cross(b,c),cross(c,a)];
 const area=(b.y-a.y)*(c.z-a.z)-(b.z-a.z)*(c.y-a.y);
 if(Math.abs(area)>1e-9&&(signs.every(s=>s>=0)||signs.every(s=>s<=0)))return 0;
 return Math.min(edgeDistance(a,b),edgeDistance(b,c),edgeDistance(c,a));
}
tunnel.traverse(object=>{
 if(!object.isMesh)return;
 const geometry=object.geometry,position=geometry.attributes.position,index=geometry.index;
 for(let n=0;n<(object.isInstancedMesh?object.count:1);n++){
  matrix.multiplyMatrices(inverse,object.matrixWorld);
  if(object.isInstancedMesh){object.getMatrixAt(n,instance);matrix.multiply(instance);}
  for(let i=0;i<(index?index.count:position.count);i+=3){
   for(const [offset,v] of [[0,a],[1,b],[2,c]]){
    v.fromBufferAttribute(position,index?index.getX(i+offset):i+offset).applyMatrix4(matrix);
    assert(v.toArray().every(Number.isFinite),'Non-finite tunnel vertex');
    localBounds.expandByPoint(v);maxRadius=Math.max(maxRadius,Math.hypot(v.y,v.z));
   }
   const radius=radialDistance(a,b,c);minRadius=Math.min(minRadius,radius);
   // Includes the lamps projecting slightly inside the widened 7.2-unit bore.
   assert(radius>=TUNNEL_CLEARANCE_RADIUS*Math.cos(Math.PI/80)-1e-5,`${object.name} intrudes into original bore: ${radius}`);
   triangles++;
  }
 }
});
assert(maxRadius<29,'Exterior exceeds camera collision radius');
assert(localBounds.min.x>-34&&localBounds.max.x<34,'Exterior exceeds camera collision x bounds');
assert(localBounds.min.z>-29&&localBounds.max.z<29,'Exterior exceeds camera collision z bounds');
const ridge=tunnel.getObjectByName('tunnel-rock-ridge');
assert(ridge&&ridge.geometry.attributes.color,'Rock ridge and variation missing');
const raycaster=new THREE.Raycaster();
let routeChecks=0,minRailHeadroom=Infinity;
for(const line of [0,1])for(let i=0;i<4800;i++){
 const center=railPoint(i/4800,line),tangent=route.getTangentAt(i/4800);
 if(Math.abs(center.x)>31.1||center.z>-60)continue;
 // Cast from actual steel rail positions into rendered tunnel triangles.
 // This checks rail headroom, not articulated GLB vehicle clearance.
 for(const side of [-.92,.92]){
  const rail=center.clone().addScaledVector(new THREE.Vector3(-tangent.z,0,tangent.x),side);
  rail.y+=.16;
  raycaster.set(rail,new THREE.Vector3(0,1,0));
  const hits=raycaster.intersectObject(tunnel,true);
  const expectedHeadroom=Math.sqrt((TUNNEL_CLEARANCE_RADIUS*Math.cos(Math.PI/80))**2-(rail.z+84)**2)-(rail.y-3.6);
  assert(hits.length&&hits[0].distance>=expectedHeadroom-1e-5,`Rail headroom reduced at line ${line}, x=${center.x}, hit=${hits[0]?.distance}`);
  minRailHeadroom=Math.min(minRailHeadroom,hits[0].distance);
  const radius=Math.hypot(rail.y-3.6,rail.z+84);
  assert(radius<minRadius,`Rail sample outside bore: ${radius}`);
  routeChecks++;
 }
}
assert(routeChecks>100,'Too few route samples');
const railwayScene=new THREE.Scene();
const result=makeRailway(railwayScene,{wood:material,ballast:material});
assert.equal(result.lines,2);assert.equal(result.ties,Math.ceil(routeLength/.65)*2);
assert.equal(railwayScene.children.filter(o=>o.geometry.type==='TubeGeometry').length,4);
console.log(JSON.stringify({result:'passed',triangles,routeChecks,minRailHeadroom,minRadius,maxRadius,localBounds:{min:localBounds.min.toArray(),max:localBounds.max.toArray()},lines:result.lines,ties:result.ties},null,2));
