import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const out=process.env.OUTPUT_DIR||'artifacts/valley';
const url=process.env.SCENE_URL||'http://127.0.0.1:5173/scene.html';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist']});
const results={url,checks:[],views:[],errors:[],failures:[],performance:[]};
const check=(name,condition)=>{if(!condition){results.failures.push(name);throw Error(name);}results.checks.push(name);console.log(`PASS ${name}`);};
async function open(viewport,reducedMotion='reduce'){
 const page=await browser.newPage({viewport,reducedMotion});
 page.on('pageerror',error=>results.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')results.errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)results.errors.push(`${response.status()} ${response.url()}`);});
 await page.addInitScript(()=>{
  window.__sceneTools={};
  Object.defineProperty(document,'modelContext',{value:{registerTool(tool){window.__sceneTools[tool.name]=tool;}}});
 });
 await page.goto(url);
 await page.waitForFunction(()=>Boolean(window.__sceneTools.get_valley_scene),null,{timeout:120000});
 return page;
}
const state=page=>page.evaluate(()=>window.__sceneTools.get_valley_scene.execute());
const configure=(page,input)=>page.evaluate(input=>window.__sceneTools.configure_valley_scene.execute(input),input);
try{
 const page=await open({width:1440,height:900});
 let initial=await state(page);
 check('reduced motion starts paused',initial.ready&&!initial.playing&&initial.reducedMotion);
 const frames=initial.renderedFrames;
 await page.waitForTimeout(800);
 check('paused renderer becomes idle',(await state(page)).renderedFrames<=frames+2);
 for(const [camera,seconds] of [['cinematic',0],['fpv',10],['trackside',25],['aerial',40],['town',15],['tunnel',5],['orbit',0]]){
  const current=await configure(page,{camera,seconds,playing:false});
  check(`${camera} camera responds`,current.camera===camera&&current.eye.every(Number.isFinite));
  const repeated=await configure(page,{camera,playing:false});
  check(`${camera} switching preserves train position`,Math.abs(current.trains[0].position-repeated.trains[0].position)<1e-8);
  await page.screenshot({path:`${out}/${camera}.png`});
  results.views.push({camera,seconds,state:current});
 }
 await page.locator('#train').selectOption('1');
 check('train selector changes followed service',(await state(page)).selectedTrain===1);
 await page.locator('#quality').selectOption('high');
 check('high detail control applies',(await state(page)).quality==='high');
 await page.locator('#quality').selectOption('balanced');
 await page.locator('#hud').click();
 check('clean view has accessible restore button',await page.locator('#restore-ui').isVisible());
 check('hidden controls leave tab order',await page.locator('.control-dock').evaluate(e=>e.inert));
 await page.locator('#restore-ui').click();
 check('restore returns focus',await page.locator('#hud').evaluate(e=>e===document.activeElement));
 await page.locator('#about').click();
 const pausedBefore=(await state(page)).playing;
 await page.keyboard.press('Space');
 check('Space in dialog does not toggle playback',(await state(page)).playing===pausedBefore);
 await page.keyboard.press('Escape');
 check('dialog closes and restores focus',await page.locator('#about').evaluate(e=>e===document.activeElement));
 await page.locator('#play').focus();await page.keyboard.press('Space');
 await page.waitForFunction(()=>window.__sceneTools.get_valley_scene.execute().playing===true);
 check('Space on play button activates once',(await state(page)).playing);
 await page.locator('#play').click();
 await page.locator('#scene-canvas').focus();await page.keyboard.press('Space');
 check('canvas Space shortcut plays',(await state(page)).playing);
 await page.keyboard.press('Space');
 for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(viewport);await configure(page,{camera:'fpv',seconds:15,playing:false});
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('.control-dock button,.control-dock select,.control-dock input,.control-dock summary')].filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.textContent,x:r.x,y:r.y,width:r.width,height:r.height};})}));
  check(`${viewport.width}x${viewport.height} no horizontal overflow`,!layout.overflow);
  check(`${viewport.width}x${viewport.height} controls stay in viewport`,layout.controls.every(r=>r.x>=-1&&r.x+r.width<=viewport.width+1&&r.y>=-1&&r.y+r.height<=viewport.height+1));
  await page.screenshot({path:`${out}/responsive-${viewport.width}x${viewport.height}.png`});
  if(viewport.width<=700){
   check(`${viewport.width} compact settings start collapsed`,await page.locator('#advanced-controls').evaluate(e=>!e.open));
   await page.locator('#advanced-controls summary').focus();await page.keyboard.press('Space');
   check(`${viewport.width} settings opens without toggling playback`,await page.locator('#advanced-controls').evaluate(e=>e.open)&&!(await state(page)).playing);
   await page.locator('#quality').selectOption('balanced');
   await page.locator('#advanced-controls summary').click();
  }
 }
 await page.close();
 const motion=await open({width:1280,height:720},'no-preference');
 await configure(motion,{camera:'fpv',seconds:12,playing:true});
 const start=await state(motion),startTime=Date.now();
 await motion.waitForTimeout(6000);
 const end=await state(motion),elapsed=(Date.now()-startTime)/1000;
 check('normal motion advances trains',end.seconds>start.seconds&&end.trains[0].position!==start.trains[0].position);
 const fps=(end.renderedFrames-start.renderedFrames)/elapsed;
 results.performance.push({viewport:'1280x720',quality:'balanced',gpu:end.gpu,elapsed,frames:end.renderedFrames-start.renderedFrames,fps,drawCalls:end.drawCalls,triangles:end.triangles});
 await motion.emulateMedia({reducedMotion:'reduce'});
 await motion.waitForFunction(()=>window.__sceneTools.get_valley_scene.execute().reducedMotion===true);
 check('live reduced-motion change pauses',(await state(motion)).playing===false);
 await motion.close();
 const workshop=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 workshop.on('pageerror',error=>results.errors.push(error.message));
 await workshop.addInitScript(()=>{window.__sceneTools={};Object.defineProperty(document,'modelContext',{value:{registerTool(tool){window.__sceneTools[tool.name]=tool;}}});});
 await workshop.goto(new URL('./#workshop',url).href);
 await workshop.waitForFunction(()=>window.__sceneTools.get_locomotive_view?.execute().ready,{},{timeout:120000});
 for(const model of ['heritage','commodore']){
  const view=await workshop.evaluate(model=>window.__sceneTools.configure_locomotive_view.execute({model,separation:100}),model);
  check(`${model} workshop loads all nine exploded assemblies`,view.ready&&view.assemblies.length===9&&view.separation===100);
  await workshop.locator('#workshop').scrollIntoViewIfNeeded();
  await workshop.screenshot({path:`${out}/workshop-${model}.png`});
  const replay=await workshop.evaluate(()=>window.__sceneTools.configure_build_walkthrough.execute({seconds:12,playing:false,wireframe:true}));
  check(`${model} assembly replay returns assembled`,replay.separation===0&&replay.wireframe);
 }
 await workshop.close();
 const failure=await browser.newPage({viewport:{width:390,height:844}});
 await failure.route('**/generated/scene/forest-diffuse.jpg',route=>route.abort('failed'));
 await failure.goto(url);
 await failure.waitForFunction(()=>document.querySelector('#loading').dataset.state==='error',null,{timeout:30000});
 check('failed scene offers retry and workshop escape',await failure.locator('#retry-scene').isVisible()&&await failure.locator('.loading-actions a').isVisible());
 await failure.screenshot({path:`${out}/loading-error.png`});await failure.close();
 assert.deepEqual(results.errors,[],'No console, runtime, or failed-network errors');
 console.log(JSON.stringify(results.performance,null,2));
}finally{
 await writeFile(`${out}/browser-results.json`,JSON.stringify(results,null,2));
 await browser.close();
}
