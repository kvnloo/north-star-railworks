import * as THREE from 'three';
import { clearRockPosition } from './placement.js';
import { Tree } from '@dgreenheck/ez-tree';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {terrainHeight,distanceToRail,random,fbm,noise,inTown,inTunnel} from './geography.js';
import {createForest,makeFoliageMaterial,bakeTreeImpostor,waitForTreeTextures} from './forest.js';
const dummy=new THREE.Object3D();
export async function makeEnvironment(scene,renderer) {
 const rng=random(918);
 const forest=createForest(scene);
 const loader=new THREE.TextureLoader();
 const root=`${import.meta.env?.BASE_URL ?? '/'}generated/scene/`;
 const [ground,groundN,rock,rockN]=await Promise.all(['forest-diffuse.jpg','forest-normal.jpg','rock-diffuse.jpg','rock-normal.jpg'].map(name=>loader.loadAsync(root+name)));
 for(const texture of [ground,groundN,rock,rockN]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
 ground.colorSpace=rock.colorSpace=THREE.SRGBColorSpace;
 ground.repeat.set(115,115);groundN.repeat.copy(ground.repeat);rock.repeat.set(3,3);rockN.repeat.copy(rock.repeat);
 const groundMat=new THREE.MeshStandardMaterial({map:ground,normalMap:groundN,normalScale:new THREE.Vector2(.65,.65),roughness:1,vertexColors:true});
 const rockMat=new THREE.MeshStandardMaterial({map:rock,normalMap:rockN,normalScale:new THREE.Vector2(.7,.7),roughness:.95,color:0x959f8b});
 const terrain=new THREE.PlaneGeometry(1000,1000,240,240);terrain.rotateX(-Math.PI/2);
 const pos=terrain.attributes.position,colors=[];const color=new THREE.Color();
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i),h=terrainHeight(x,z);pos.setY(i,h);
  const n=fbm(x*.033,z*.033);color.setHSL(.22+n*.05,.16+n*.15,.32+n*.25);
  if(h>90) color.lerp(new THREE.Color(0xa7b1ae),Math.min(.65,(h-90)/150));
  colors.push(color.r,color.g,color.b);
 }
 terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
 const land=new THREE.Mesh(terrain,groundMat);land.receiveShadow=true;scene.add(land);
 // Cliff ridges are separate from the floor so steep stone does not inherit leaf litter.
 const rockGeo=new THREE.IcosahedronGeometry(1,2);const rp=rockGeo.attributes.position;
 for(let i=0;i<rp.count;i++){const f=.84+noise(rp.getX(i)*4+rp.getZ(i)*3,rp.getY(i)*5)*.3;rp.setXYZ(i,rp.getX(i)*f,rp.getY(i)*f,rp.getZ(i)*f);}rockGeo.computeVertexNormals();
 rockGeo.computeBoundingSphere();
 const rockRadius=rockGeo.boundingSphere.radius+rockGeo.boundingSphere.center.length();
 const rocks=new THREE.InstancedMesh(rockGeo,rockMat,520);let count=0;
 for(let i=0;i<1500 && count<520;i++){
  const x=(rng()-.5)*670,z=(rng()-.5)*550,h=terrainHeight(x,z),d=distanceToRail(x,z);
  if(h<0||d<7||inTown(x,z)||inTunnel(x,z))continue;
  const far=Math.abs(x)>150||Math.abs(z)>140,s=far?7+rng()*23:1+rng()*4;
  dummy.scale.set(s*(.8+rng()),s*(.65+rng()*1.6),s);dummy.rotation.set(rng(),rng()*6.28,rng()*.3);
  const radius=rockRadius*Math.max(dummy.scale.x,dummy.scale.y,dummy.scale.z)+.2;
  const safe=clearRockPosition(x,z,radius);
  dummy.position.set(safe.x,terrainHeight(safe.x,safe.z)-s*.15,safe.z);
  dummy.updateMatrix();rocks.setMatrixAt(count++,dummy.matrix);
 }
 rocks.count=count;rocks.castShadow=true;rocks.receiveShadow=true;scene.add(rocks);
 const presets=['Pine Medium','Pine Large','Pine Small','Aspen Medium','Oak Small','Bush 2'];
 const trees=[];let treeCount=0;
 for(let species=0;species<presets.length;species++){
  const tree=new Tree();tree.loadPreset(presets[species]);tree.options.seed=713+species*371;
  if(species<3){tree.options.branch.children[0]=species===2?38:58;tree.options.branch.sections[1]=5;tree.options.branch.segments[1]=4;tree.options.leaves.count=24;tree.options.leaves.size*=1.2;}
  else {tree.options.branch.children[0]=5;tree.options.branch.children[1]=3;tree.options.branch.children[2]=2;tree.options.leaves.count=5;}
  tree.generate();
  const originalLeaves=tree.leavesMesh.material;
  const foliage=makeFoliageMaterial(originalLeaves.map);
  tree.leavesMesh.material=foliage;originalLeaves.dispose();trees.push(tree);
  const placements=[];const wanted=species<3?340:species===5?240:75;
  for(let attempt=0;attempt<wanted*8 && placements.length<wanted;attempt++){
   const x=(rng()-.5)*510,z=(rng()-.5)*410,h=terrainHeight(x,z),d=distanceToRail(x,z);
   if(h<.9 || h>115 || d<12 || inTown(x,z)||inTunnel(x,z)) continue;
   if(fbm(x*.02+30,z*.02)<.32 && rng()<.7)continue;
   const base=species<3?.34:species===5?.17:.3;
   const scale=base*(.65+rng()*.8);
   placements.push({x,z,h,scale,angle:rng()*Math.PI*2});
  }
  // Preserve both original colour RNG passes so all later placements stay identical.
  for(const field of ['branchColor','color']) for(const p of placements) p[field]=new THREE.Color().setHSL(.22+rng()*.06,.1+rng()*.15,.65+rng()*.24).getHex();
  await waitForTreeTextures(tree);
  forest.addSpecies(tree,placements,bakeTreeImpostor(tree,renderer));
  treeCount+=placements.length;
 }
 // Ferns use bent pinnate fronds, scattered around the track verge and forest floor.
 const fronds=[];
 for(let f=0;f<7;f++)for(let l=1;l<9;l++)for(const side of [-1,1]){
  const leaf=new THREE.PlaneGeometry(.34*(1-l/11),.11,1,1);leaf.rotateX(-Math.PI/2);leaf.rotateY(side*.55);leaf.translate(side*l*.035,Math.sin(l/9*Math.PI)*.38,l*.12);leaf.rotateY(f/7*Math.PI*2);fronds.push(leaf);
 }
 const fernGeo=mergeGeometries(fronds),fernMat=new THREE.MeshStandardMaterial({color:0x548133,roughness:.95,side:THREE.DoubleSide});
 const ferns=new THREE.InstancedMesh(fernGeo,fernMat,1700);let fi=0;
 for(let i=0;i<13000&&fi<1700;i++) {const x=(rng()-.5)*350,z=(rng()-.5)*280,h=terrainHeight(x,z),d=distanceToRail(x,z);if(h<.9||d<5||inTown(x,z)||inTunnel(x,z))continue;dummy.position.set(x,h+.06,z);dummy.scale.setScalar(.7+rng()*1.6);dummy.rotation.set(0,rng()*6.28,0);dummy.updateMatrix();ferns.setMatrixAt(fi++,dummy.matrix);}
 ferns.count=fi;ferns.receiveShadow=true;scene.add(ferns);
 return {rockMat,trees,treeCount,rockCount:count,fernCount:fi,forest,update:(camera,seconds)=>forest.update(camera,seconds)};
}
export function makeLake(scene) {
 const geometry=new THREE.PlaneGeometry(205,142,100,80);geometry.rotateX(-Math.PI/2);
 const material=new THREE.MeshPhysicalMaterial({color:0x236963,metalness:.35,roughness:.2,transparent:true,opacity:.92,clearcoat:1,clearcoatRoughness:.18});
 const lake=new THREE.Mesh(geometry,material);lake.position.y=.8;
 material.onBeforeCompile=shader=>{shader.uniforms.uTime={value:0};material.userData.shader=shader;shader.vertexShader='uniform float uTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.y += sin(position.x*.22+uTime*.65)*.045+sin(position.z*.35+uTime*.8)*.035;');};
 scene.add(lake);return lake;
}
