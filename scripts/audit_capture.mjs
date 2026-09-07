import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.OUTPUT_DIR||'artifacts/audit/baseline';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{window.__sceneTools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__sceneTools[t.name]=t;}}});});
try{
 await page.goto(process.env.SCENE_URL||'https://kvnloo.github.io/north-star-railworks/nightly/scene.html');
 await page.waitForFunction(()=>window.__sceneTools.get_valley_scene,null,{timeout:120000});
 for(const camera of ['cinematic','fpv','trackside','aerial','town','tunnel','orbit'])for(const seconds of [0,35,75]){
  const state=await page.evaluate(input=>window.__sceneTools.configure_valley_scene.execute(input),{camera,seconds,playing:false});
  const name=`${camera}-${seconds}.png`;await page.screenshot({path:`${out}/${name}`});views.push({name,state});
 }
 for(const [width,height] of [[320,568],[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  for(const camera of ['fpv','town','aerial']){
   const state=await page.evaluate(input=>window.__sceneTools.configure_valley_scene.execute(input),{camera,seconds:35,playing:false});
   const name=`${camera}-${width}x${height}.png`;await page.screenshot({path:`${out}/${name}`});views.push({name,state});
  }
 }
 const capability=await page.evaluate(async()=>{let adapter=null,error=null;try{adapter=await navigator.gpu?.requestAdapter();}catch(e){error=String(e);}return {webgpuExposed:!!navigator.gpu,adapter:!!adapter,adapterInfo:adapter?{...adapter.info}:null,error,userAgent:navigator.userAgent};});
 await writeFile(`${out}/capture.json`,JSON.stringify({views,errors,capability},null,2));console.log(JSON.stringify({screenshots:views.length,errors,capability}));
}finally{await browser.close();}
