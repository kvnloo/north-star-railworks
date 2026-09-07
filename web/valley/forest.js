import * as THREE from 'three';

export const FOREST_CHUNK_SIZE = 64;
export const FOREST_LOD_DISTANCE = 145;
export const FOREST_LOD_HYSTERESIS = 18;
export const IMPOSTOR_VIEWS = 8;

export async function waitForTreeTextures(tree) {
 const textures=new Set();
 for(const mesh of [tree.branchesMesh,tree.leavesMesh]) for(const value of Object.values(mesh.material)) if(value?.isTexture) textures.add(value);
 const deadline=Date.now()+20000;
 while([...textures].some(texture=>!texture.image || !texture.image.width || texture.image.complete===false)){
  if(Date.now()>deadline) throw new Error('Forest texture loading timed out; refusing to bake blank tree atlases.');
  await new Promise(resolve=>setTimeout(resolve,30));
 }
}

export function partitionPlacements(placements) {
 const chunks=new Map();
 for(const p of placements){
  const key=`${Math.floor(p.x/FOREST_CHUNK_SIZE)},${Math.floor(p.z/FOREST_CHUNK_SIZE)}`;
  if(!chunks.has(key)) chunks.set(key,[]);
  chunks.get(key).push(p);
 }
 return chunks;
}

export function makeFoliageMaterial(map) {
 const material=new THREE.MeshStandardMaterial({map,color:0x8fa46b,side:THREE.DoubleSide,alphaTest:.35,roughness:.95});
 const time={value:0};material.userData.time=time;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uTime=time;
  shader.vertexShader='uniform float uTime;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += sin(uTime + position.y*.3) * .14 * uv.y;');
 };
 material.customProgramCacheKey=()=> 'valley-foliage-wind-v1';
 return material;
}

// Atlas views bake the actual MIT-licensed EZ Tree geometry and foliage maps, not cones.
// Keep the source credits in docs/valley.md and scene-assets unchanged.
export function bakeTreeImpostor(tree,renderer) {
 const bounds=new THREE.Box3().setFromObject(tree);
 const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 const width=size.length()*1.04,height=width;
 const target=new THREE.WebGLRenderTarget(1024,512,{depthBuffer:true});
 target.texture.colorSpace=THREE.LinearSRGBColorSpace;
 target.texture.generateMipmaps=true;target.texture.minFilter=THREE.LinearMipmapLinearFilter;
 const stage=new THREE.Scene();
 stage.add(new THREE.HemisphereLight(0xd9edf7,0x424c26,2));
 const sun=new THREE.DirectionalLight(0xffe4b5,2.5);sun.position.set(-30,65,20);stage.add(sun);
 const model=new THREE.Group();
 for(const source of [tree.branchesMesh,tree.leavesMesh]) model.add(new THREE.Mesh(source.geometry,source.material));
 stage.add(model);
 const camera=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,height*6+width*6);
 const previous={target:renderer.getRenderTarget(),color:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,toneMapping:renderer.toneMapping};
 try {
  renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.autoClear=false;renderer.toneMapping=THREE.NoToneMapping;
  renderer.clear();target.scissorTest=true;
  for(let view=0;view<IMPOSTOR_VIEWS;view++){
   const angle=(view%4)/4*Math.PI*2,elevation=view<4?0:Math.PI/3;
   camera.position.set(center.x+Math.sin(angle)*Math.cos(elevation)*(height+width)*2,center.y+Math.sin(elevation)*(height+width)*2,center.z+Math.cos(angle)*Math.cos(elevation)*(height+width)*2);camera.lookAt(center);
   target.viewport.set(view%4*256,Math.floor(view/4)*256,256,256);target.scissor.copy(target.viewport);renderer.setRenderTarget(target);
   renderer.render(stage,camera);
  }
 } finally {
  renderer.setRenderTarget(previous.target);renderer.setClearColor(previous.color,previous.alpha);renderer.autoClear=previous.autoClear;renderer.toneMapping=previous.toneMapping;
 }
 const geometry=new THREE.PlaneGeometry(width,height);geometry.translate(center.x,center.y,center.z);
 const material=new THREE.MeshBasicMaterial({map:target.texture,alphaTest:.35,side:THREE.DoubleSide,toneMapped:false});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying float vTreeView;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   vec4 origin = modelMatrix * instanceMatrix * vec4(${center.x.toFixed(8)},${center.y.toFixed(8)},${center.z.toFixed(8)},1.);
   float scale = length(instanceMatrix[0].xyz);

   vec3 toCamera = cameraPosition - origin.xyz;
   float cameraAngle = atan(toCamera.x, toCamera.z);
   float treeAngle = atan(instanceMatrix[2].x, instanceMatrix[2].z);
   float elevation = atan(toCamera.y,length(toCamera.xz));
   vTreeView = mod(floor((cameraAngle-treeAngle)*4./6.28318530718+.5)+8.,4.) + (elevation>.5235987756?4.:0.);
   vec3 right = vec3(cos(cameraAngle),0.,-sin(cameraAngle));
   vec3 up = vec3(-sin(cameraAngle)*sin(elevation),cos(elevation),-cos(cameraAngle)*sin(elevation));
   vec4 mvPosition = viewMatrix * vec4(origin.xyz + right*(position.x-(${center.x.toFixed(8)}))*scale + up*(position.y-(${center.y.toFixed(8)}))*scale,1.);
   gl_Position = projectionMatrix * mvPosition;
  `);
  shader.fragmentShader='varying float vTreeView;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec2 atlasUv=(vec2(mod(vTreeView,4.),floor(vTreeView/4.))+clamp(vMapUv,vec2(.001),vec2(.999)))/vec2(4.,2.);
   vec4 sampledDiffuseColor=texture2D(map,atlasUv);
   diffuseColor *= sampledDiffuseColor;
  `);
 };
 material.customProgramCacheKey=()=> `valley-tree-atlas-v1-${center.toArray().map(value=>value.toFixed(8)).join(',')}`;
 return {geometry,material,target,width,height,center};
}

