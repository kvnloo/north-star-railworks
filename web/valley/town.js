import * as THREE from 'three';
import {railPoint,route,random} from './geography.js';
const rng=random(58);
export function makeTown(scene,rockMat) {
 const materials={plaster:new THREE.MeshStandardMaterial({color:0xb2ada0,roughness:.98}),wood:new THREE.MeshStandardMaterial({color:0x574331,roughness:.96}),roof:new THREE.MeshStandardMaterial({color:0x343b3a,roughness:.85}),red:new THREE.MeshStandardMaterial({color:0x683b2f,roughness:.95}),glass:new THREE.MeshStandardMaterial({color:0xdbb577,emissive:0xa57434,emissiveIntensity:.28,roughness:.25,metalness:.2})};
 const box=(parent,size,position,material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const roof=(parent,width,depth,height,y)=>{
  const shape=new THREE.Shape();shape.moveTo(-depth/2,0);shape.lineTo(0,height);shape.lineTo(depth/2,0);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false});g.rotateY(Math.PI/2);g.translate(-width/2,y,0);
  const m=new THREE.Mesh(g,materials.roof);m.castShadow=true;parent.add(m);
 };
 const sign=(parent,label,x,y,z,width=7)=>{
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#283b33';c.fillRect(0,0,768,128);c.strokeStyle='#ccb583';c.lineWidth=4;c.strokeRect(8,8,752,112);c.fillStyle='#f3e5bf';c.font='42px Georgia';c.textAlign='center';c.fillText(label,384,80);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/6),new THREE.MeshStandardMaterial({map:tex,roughness:.8}));mesh.position.set(x,y,z);parent.add(mesh);
 };
 function building(parent,width,depth,height,red=false) {
  box(parent,[width,.7,depth],[0,.3,0],rockMat);
  box(parent,[width,height,depth],[0,height/2+.6,0],red?materials.red:materials.plaster);
  roof(parent,width+1,depth+1,depth*.45,height+.6);
  for(const x of [-width/2+.15,width/2-.15])box(parent,[.22,height,.22],[x,height/2+.6,depth/2+.05],materials.wood);
  for(const z of [-depth/2-.06,depth/2+.06]){
   for(let x=-width/2+1;x<width/2-.5;x+=2){box(parent,[.9,1.2,.12],[x,height*.6,z],materials.wood);box(parent,[.65,.9,.14],[x,height*.6,z+Math.sign(z)*.02],materials.glass);}
   box(parent,[width,.18,.2],[0,height+.35,z],materials.wood);
  }
  box(parent,[1.1,2,.12],[0,1.6,depth/2+.08],materials.wood);
  box(parent,[.7,2.2,.8],[width*.3,height+1.3,0],rockMat);
 }
 const town=new THREE.Group();town.position.set(0,3.6,112);scene.add(town);
 box(town,[82,.08,5],[0,.06,0],new THREE.MeshStandardMaterial({color:0x817d6b,roughness:1}));
 let houseCount=0;
 for(const z of [-8,10])for(const x of [-29,-17,-4,11,26]) {const house=new THREE.Group();house.position.set(x,0,z);house.rotation.y=z<0?Math.PI:0;building(house,6+rng()*2,5+rng(),3+rng()*2,houseCount%3===0);town.add(house);houseCount++;}
 const church=new THREE.Group();church.position.set(38,0,18);church.rotation.y=.2;building(church,7,13,6);box(church,[3,11,3],[0,5.5,6],materials.wood);const spire=new THREE.Mesh(new THREE.ConeGeometry(2.5,6,4),materials.roof);spire.position.set(0,14,6);church.add(spire);town.add(church);
 function station(label,p,angle,large) {
  const station=new THREE.Group();station.position.copy(p);station.rotation.y=angle;scene.add(station);
  const length=large?54:28;
  box(station,[length,.65,5],[0,.05,0],rockMat);
  box(station,[length,.1,.3],[0,.44,-2.35],new THREE.MeshStandardMaterial({color:0xdacb9e,roughness:.9}));
  const b=new THREE.Group();b.position.set(0,.4,5);building(b,large?16:9,6,large?5:3.8,true);station.add(b);sign(b,label,0,3.8,3.08,large?11:7);
  box(station,[length*.65,.18,6],[0,4.5,.2],materials.roof);
  for(let x=-length*.28;x<=length*.3;x+=5.5){box(station,[.16,4,.16],[x,2.4,-1.8],materials.wood);box(station,[.16,4,.16],[x,2.4,2.2],materials.wood);}
  for(const x of [-length*.38,length*.38]){box(station,[.16,5,.16],[x,2.8,1.5],materials.wood);box(station,[.7,.5,.7],[x,5.2,1.5],materials.glass);const lamp=new THREE.PointLight(0xffbe70,5,12);lamp.position.set(x,5,1.5);station.add(lamp);}
  for(const x of [-12,12]) {box(station,[2,.15,.65],[x,1.1,.5],materials.wood);for(const side of [-.8,.8])box(station,[.12,.6,.5],[x+side,.8,.5],materials.wood);}
  return station;
 }
 station('RAVENFELL JUNCTION',new THREE.Vector3(5,4,92),0,true);
 const p=railPoint(.10),t=route.getTangentAt(.10);p.add(new THREE.Vector3(t.z,0,-t.x).multiplyScalar(7));
 station('PINEWATCH',p,Math.atan2(-t.z,t.x),false);
 // Water tower, freight shed, and stacked timber give the junction a working yard.
 const tower=new THREE.Group();tower.position.set(-38,3.6,95);scene.add(tower);
 for(const x of [-1.5,1.5])for(const z of [-1.5,1.5])box(tower,[.35,7,.35],[x,3.5,z],materials.wood);
 const tank=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,3,16),materials.wood);tank.position.y=8;tower.add(tank);
 const cap=new THREE.Mesh(new THREE.ConeGeometry(2.9,1.1,16),materials.roof);cap.position.y=10;tower.add(cap);
 for(let i=0;i<20;i++){const log=new THREE.Mesh(new THREE.CylinderGeometry(.22,.25,5,7),materials.wood);log.rotation.z=Math.PI/2;log.position.set(-30,4+(i%4)*.42,101+Math.floor(i/4)*.44);log.castShadow=true;scene.add(log);}
 return {stations:2,buildings:houseCount+3};
}
