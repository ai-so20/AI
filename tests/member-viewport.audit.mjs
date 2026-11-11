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
      market:box(".ai-assets-panel"),quick:box(".body > .quick"),how:box(".body > .how"),overview:box(".page > main > .overview"),calendar:box(".page > main > .card:not(.overview):not(.info)"),eventGuide:box(".event-body > .event-guide"),eventHeading:box(".event-body > .section-heading"),aiHero:box(".ai-body > .ai-hero"),aiHelp:box(".ai-body > .ai-how-disclosure"),aiSurprise:box(".ai-body > .ai-surprise-panel"),rewardSummary:box(".shell > main > .summary"),rewardInbox:box(".shell > main > .inbox"),scrollWidth:document.documentElement.scrollWidth};
   });
   const label=name+" @"+width;
   if(!a.frame||!a.nav)failed.push(label+" frame or nav missing");
   else {
    if(a.navCount!==5||a.activeCount!==1)failed.push(label+" nav links/active "+a.navCount+"/"+a.activeCount);
    if(width<1024) {
      if(Math.abs(a.nav.x-a.frame.x)>1.1||Math.abs(a.nav.w-a.frame.w)>1.1)failed.push(label+" mobile/tablet nav and frame do not align");
      if(Math.abs(a.nav.bottom-900)>1.1)failed.push(label+" bottom navigation displaced");
    }else {
      if(a.nav.x+a.nav.w>a.frame.x-6)failed.push(label+" desktop nav overlaps content");
      if(Math.abs(a.nav.y-24)>1.1)failed.push(label+" desktop navigation not at top");
      if(a.nav.w>220)failed.push(label+" desktop rail is too wide");
    }
    if(a.scrollWidth>width+1)failed.push(label+" horizontal overflow: "+a.scrollWidth);
    if(name==="home"&&width>=768&&a.market&&a.market.w<a.frame.w*0.75)failed.push(label+" desktop market width: "+a.market.w+" vs frame "+a.frame.w);
    if(width>=1024){
      if(name==="home"&&a.quick&&a.how&&a.quick.x<a.how.x+a.how.w-2)failed.push(label+" home summary and quick cards aren't separate columns");
      if(name==="event"&&a.eventGuide&&a.eventHeading&&a.eventGuide.x>=a.eventHeading.x)failed.push(label+" event guide and list aren't side by side");
      if(name==="attendance"&&a.overview&&a.calendar&&a.overview.x>=a.calendar.x)failed.push(label+" attendance overview and calendar aren't side by side");
      if(name==="reward"&&a.rewardSummary&&a.rewardInbox&&a.rewardSummary.x>=a.rewardInbox.x)failed.push(label+" reward sidebar and messages aren't side by side");
      if(name==="ai-process"&&a.aiHero&&a.aiSurprise&&a.aiHero.x>=a.aiSurprise.x)failed.push(label+" AI preview and special benefit aren't side by side");
    }
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
