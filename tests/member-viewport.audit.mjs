import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
const origin=process.env.BASE_URL||"http://127.0.0.1:3100";
const routes=["home","event","attendance","ai-process","reward"];
const widths=[320,360,390,440,480,768,1024,1440];
await mkdir("artifacts/member-viewport",{recursive:true});
const browser=await chromium.launch({headless:true}),failed=[],records=[];
for(const width of widths){
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,colorScheme:"light"});
 const results=[];
 for(const name of routes){
  const page=await context.newPage(),path="/design-"+name;
  try{
   const res=await page.goto(origin+path,{waitUntil:"domcontentloaded",timeout:45000});
   if(!res||res.status()>=400)throw Error("HTTP "+res?.status());
   await page.locator(".member-app-frame").waitFor({state:"visible",timeout:15000});
   await page.locator(".member-app-nav").waitFor({state:"visible",timeout:15000});
   await page.waitForTimeout(220);
   const a=await page.evaluate(()=>{
    const box=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom}};
    const back=document.querySelector('a[aria-label="홈으로 돌아가기"]');
    const nav=document.querySelector(".member-app-nav");
    return {frame:box(".member-app-frame"),nav:box(".member-app-nav"),
      back:box('a[aria-label="홈으로 돌아가기"]'),
      backColor:back?getComputedStyle(back).color:null,
      iconColor:back?getComputedStyle(back.firstElementChild).color:null,
      navCount:nav?.querySelectorAll("a").length,activeCount:nav?.querySelectorAll('a[aria-current="page"]').length,
      market:box(".ai-assets-panel"),scrollWidth:document.documentElement.scrollWidth};
   });
   const label=name+" @"+width;
   if(!a.frame||!a.nav)failed.push(label+" frame or nav missing");
   else {
    if(a.navCount!==5||a.activeCount!==1)failed.push(label+" nav links/active "+a.navCount+"/"+a.activeCount);
    if(Math.abs(a.nav.x-a.frame.x)>1.1||Math.abs(a.nav.w-a.frame.w)>1.1)failed.push(label+" nav and frame do not align");
    if(Math.abs(a.nav.bottom-900)>1.1)failed.push(label+" nav not at screen bottom");
    if(a.scrollWidth>width+1)failed.push(label+" horizontal overflow: "+a.scrollWidth);
    if(name==="home"&&width>=768&&a.market&&a.market.w<a.frame.w*0.75)failed.push(label+" desktop market width: "+a.market.w+" vs frame "+a.frame.w);
    if(name!=="home"&&!a.back)failed.push(label+" home return link missing");
    if(name==="event"&&(a.backColor!=="rgb(255, 255, 255)"||a.iconColor!=="rgb(255, 255, 255)"))failed.push(label+" back-link contrast: "+a.backColor+" "+a.iconColor);
   }
   results.push({name,...a});records.push({width,name,...a});
   if(width===390||width===1024)await page.screenshot({path:"artifacts/member-viewport/"+name+"-"+width+".png",animations:"disabled"});
  }catch(e){failed.push(name+" @"+width+": "+String(e.message||e));}finally{await page.close();}
 }
 if(results.length===5){
  const frame=results[0].frame;
  for(const a of results)if(Math.abs(a.frame.x-frame.x)>1.1||Math.abs(a.frame.w-frame.w)>1.1)failed.push(a.name+" @"+width+": frame differs from home");
  const back=results.filter(a=>a.back),b=back[0].back;
  for(const a of back)if(Math.abs(a.back.x-b.x)>1.1||Math.abs(a.back.y-b.y)>1.1||Math.abs(a.back.w-b.w)>1.1)failed.push(a.name+" @"+width+": back button coords differ from event");
 }
 console.log("width="+width+" layouts="+results.length+" frameWidths="+results.map(a=>a.frame?.w.toFixed(0))+" backYs="+results.filter(a=>a.back).map(a=>a.name+":"+a.back.y.toFixed(0)).join(","));
 await context.close();
}
await browser.close();
await writeFile("artifacts/member-viewport/geometry.json",JSON.stringify({origin,failed,records},null,2));
console.log("Checked "+records.length+" layouts; errors "+failed.length);
for(const f of failed)console.error("FAIL: "+f);
if(failed.length)process.exitCode=1;