export function createForest(scene) {
 const chunks=[],materials=new Set(),atlases=[];
 const dummy=new THREE.Object3D();
 const cameraPosition=new THREE.Vector3();
 return {
  chunks,materials,atlases,
  addSpecies(tree,placements,impostor) {
   materials.add(tree.leavesMesh.material);atlases.push(impostor);
   for(const [key,points] of partitionPlacements(placements)){
    const group=new THREE.Group();group.name=`forest-${tree.options.seed}-${key}`;
    const meshes=[];
    for(const source of [tree.branchesMesh,tree.leavesMesh,impostor]){
     const mesh=new THREE.InstancedMesh(source.geometry,source.material,points.length);
     points.forEach((p,i)=>{
      dummy.position.set(p.x,p.h,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      mesh.setColorAt(i,new THREE.Color(source===tree.branchesMesh?p.branchColor:p.color));
     });
     mesh.computeBoundingBox();mesh.computeBoundingSphere();
     // Billboard can rotate outside the plane's original Z bounds.
     if(source===impostor){
      mesh.boundingBox.expandByScalar(impostor.width*Math.max(...points.map(p=>p.scale))*.5);
      mesh.boundingBox.getBoundingSphere(mesh.boundingSphere);
     } else {mesh.boundingBox.expandByScalar(.2);mesh.boundingSphere.radius+=.2;}
     mesh.castShadow=source!==impostor;mesh.receiveShadow=source!==impostor;
     meshes.push(mesh);group.add(mesh);
    }
    meshes[2].visible=false;scene.add(group);
    const bounds=new THREE.Box3().union(meshes[0].boundingBox).union(meshes[1].boundingBox).union(meshes[2].boundingBox);
    chunks.push({group,meshes,bounds,points,far:false});
   }
  },
  update(camera,seconds) {
   for(const material of materials) material.userData.time.value=seconds;
   if(!camera) return;
   camera.getWorldPosition(cameraPosition);
   for(const chunk of chunks){
    const distance=chunk.bounds.distanceToPoint(cameraPosition);
    const threshold=FOREST_LOD_DISTANCE+(chunk.far?-FOREST_LOD_HYSTERESIS:FOREST_LOD_HYSTERESIS);
    chunk.far=distance>threshold;
    chunk.meshes[0].visible=chunk.meshes[1].visible=!chunk.far;chunk.meshes[2].visible=chunk.far;
   }
  }
 };
}
