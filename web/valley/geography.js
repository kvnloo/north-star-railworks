import * as THREE from 'three';
export function random(seed=7307) { return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }; }
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
export function noise(x,y) {
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),u),THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);
}
export function fbm(x,z) {let sum=0,amp=.5;for(let i=0;i<5;i++){sum+=noise(x,z)*amp;x=x*2.03+13;z=z*2.03+7;amp*=.5;}return sum;}
export const route = new THREE.CatmullRomCurve3([
 [-115,4,0],[-105,4,-54],[-64,4,-84],[-28,4,-87],[28,4,-87],[77,4,-73],[111,4,-29],[110,4,35],[67,4,75],[12,4,86],[-49,4,78],[-96,4,51],
].map(p=>new THREE.Vector3(...p)),true,'centripetal');
export const routeLength=route.getLength();
export function railPoint(t,line=0) {const u=((t%1)+1)%1,p=route.getPointAt(u),tangent=route.getTangentAt(u);return p.add(new THREE.Vector3(-tangent.z,0,tangent.x).multiplyScalar(line*6));}
export const routeSamples=Array.from({length:360},(_,i)=>railPoint(i/360));
export function distanceToRail(x,z) {let distance=Infinity;for(const p of routeSamples){const d=(p.x-x)**2+(p.z-z)**2;if(d<distance)distance=d;}return Math.sqrt(distance);}
export function terrainHeight(x,z) {
 const radial=Math.sqrt((x/119)**2+(z/92)**2);
 const n=fbm(x*.015,z*.015);
 let height=3+n*12;
 if(radial<.78) height-=18*(1-THREE.MathUtils.smoothstep(radial,.38,.78));
 if(radial>1.2) height+=Math.pow(Math.min(radial-1.2,2.5),1.35)*39*(.3+fbm(x*.007+41,z*.007)*1.8);
 height+=Math.max(0,radial-1.1)*noise(x*.07,z*.07)*8;
 const d=distanceToRail(x,z);
 height=THREE.MathUtils.lerp(3.55,height,THREE.MathUtils.smoothstep(d,9,20));
 const town=Math.sqrt((x/42)**2+((z-112)/28)**2);
 height=THREE.MathUtils.lerp(3.6,height,THREE.MathUtils.smoothstep(town,1,1.5));
 if(Math.abs(x)<40 && z>-111 && z<-68) height=Math.min(height,3.55);
 return height;
}
export function inTown(x,z) {return Math.abs(x)<49 && z>91 && z<145;}
export function inTunnel(x,z) {return Math.abs(x)<39 && z>-115 && z<-60;}
