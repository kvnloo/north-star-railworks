import {chromium} from '@playwright/test';import {writeFile,mkdir} from 'node:fs/promises';
const out=process.env.OUTPUT_DIR||'artifacts/audit/cpu-baseline';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'no-preference'});
 await page.addInitScript(()=>{window.__sceneTools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__sceneTools[t.name]=t;}}});});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 await page.goto(process.env.SCENE_URL||'https://kvnloo.github.io/north-star-railworks/nightly/scene.html');await page.waitForFunction(()=>window.__sceneTools.get_valley_scene,null,{timeout:120000});
 await page.evaluate(()=>window.__sceneTools.configure_valley_scene.execute({camera:'cinematic',seconds:0,playing:true}));await page.waitForTimeout(45000);
 const {profile}=await cdp.send('Profiler.stop');await writeFile(`${out}/cpu.cpuprofile`,JSON.stringify(profile));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),times=new Map();for(let i=0;i<profile.samples.length;i++){const id=profile.samples[i];times.set(id,(times.get(id)||0)+profile.timeDeltas[i]);}
 const rows=[...times].map(([id,us])=>({function:nodes.get(id).callFrame.functionName,url:nodes.get(id).callFrame.url,line:nodes.get(id).callFrame.lineNumber,ms:us/1000})).sort((a,b)=>b.ms-a.ms);
 await writeFile(`${out}/summary.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.slice(0,25),null,2));
}finally{await browser.close();}
