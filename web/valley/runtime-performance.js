import {WebGLRenderTarget} from 'three';

export function applyRenderQuality({renderer,composer,camera,sun,pixelRatio,shadowSize,width,height}){
 renderer.setPixelRatio(pixelRatio);composer.setPixelRatio(pixelRatio);
 renderer.setSize(width,height);composer.setSize(width,height);
 camera.aspect=width/height;camera.updateProjectionMatrix();
 if(sun.shadow.mapSize.x!==shadowSize){
  sun.shadow.mapSize.setScalar(shadowSize);sun.shadow.map?.dispose();sun.shadow.map=null;
 }
 renderer.shadowMap.needsUpdate=true;
}

export async function warmScene(scene,camera,renderer){
 const textures=new Set();
 scene.traverse(object=>{
  const materials=Array.isArray(object.material)?object.material:[object.material];
  for(const material of materials)if(material)for(const value of Object.values(material)){
   if(value?.isTexture&&!value.isRenderTargetTexture)textures.add(value);
  }
 });
 for(const texture of textures)renderer.initTexture(texture);
 await renderer.compileAsync(scene,camera);
 // compileAsync does not exercise shadow depth variants or upload culled geometry.
 // Pay that first-use cost while the loading overlay is still visible.
 const target=new WebGLRenderTarget(1,1),previous=renderer.getRenderTarget(),states=[];
 scene.traverse(object=>{states.push([object,object.visible,object.frustumCulled]);object.visible=true;object.frustumCulled=false;});
 try{renderer.setRenderTarget(target);renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);}
 finally{
  for(const [object,visible,culled] of states){object.visible=visible;object.frustumCulled=culled;}
  renderer.setRenderTarget(previous);target.dispose();renderer.shadowMap.needsUpdate=true;
 }
}

// Freeze immutable objects before adding trains; shader wind remains live.
export function freezeStaticScene(scene){
 scene.updateMatrixWorld(true);
 scene.traverse(object=>{
  if(object===scene)return;
  object.matrixAutoUpdate=false;
  object.matrixWorldAutoUpdate=false;
 });
}
