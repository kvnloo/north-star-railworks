import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.OUTPUT_DIR||'artifacts/valley';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{window.__sceneTools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__sceneTools[t.name]=t;}}});});
 await page.goto(process.env.SCENE_URL||'http://127.0.0.1:5173/scene.html');
 await page.waitForFunction(()=>document.querySelector('#loading').classList.contains('hidden'),null,{timeout:120000});
 const state=await page.evaluate(()=>window.__sceneTools.get_valley_scene.execute());console.log(JSON.stringify(state));
 await page.screenshot({path:`${out}/initial.png`});
 await writeFile(`${out}/initial.json`,JSON.stringify({state,errors},null,2));
}finally{await browser.close();}
