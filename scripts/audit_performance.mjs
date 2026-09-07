import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.OUTPUT_DIR||'artifacts/audit/performance-baseline';await mkdir(out,{recursive:true});
const duration=Number(process.env.DURATION_SECONDS||240),width=Number(process.env.WIDTH||1280),height=Number(process.env.HEIGHT||720),throttle=Number(process.env.CPU_THROTTLE||1);
const url=process.env.SCENE_URL||'https://kvnloo.github.io/north-star-railworks/nightly/scene.html';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:Number(process.env.DPR||1),reducedMotion:'no-preference'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
await page.addInitScript(()=>{
 window.__sceneTools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__sceneTools[t.name]=t;}}});
 window.__audit={frames:[],longTasks:[],active:false,last:0};
 try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__audit.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});}catch{}
 const sample=t=>{const a=window.__audit;if(a.active&&a.last)a.frames.push(t-a.last);a.last=a.active?t:0;requestAnimationFrame(sample);};requestAnimationFrame(sample);
});
function stats(raw){const sorted=[...raw].sort((a,b)=>a-b),sum=raw.reduce((a,b)=>a+b,0),q=p=>sorted[Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1)],n=Math.max(1,Math.ceil(raw.length*.001)),tail=sorted.slice(-n);return {frames:raw.length,durationMs:sum,averageFps:raw.length*1000/sum,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),p999Ms:q(.999),reciprocalP999Fps:1000/q(.999),slowestPointOnePercentFps:1000/(tail.reduce((a,b)=>a+b,0)/n),tailSamples:n,over50ms:raw.filter(x=>x>50).length,over100ms:raw.filter(x=>x>100).length,maxMs:sorted.at(-1)};}
try{
 const start=Date.now();await page.goto(url);await page.waitForFunction(()=>window.__sceneTools.get_valley_scene,null,{timeout:180000});const readyMs=Date.now()-start;
 if(process.env.QUALITY)await page.locator('#quality').selectOption(process.env.QUALITY);
 await page.evaluate(()=>window.__sceneTools.configure_valley_scene.execute({camera:'cinematic',seconds:0,playing:true}));
 await page.waitForTimeout(10000);
 await page.evaluate(()=>{window.__audit.active=true;window.__audit.start=performance.now();});
 await page.waitForTimeout(duration*1000);
 const data=await page.evaluate(()=>{window.__audit.active=false;return {audit:window.__audit,state:window.__sceneTools.get_valley_scene.execute(),resources:performance.getEntriesByType('resource').map(r=>({name:r.name,transferSize:r.transferSize,decodedBodySize:r.decodedBodySize,duration:r.duration})),heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize,limit:performance.memory.jsHeapSizeLimit}:null,visibility:document.visibilityState};});
 const result={url,viewport:{width,height},dpr:Number(process.env.DPR||1),cpuThrottle:throttle,readyMs,warmupSeconds:10,requestedDurationSeconds:duration,errors,...data,summary:stats(data.audit.frames)};
 await writeFile(`${out}/results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({readyMs,errors,state:data.state,summary:result.summary},null,2));
}finally{await browser.close();}
