// Auto adds supersampling only when measured frame pacing has headroom. It never
// removes scene objects, lowers texture detail, or undersamples the accepted baseline.
export class AdaptiveResolution {
 constructor({maxRatio=1.5}={}){
  this.maxRatio=Math.max(1,Math.min(maxRatio,1.5));this.ratio=1;
  this.samples=new Float32Array(120);this.count=0;this.elapsed=0;this.goodWindows=0;this.badWindows=0;this.cooldown=0;this.p95Ms=0;
 }
 reset(){this.count=0;this.goodWindows=0;this.badWindows=0;this.cooldown=this.elapsed+15000;}
 sample(ms){
  if(!Number.isFinite(ms)||ms<=0||ms>1000)return this.ratio;
  this.elapsed+=ms;this.samples[this.count++]=ms;
  if(this.count<this.samples.length)return this.ratio;
  const sorted=this.samples.slice().sort();this.count=0;this.p95Ms=sorted[Math.ceil(sorted.length*.95)-1];
  if(this.elapsed<this.cooldown)return this.ratio;
  this.goodWindows=this.p95Ms<19?this.goodWindows+1:0;
  this.badWindows=this.p95Ms>27?this.badWindows+1:0;
  if(this.badWindows>=2&&this.ratio>1){this.ratio=Math.max(1,this.ratio-.25);this.reset();}
  else if(this.goodWindows>=5&&this.ratio<this.maxRatio){this.ratio=Math.min(this.maxRatio,this.ratio+.25);this.reset();}
  return this.ratio;
 }
}
