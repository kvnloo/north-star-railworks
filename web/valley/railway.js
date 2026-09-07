import * as THREE from 'three';
import {railPoint,routeLength,route,noise} from './geography.js';
const dummy=new THREE.Object3D();
export function makeRailway(scene,materials) {
 const ties=new THREE.InstancedMesh(new THREE.BoxGeometry(.23,.18,2.7),materials.wood,Math.ceil(routeLength/.65)*2);
 const beds=new THREE.InstancedMesh(new THREE.BoxGeometry(1.15,.23,3.35),materials.ballast,Math.ceil(routeLength)*2);
 const steel=new THREE.MeshStandardMaterial({color:0x8c9695,metalness:.88,roughness:.29});
 let ti=0,bi=0;
 for(let line=0;line<2;line++) {
  const n=Math.ceil(routeLength/.65);
  for(let i=0;i<n;i++) {const t=i/n,p=railPoint(t,line),dir=route.getTangentAt(t);dummy.position.copy(p);dummy.rotation.set(0,Math.atan2(-dir.z,dir.x),0);dummy.updateMatrix();ties.setMatrixAt(ti++,dummy.matrix);}
  const count=Math.ceil(routeLength);
  for(let i=0;i<count;i++){const t=i/count,p=railPoint(t,line),dir=route.getTangentAt(t);dummy.position.copy(p);dummy.position.y-=.21;dummy.rotation.set(0,Math.atan2(-dir.z,dir.x),0);dummy.updateMatrix();beds.setMatrixAt(bi++,dummy.matrix);}
  for(const side of [-.92,.92]) {
   const points=[];for(let i=0;i<=900;i++){const t=i/900,p=railPoint(t,line),dir=route.getTangentAt(t);p.add(new THREE.Vector3(-dir.z,0,dir.x).multiplyScalar(side));p.y+=.16;points.push(p);}
   const curve=new THREE.CatmullRomCurve3(points);
   const rail=new THREE.Mesh(new THREE.TubeGeometry(curve,1200,.065,5,false),steel);rail.castShadow=true;scene.add(rail);
  }
 }
 ties.receiveShadow=true;ties.castShadow=true;beds.receiveShadow=true;scene.add(ties,beds);
 return {ties:ti,lines:2};
}
export const TUNNEL_BORE_RADIUS=7.2;
export const TUNNEL_CLEARANCE_RADIUS=7.0;
export function makeTunnel(scene,rockMaterial) {
 const group=new THREE.Group(); group.position.set(0,3.6,-84);
 const mesh=(geometry,material=rockMaterial)=>{const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 const arch=(inner,outer,length,segments,start=0,sweep=Math.PI)=>{
  const positions=[],uv=[],indices=[];
  for(let end=0;end<2;end++)for(let ring=0;ring<2;ring++)for(let i=0;i<=segments;i++){
   const theta=start+i/segments*sweep;const radius=ring?outer:inner;
   positions.push((end-.5)*length,Math.sin(theta)*radius,Math.cos(theta)*radius);uv.push(i/segments*5,end*4+ring);
  }
  const stride=segments+1;
  const quad=(a,b,c,d)=>indices.push(a,b,d,b,c,d);
  for(let i=0;i<segments;i++){
   quad(i,i+1,stride+i+1,stride+i);
   quad(2*stride+i,3*stride+i,3*stride+i+1,2*stride+i+1);
   quad(i,2*stride+i,2*stride+i+1,i+1);
   quad(stride+i,stride+i+1,3*stride+i+1,3*stride+i);
  }
  quad(0,stride,3*stride,2*stride);
  quad(segments,2*stride+segments,3*stride+segments,stride+segments);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
 };
 const innerMat=rockMaterial.clone();innerMat.side=THREE.DoubleSide;innerMat.color.set(0x74786a);
 mesh(arch(TUNNEL_BORE_RADIUS,7.6,58,40),innerMat).name='tunnel-lining';
 // Longitudinal variation and recessed, sloping shoulders replace the extrusion.
 // End rings meet the unchanged bore, not a flat circular cliff face.
 const positions=[],indices=[],slices=28,segments=40,stride=segments+1;
 for(let j=0;j<=slices+2;j++)for(let i=0;i<=segments;i++){
  const theta=i/segments*Math.PI;
  const end=j===0||j===slices+2;
  const s=THREE.MathUtils.clamp((j-1)/slices*2-1,-1,1);
  const n=noise(s*3.8+17,theta*2.9+8);
  const shoulder=Math.pow(Math.max(0,1-s*s),.65);
  const radius=end?7.6:Math.min(27.8,10.5+shoulder*(10.5+3.5*Math.sin(theta+.6))+(n-.5)*4.2);
  const x=end?s*29:s*(28.4-Math.sin(theta)*(2.3+n*3.2));
  positions.push(x,Math.sin(theta)*radius,Math.cos(theta)*radius);
 }
 for(let j=0;j<slices+2;j++)for(let i=0;i<segments;i++){
  const a=j*stride+i,b=a+stride;indices.push(a,b,a+1,b,b+1,a+1);
 }
 const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));indexed.setIndex(indices);
 const ridge=indexed.toNonIndexed();indexed.dispose();ridge.computeVertexNormals();
 // Dominant-face planar mapping keeps texel density on the roof and cut slopes.
 const p=ridge.getAttribute('position'),normals=ridge.getAttribute('normal'),uv=[],colors=[];
 for(let i=0;i<p.count;i+=3){
  const nx=Math.abs(normals.getX(i)),ny=Math.abs(normals.getY(i)),nz=Math.abs(normals.getZ(i));
  for(let k=0;k<3;k++){
   const v=i+k,x=p.getX(v),y=p.getY(v),z=p.getZ(v);
   uv.push((nx>ny&&nx>nz?z:x)/9,(ny>=nx&&ny>=nz?z:y)/9);
   const shade=.79+noise(x*.21+91,z*.24+y*.15)*.19+Math.sin(y*1.8+x*.16)*.025;
   colors.push(shade,shade*.99,shade*.91);
  }
 }
 ridge.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));ridge.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const ridgeMat=rockMaterial.clone();ridgeMat.vertexColors=true;ridgeMat.side=THREE.DoubleSide;
 mesh(ridge,ridgeMat).name='tunnel-rock-ridge';
 const stone=new THREE.MeshStandardMaterial({color:0x727d75,map:rockMaterial.map,normalMap:rockMaterial.normalMap,roughness:.93});
 const masonry=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),stone,160);
 masonry.name='tunnel-retaining-courses';masonry.castShadow=true;masonry.receiveShadow=true;
 let blocks=0;
 for(const x of [-30,30]) {
  for(let i=0;i<23;i++) {
   const m=mesh(arch(TUNNEL_BORE_RADIUS,8.75,2.4,3,i/23*Math.PI+.003,Math.PI/23-.006),stone);
   m.position.x=x;m.name='tunnel-portal-voussoir';
  }
  for(const side of [-1,1])for(let column=0;column<5;column++){
   const rows=7-column;
   for(let row=0;row<rows;row++){
    dummy.position.set(x-.12*Math.sign(x)*column,row*1.02+.5,side*(9.3+column*1.9));
    dummy.rotation.set(0,0,0);dummy.scale.set(2.8,.97,1.84);dummy.updateMatrix();masonry.setMatrixAt(blocks++,dummy.matrix);
    masonry.setColorAt(blocks-1,new THREE.Color().setScalar(.85+noise(column+row*3,x)*.25));
   }
   dummy.position.set(x-.12*Math.sign(x)*column,rows*1.02+.14,side*(9.3+column*1.9));
   dummy.scale.set(3.05,.28,1.95);dummy.updateMatrix();masonry.setMatrixAt(blocks++,dummy.matrix);
   masonry.setColorAt(blocks-1,new THREE.Color(.91,.92,.86));
  }
  const plaque=mesh(new THREE.BoxGeometry(.12,.8,2.8),new THREE.MeshStandardMaterial({color:0xb3aa8b}));plaque.position.set(x+(x<0?-1.24:1.24),8.15,0);
 }
 masonry.count=blocks;group.add(masonry);dummy.scale.set(1,1,1);
 for(const x of [-22,-8,8,22]){const light=new THREE.PointLight(0xffad52,10,13,2);light.position.set(x,4.5,-Math.sqrt(TUNNEL_BORE_RADIUS**2-4.5**2));group.add(light);const lamp=mesh(new THREE.SphereGeometry(.16,6,5),new THREE.MeshBasicMaterial({color:0xffc078}));lamp.position.copy(light.position);}
 scene.add(group);return group;
}
