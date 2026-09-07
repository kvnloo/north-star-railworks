import {routeSamples,railPoint} from './geography.js';
const rails=[...routeSamples,...Array.from({length:360},(_,i)=>railPoint(i/360,1))];
export const TOWN_CLEARANCE={minX:-52,maxX:52,minZ:88,maxZ:149};

export function clearRockPosition(x,z,radius){
 for(let pass=0;pass<16;pass++){
  let moved=false;
  const rect=TOWN_CLEARANCE;
  if(x>rect.minX-radius&&x<rect.maxX+radius&&z>rect.minZ-radius&&z<rect.maxZ+radius){
   const options=[{axis:'x',value:rect.minX-radius},{axis:'x',value:rect.maxX+radius},{axis:'z',value:rect.minZ-radius},{axis:'z',value:rect.maxZ+radius}];
   options.sort((a,b)=>Math.abs(a.value-(a.axis==='x'?x:z))-Math.abs(b.value-(b.axis==='x'?x:z)));
   if(options[0].axis==='x')x=options[0].value;else z=options[0].value;
   moved=true;
  }
  let nearest=rails[0],distance=Infinity;
  for(const p of rails){const d=Math.hypot(x-p.x,z-p.z);if(d<distance){distance=d;nearest=p;}}
  if(distance<radius+3){
   const dx=distance>.0001?(x-nearest.x)/distance:1,dz=distance>.0001?(z-nearest.z)/distance:0;
   x=nearest.x+dx*(radius+3.05);z=nearest.z+dz*(radius+3.05);moved=true;
  }
  if(!moved)return {x,z};
 }
 // Large boulders can have no room between the town and the two tracks.
 // Place those on the outer ridge, beyond both protected areas, instead of oscillating.
 const angle=Math.atan2(z,x),distance=260+radius;
 return {x:Math.cos(angle)*distance,z:Math.sin(angle)*distance};
}
