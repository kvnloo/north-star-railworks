import assert from 'node:assert/strict';
import {Vector2,PerspectiveCamera} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
const {applyRenderQuality}=await import('../web/valley/runtime-performance.js');
assert.equal(typeof applyRenderQuality,'function','shared quality application must synchronize real buffers');
const renderer={pixelRatio:1,size:new Vector2(1280,720),shadowMap:{needsUpdate:false},getPixelRatio(){return this.pixelRatio;},setPixelRatio(v){this.pixelRatio=v;},getSize(t){return t.copy(this.size);},setSize(w,h){this.size.set(w,h);}};
const composer=new EffectComposer(renderer),camera=new PerspectiveCamera(),sun={shadow:{mapSize:new Vector2(1024,1024),map:null}};
try{
 for(const [name,ratio,shadowSize,width,height] of [['high',1.5,2048,1280,720],['balanced',1,1024,1280,720],['adaptive',1.25,1024,390,844]]){
  applyRenderQuality({renderer,composer,camera,sun,pixelRatio:ratio,shadowSize,width,height});
  assert.equal(renderer.getPixelRatio(),ratio);assert.equal(camera.aspect,width/height);
  for(const target of [composer.readBuffer,composer.writeBuffer])assert.deepEqual([target.width,target.height],[width*ratio,height*ratio]);
  assert.equal(sun.shadow.mapSize.x,shadowSize);console.log('PASS real compositor dimensions',name,composer.readBuffer.width,composer.readBuffer.height);
 }
 let disposals=0;sun.shadow.map={dispose(){disposals++;}};
 applyRenderQuality({renderer,composer,camera,sun,pixelRatio:1.25,shadowSize:1024,width:390,height:844});assert.equal(disposals,0,'unchanged shadow settings must not reallocate maps');
}finally{composer.dispose();}
