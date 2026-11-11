import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
const origin=process.env.BASE_URL||"http://127.0.0.1:3100";
const widths=[320,375,390,430,768,1024,1280,1440];
const failed=[],results=[];
await mkdir("artifacts/app-home-preview",{recursive:true});
const browser=await chromium.launch({headless:true});
for(const width of widths){
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,colorScheme:"light"});
 const page=await context.newPage();
 try{
  const response=await page.goto(origin+"/app-home-preview",{waitUntil:"domcontentloaded",timeout:45000});
  if(!response||response.status()>=400)throw new Error("HTTP "+response?.status());
  await page.getByRole("heading",{name:"총 평가금액"}).waitFor();
  const info=await page.evaluate(()=>{
   const f=selector=>{const e=document.querySelector(selector);if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,w:b.width,y:b.y,h:b.height}};
   const nav=[...document.querySelectorAll('nav')].filter(n=>n.getClientRects().length>0);
   const main=document.querySelector("main");
   const quick=document.querySelector('[aria-label="바로가기"]');
   const market=document.querySelector('[aria-labelledby="app-market-title"]');
   const chart=document.querySelector('svg[role="img"]');
   return {scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,
     navCount:nav.length,navButtons:nav[0]?.querySelectorAll("button").length,
     mainDisplay:main?getComputedStyle(main).display:null,
     quick:quick?quick.getBoundingClientRect().width:null,
     market:market?market.getBoundingClientRect().width:null,
     chart:chart?chart.getBoundingClientRect().width:null};
  });
  if(info.scrollWidth>width+1)failed.push(width+": horizontal overflow "+info.scrollWidth);
  if(info.navCount!==1||info.navButtons!==5)failed.push(width+": navigation mismatch "+info.navCount+"/"+info.navButtons);
  if(width>=1024&&info.mainDisplay!=="grid")failed.push(width+": PC layout not grid");
  if(width<1024&&info.mainDisplay==="grid")failed.push(width+": mobile forced into desktop layout");
  if(!info.quick||!info.market||!info.chart)failed.push(width+": key home UI missing");
  const runningImg=[390,1280].includes(width);
  if(runningImg)await page.screenshot({path:"artifacts/app-home-preview/home-"+width+"-running.png",fullPage:true,animations:"disabled"});
  await page.getByRole("button",{name:"1주"}).click();
  const changed=await page.getByRole("button",{name:"1주"}).getAttribute("aria-pressed");
  if(changed!=="true")failed.push(width+": chart period interaction failed");
  await page.getByRole("button",{name:"진행 전"}).click();
  await page.getByRole("heading",{name:/아직 진행 중인/}).waitFor();
  const readyScroll=await page.evaluate(()=>document.documentElement.scrollWidth);
  if(readyScroll>width+1)failed.push(width+": ready horizontal overflow "+readyScroll);
  if(runningImg)await page.screenshot({path:"artifacts/app-home-preview/home-"+width+"-ready.png",fullPage:true,animations:"disabled"});
  results.push({width,...info,readyScroll});
  console.log("app-home "+width+"px nav="+info.navButtons+" overflow="+Math.max(0,info.scrollWidth-width)+" ready="+Math.max(0,readyScroll-width));
 }catch(e){failed.push(width+": "+String(e.message||e))}
 finally{await context.close()}
}
await browser.close();
await writeFile("artifacts/app-home-preview/results.json",JSON.stringify({results,failed},null,2));
console.log("App home preview: "+results.length+" viewports, failures="+failed.length);
for(const error of failed)console.error("FAIL: "+error);
if(failed.length)process.exitCode=1;
