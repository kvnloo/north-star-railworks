import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {makeEnvironment,makeLake} from './environment.js';
import {makeRailway,makeTunnel} from './railway.js';
import {makeTown} from './town.js';
import {freezeStaticScene,warmScene,applyRenderQuality} from './runtime-performance.js';
import {AdaptiveResolution} from './adaptive-resolution.js';
import {loadTrains,positionTrain,makeSteam} from './trains.js';
import {cameraShot,blendCamera,CAMERA_MODES,SHOT_NAMES,cameraFloor} from './cameras.js';

const $=selector=>document.querySelector(selector);
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=motionPreference.matches;
let seconds=0,playing=!reduced,pace=1,mode='cinematic',selected=0,ready=false;
let renderer,composer,camera,controls,scene,environment,trains,steam,lake,sun;
let dirty=true,settled=false,lastShot='',quality='auto';
const adaptive=new AdaptiveResolution({maxRatio:Math.min(devicePixelRatio,1.5)});
let frameTotal=0,frameTime=0,lastFrameMs=0,shadowElapsed=0;
let drawCalls=0,triangles=0,renderedFrames=0;
const invalidate=()=>{dirty=true;};

function setPlaying(value){
 playing=value;adaptive.reset();invalidate();
 $('#play').textContent=playing?'Ⅱ':'▶';
 $('#play').setAttribute('aria-pressed',String(playing));
 $('#play').setAttribute('aria-label',playing?'Pause railway':'Play railway');
 if(!playing)$('#fps').textContent='Paused';
}
function setMode(next){
 if(!CAMERA_MODES.includes(next))throw Error('Unknown camera');
 mode=next;settled=false;lastShot='';invalidate();
 controls.enabled=mode==='orbit';
 document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===mode)));
 if(mode==='orbit'){
  const shot=cameraShot({mode,seconds,t:trains[selected].t,aspect:camera.aspect,reduced});
  controls.target.copy(shot.target);
  // Keep the current eye on entering free orbit rather than resetting the user's view.
  camera.lookAt(controls.target);controls.update();
 }
}
function resize(){
 if(!composer)return;
 const pixelRatio=quality==='auto'?adaptive.ratio:Math.min(devicePixelRatio,quality==='high'?1.5:1);
 applyRenderQuality({renderer,composer,camera,sun,pixelRatio,shadowSize:quality==='high'?2048:1024,width:innerWidth,height:innerHeight});
 settled=false;adaptive.reset();invalidate();
}
function setQuality(value){
 if(!['auto','balanced','high'].includes(value))throw Error('Unknown detail setting');
 quality=value;resize();
}
function updateCamera(dt,immediate=false){
 const train=trains[selected];
 const desired=cameraShot({mode,seconds,t:train.t,line:train.line,aspect:camera.aspect,reduced});
 if(desired.shot!==lastShot){
  const description=SHOT_NAMES[desired.shot];
  $('#shot-number').textContent=description[0];$('#shot-name').textContent=description[1];$('#shot-description').textContent=description[2];
  // Director's cut is deliberately edited. User-selected cameras ease into place.
  if(mode==='cinematic'&&lastShot)immediate=true;
  lastShot=desired.shot;
 }
 if(mode==='orbit'){
  const changed=controls.update();
  camera.position.y=Math.max(camera.position.y,cameraFloor(camera.position.x,camera.position.z));
  settled=!changed;return;
 }
 settled=blendCamera(camera,desired,dt,{immediate,reduced});
}
function updateWorld(){
 for(const train of trains)positionTrain(train,seconds);
  steam.update(seconds,trains);
 if(lake.material.userData.shader)lake.material.userData.shader.uniforms.uTime.value=reduced?0:seconds;
}
function render(){
 renderer.info.reset();
 composer.render();
 drawCalls=renderer.info.render.calls;triangles=renderer.info.render.triangles;renderedFrames++;
}
function showError(error){
 ready=false;renderer?.setAnimationLoop(null);console.error(error);
 window.dispatchEvent(new CustomEvent('valley:error',{detail:{message:'The scene could not load. Reload to retry, or return to the workshop.'}}));
}
async function init(){
 try{
  renderer=new THREE.WebGLRenderer({canvas:$('#scene-canvas'),antialias:true,powerPreference:'high-performance'});
  renderer.info.autoReset=false;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.78;renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xa1b2a5,.0023);
  camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.2,1800);
  const sky=new Sky();sky.scale.setScalar(1500);scene.add(sky);
  Object.assign(sky.material.uniforms.turbidity,{value:5});sky.material.uniforms.rayleigh.value=1.6;
  sky.material.uniforms.mieCoefficient.value=.005;sky.material.uniforms.mieDirectionalG.value=.78;
  const sunDirection=new THREE.Vector3(-.65,.42,-.5).normalize();sky.material.uniforms.sunPosition.value.copy(sunDirection);
  const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(sky).texture;pmrem.dispose();scene.environmentIntensity=.4;
  sun=new THREE.DirectionalLight(0xffdfaa,2.5);sun.position.copy(sunDirection).multiplyScalar(250);sun.castShadow=true;sun.shadow.mapSize.setScalar(1024);
  Object.assign(sun.shadow.camera,{left:-150,right:150,top:150,bottom:-150,near:1,far:650});sun.shadow.normalBias=.14;sun.shadow.bias=-.00015;scene.add(sun,sun.target);
  scene.add(new THREE.HemisphereLight(0xb8ced3,0x3b4128,1.15));
  controls=new OrbitControls(camera,renderer.domElement);controls.enabled=false;controls.enableDamping=true;
  controls.minDistance=6;controls.maxDistance=650;controls.maxPolarAngle=Math.PI*.48;controls.addEventListener('change',invalidate);
  $('#loading-text').textContent='Growing the forest and shaping the valley…';
  environment=await makeEnvironment(scene,renderer);lake=makeLake(scene);
  const materials={wood:new THREE.MeshStandardMaterial({color:0x655140,roughness:1}),ballast:new THREE.MeshStandardMaterial({color:0x706f5c,roughness:1})};
  makeRailway(scene,materials);makeTunnel(scene,environment.rockMat);makeTown(scene,environment.rockMat);
  freezeStaticScene(scene);
  trains=await loadTrains(scene,text=>$('#loading-text').textContent=text);steam=makeSteam(scene);
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.10,.45,1.1));composer.addPass(new OutputPass());
  updateWorld();updateCamera(0,true);if(environment.update)environment.update(camera,0);
  $('#loading-text').textContent='Preparing shaders and textures…';
  await warmScene(scene,camera,renderer);render();
  ready=true;$('#loading').classList.add('hidden');setPlaying(playing);registerTools();
  let previous=performance.now();
  renderer.setAnimationLoop(now=>{
   const elapsed=Math.max(0,(now-previous)/1000);previous=now;
   if(document.hidden){adaptive.reset();return;}
   const dt=Math.min(elapsed,.25);
   if(!playing&&!dirty&&settled)return;
   if(playing)seconds+=dt*pace;
   updateWorld();updateCamera(dt);
   if(environment.update)environment.update(camera,reduced?0:seconds*.45);
   shadowElapsed+=dt;
   if(shadowElapsed>=(quality==='high'?.08:.2)){
    renderer.shadowMap.needsUpdate=true;shadowElapsed=0;
   }
   const start=performance.now();render();lastFrameMs=performance.now()-start;dirty=false;
   if(playing){
    if(quality==='auto'){const ratio=adaptive.sample(elapsed*1000);if(ratio!==renderer.getPixelRatio())resize();}
    frameTotal++;frameTime+=elapsed;
    if(frameTime>1){$('#fps').textContent=`${Math.round(frameTotal/frameTime)} FPS`;frameTotal=0;frameTime=0;}
   }
  });
 }catch(error){showError(error);}
}
function state(){
 const gl=renderer?.getContext(),debug=gl?.getExtension('WEBGL_debug_renderer_info');
 return {ready,playing,reducedMotion:reduced,seconds,pace,camera:mode,selectedTrain:selected,quality,
  eye:camera?.position.toArray(),renderedFrames,lastFrameMs,
  pixelRatio:renderer?.getPixelRatio(),drawingBuffer:gl?[gl.drawingBufferWidth,gl.drawingBufferHeight]:null,
  composerBuffer:composer?[composer.readBuffer.width,composer.readBuffer.height]:null,adaptiveP95Ms:adaptive.p95Ms,
  rendererBackend:'webgl2',shaderPrograms:renderer?.info.programs?.length,
  gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable',
  trains:trains?.map(t=>({name:t.name,line:t.line,position:t.t})),
  environment:{trees:environment?.treeCount,rocks:environment?.rockCount,ferns:environment?.fernCount,stations:2,tunnels:1},drawCalls,triangles};
}
function configure(input){
 if(!input||Object.keys(input).some(k=>!['camera','train','playing','seconds'].includes(k)))throw Error('Invalid configuration');
 if(input.camera!==undefined&&!CAMERA_MODES.includes(input.camera))throw Error('Unknown camera');
 if(input.train!==undefined&&(!Number.isInteger(input.train)||input.train<0||input.train>3))throw Error('Unknown train');
 if(input.seconds!==undefined&&(!Number.isFinite(input.seconds)||input.seconds<0||input.seconds>3600))throw Error('Invalid time');
 if(input.playing!==undefined&&typeof input.playing!=='boolean')throw Error('Invalid playback state');
 if(input.train!==undefined){selected=input.train;$('#train').value=selected;settled=false;}
 if(input.seconds!==undefined)seconds=input.seconds;
 if(input.camera!==undefined)setMode(input.camera);
 if(input.playing!==undefined)setPlaying(input.playing);
 updateWorld();updateCamera(0,true);if(environment.update)environment.update(camera,reduced?0:seconds*.45);
 renderer.shadowMap.needsUpdate=true;render();invalidate();return state();
}
function registerTools(){
 const context=document.modelContext;if(!context?.registerTool)return;
 context.registerTool({name:'get_valley_scene',description:'Read actual scene readiness, cameras, GPU, render counts, train positions and environment counts.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:state});
 context.registerTool({name:'configure_valley_scene',description:'Choose a railway camera or train, play or pause, and seek simulation time.',inputSchema:{type:'object',properties:{camera:{type:'string',enum:CAMERA_MODES},train:{type:'integer',minimum:0,maximum:3},playing:{type:'boolean'},seconds:{type:'number',minimum:0,maximum:3600}},additionalProperties:false},execute:configure});
}
$('#play').addEventListener('click',()=>ready&&setPlaying(!playing));
$('#speed').addEventListener('input',e=>pace=Number(e.target.value));
$('#train').addEventListener('change',e=>{selected=Number(e.target.value);settled=false;invalidate();});
for(const button of document.querySelectorAll('[data-camera]'))button.addEventListener('click',()=>ready&&setMode(button.dataset.camera));
$('#quality').addEventListener('change',e=>ready&&setQuality(e.target.value));
$('#hud').addEventListener('click',()=>document.body.classList.toggle('clean'));
$('#fullscreen').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
 catch{$('#ui-status').textContent='Fullscreen is not available in this browser.';}
});
$('#about').addEventListener('click',()=>$('#notes').showModal());
$('#close-notes').addEventListener('click',()=>$('#notes').close());
$('#notes').addEventListener('close',()=>$('#about').focus());
window.addEventListener('keydown',e=>{
 if(!ready||e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||$('#notes').open)return;
 if(e.target.closest('button,a,input,select,textarea,summary,[contenteditable="true"]'))return;
 if(e.key.toLowerCase()==='h'){document.body.classList.toggle('clean');e.preventDefault();}
 if(e.code==='Space'){e.preventDefault();setPlaying(!playing);}
});
motionPreference.addEventListener('change',event=>{reduced=event.matches;if(reduced)setPlaying(false);settled=false;invalidate();});
$('#scene-canvas').addEventListener('webglcontextlost',()=>{ready=false;renderer?.setAnimationLoop(null);});
window.addEventListener('resize',resize);
void init();
