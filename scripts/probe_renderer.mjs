import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH, args:['--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage();
 console.log(await page.evaluate(()=>{
  const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2');
  if(!gl)return {webgl2:false};const info=gl.getExtension('WEBGL_debug_renderer_info');
  return {webgl2:true,renderer:info&&gl.getParameter(info.UNMASKED_RENDERER_WEBGL),vendor:info&&gl.getParameter(info.UNMASKED_VENDOR_WEBGL)};
 }));
} finally {await browser.close();}
