import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Vector2} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';

const source=readFileSync(new URL('../web/valley/scene.js',import.meta.url),'utf8');
// Execute the production quality and resize functions without booting the browser scene.
const functions=source.match(/^function resize\(\)\{[\s\S]*?(?=^function updateCamera\()/m)?.[0];
assert.ok(functions,'Scene resize and setQuality functions must be present');
const renderer={
 pixelRatio:1,size:new Vector2(1280,720),shadowMap:{needsUpdate:false},
 getPixelRatio(){return this.pixelRatio;},
 setPixelRatio(value){this.pixelRatio=value;},
 getSize(target){return target.copy(this.size);},
 setSize(width,height){this.size.set(width,height);}
};
const composer=new EffectComposer(renderer);
const context={
 renderer,composer,devicePixelRatio:2,innerWidth:1280,innerHeight:720,
 quality:'balanced',settled:true,invalidate(){},
 camera:{aspect:1280/720,updateProjectionMatrix(){}},
 sun:{shadow:{mapSize:new Vector2(1024,1024),map:null}}
};
runInNewContext(`${functions}\nthis.setQuality=setQuality;`,context);
const observations=[];
function verify(quality,pixelRatio,expectedSize){
 const buffers=[composer.readBuffer,composer.writeBuffer].map(target=>[target.width,target.height]);
 const observation={quality,rendererPixelRatio:renderer.getPixelRatio(),buffers};
 observations.push(observation);
 console.log(JSON.stringify(observation));
 assert.equal(renderer.getPixelRatio(),pixelRatio);
 assert.deepEqual(buffers,[expectedSize,expectedSize],`${quality}: both actual EffectComposer buffers must match renderer pixel ratio`);
}
try{
 verify('initial balanced',1,[1280,720]);
 context.setQuality('high');
 verify('high',1.5,[1920,1080]);
 context.setQuality('balanced');
 verify('balanced',1,[1280,720]);
 console.log(JSON.stringify({status:'pass',devicePixelRatio:2,observations}));
}finally{
 composer.dispose();
}
