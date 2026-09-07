import * as THREE from 'three';
import {railPoint,route,terrainHeight} from './geography.js';

export const CAMERA_MODES=['cinematic','fpv','trackside','aerial','tunnel','town','orbit'];
const sequence=['chase','fpv','ridge','trackside','aerial'];
export const SHOT_NAMES={
 chase:['01 / 05','The forest approach','Low pursuit along the railway'],
 fpv:['02 / 05','Through the pines','A banking drone along the forest corridor'],
 ridge:['03 / 05','Across the highlands','A wide view of the northern valley'],
 trackside:['04 / 05','Steel & steam','A moving view beside the locomotive'],
 aerial:['05 / 05','The valley below','Railway, lake, and forest from above'],
 town:['STATION STUDY','Ravenfell Junction','Four services. Two mountain stations.'],
 tunnel:['TUNNEL STUDY','Through the ridge','Watch the services pass through the west portal'],
 orbit:['FREE CAMERA','Explore the valley','Drag to orbit. Scroll to move closer.'],
};

export function cameraFloor(x,z){
 let floor=terrainHeight(x,z)+3.5;
 // The rock arch is separate from the heightfield. Keep cameras above its shell.
 if(Math.abs(x)<34 && Math.abs(z+84)<29){
  const radius=29;
  floor=Math.max(floor,3.6+Math.sqrt(Math.max(0,radius*radius-(z+84)**2))+4);
 }
 return floor;
}

export function cameraShot({mode,seconds,t,line=0,aspect=16/9,reduced=false}){
 if(!CAMERA_MODES.includes(mode))throw new Error(`Unknown camera: ${mode}`);
 const shot=mode==='cinematic'?sequence[Math.floor(seconds/12)%sequence.length]:mode;
 const p=railPoint(t,line),dir=route.getTangentAt(((t%1)+1)%1);
 const side=new THREE.Vector3(-dir.z,0,dir.x);
 let eye=p.clone(),target=p.clone().add(new THREE.Vector3(0,2,0)),bank=0,fov=48;
 if(shot==='chase'){eye.addScaledVector(dir,-24).addScaledVector(side,line===0?3:-3);eye.y+=14;target.addScaledVector(dir,-6);target.y-=1;}
 if(shot==='fpv'){
  const phase=reduced?0:seconds*.12;
  eye=railPoint(t-.036,line);eye.addScaledVector(side,(line===0?3:-3)+Math.sin(phase)*1.2);eye.y+=18+Math.sin(phase*.7)*3;
  target=railPoint(t-.009,line);target.y+=1.5;bank=reduced?0:Math.sin(phase)*.055;fov=58;
 }
 if(shot==='ridge'){eye.addScaledVector(side,-38).addScaledVector(dir,-18);eye.y+=30;target.addScaledVector(dir,3);fov=45;}
 if(shot==='trackside'){eye.addScaledVector(side,line===0?2.7:-2.7).addScaledVector(dir,8);eye.y+=4.5;target.addScaledVector(dir,1);fov=58;}
 if(shot==='aerial'){const angle=reduced?.55:seconds*.018+.55;eye.set(Math.sin(angle)*245,165,Math.cos(angle)*245);target.set(0,10,-5);fov=50;}
 if(shot==='town'){eye.set(reduced?0:Math.sin(seconds*.035)*7,55,142);target.set(0,5,105);fov=60;}
 if(shot==='tunnel'){eye.set(-65,11,-85);target.set(-24,6,-84);fov=55;}
 if(shot==='orbit'){eye.set(25,105,175);target.set(0,8,0);fov=48;}
 // Preserve horizontal subject coverage in portrait without an extreme lens.
 if(aspect<1.35){
  const scale=Math.min(1.9,1.35/aspect);
  if(['town','trackside','fpv','chase'].includes(shot))eye.y=target.y+(eye.y-target.y)*scale;
  else eye.sub(target).multiplyScalar(scale).add(target);
  fov=Math.min(66,fov+5);
 }
 eye.y=Math.max(eye.y,cameraFloor(eye.x,eye.z));
 return {shot,eye,target,bank,fov};
}

export function blendCamera(camera,desired,dt,{immediate=false,reduced=false}={}){
 const blend=immediate||reduced?1:1-Math.exp(-Math.max(0,dt)*3.5);
 camera.position.lerp(desired.eye,blend);
 // Interpolating two valid endpoints can still cut through a ridge.
 camera.position.y=Math.max(camera.position.y,cameraFloor(camera.position.x,camera.position.z));
 camera.fov=THREE.MathUtils.lerp(camera.fov,desired.fov,blend);
 const look=new THREE.Matrix4().lookAt(camera.position,desired.target,new THREE.Vector3(Math.sin(desired.bank),Math.cos(desired.bank),0));
 const orientation=new THREE.Quaternion().setFromRotationMatrix(look);
 camera.quaternion.slerp(orientation,blend);
 camera.updateProjectionMatrix();
 return camera.position.distanceTo(desired.eye)<.03 && camera.quaternion.angleTo(orientation)<.001;
}
