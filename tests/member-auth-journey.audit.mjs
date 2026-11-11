import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
// Entirely synthetic account and mock API: no live credentials, no production writes.
const origin=process.env.BASE_URL||"http://127.0.0.1:3100",uid="00000000-0000-4000-8000-000000000123";
const now=Date.now(),past=new Date(now-3600000).toISOString(),future=new Date(now+24*3600000).toISOString();
const user={id:uid,role:"authenticated",aud:"authenticated",email:"qa-only@example.invalid",created_at:past,app_metadata:{provider:"email",providers:["email"]},user_metadata:{},identities:[]};
const profile={id:uid,nickname:"검수회원",role:"member",approval_status:"approved"};
const process={id:"process-qa",user_id:uid,status:"running",start_amount:1000000,current_amount:1050000,duration_hours:24,started_at:past,ends_at:future,last_tick_at:new Date(now-120000).toISOString(),snapshot_tick_count:2};
const logs=[{id:"log-qa",process_id:"process-qa",user_id:uid,market_at:new Date(now-200000).toISOString(),asset_symbol:"BTC/USD",asset_name:"비트코인",asset_type:"coin",market_pct:2,amount_before:1000000,delta:50000,amount_after:1050000,result_type:"profit"}];
const b64=obj=>Buffer.from(JSON.stringify(obj)).toString("base64url");
const jwt=[b64({alg:"HS256",typ:"JWT"}),b64({sub:uid,aud:"authenticated",role:"authenticated",iat:Math.floor(now/1000)-30,exp:Math.floor(now/1000)+3600,session_id:"session-qa"}),"fixture"].join(".");
const stored={access_token:jwt,refresh_token:"fixture-refresh",expires_at:Math.floor(now/1000)+3600,expires_in:3600,token_type:"bearer",user};
const events=[{event_id:"event-qa",event_type:"first_come",title:"검수 이벤트",prize:"검수용 기프티콘",description:"모의 자료",round_number:1,status:"active",participated:false,starts_at:past,ends_at:future}];
const ok=(route,value)=>route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*","content-range":"0-0/1"},body:JSON.stringify(value)});
const browser=await chromium.launch({headless:true}),failures=[],results=[];
await mkdir("artifacts/member-auth-journey",{recursive:true});
for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:900}});
 await context.addInitScript(s=>{localStorage.removeItem("vip-ui-locked");localStorage.setItem("sb-example-auth-token",JSON.stringify(s))},stored);
 const calls=[];
 await context.route("https://example.supabase.co/**",async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  calls.push({method:req.method(),path});
  if(req.method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"GET,POST"}});
  if(path==="/auth/v1/user")return ok(route,user);
  if(path==="/auth/v1/token")return ok(route,{...stored,user});
  if(path==="/rest/v1/profiles")return ok(route,profile);
  if(path==="/rest/v1/ai_process_sessions")return ok(route,[process]);
  if(path==="/rest/v1/ai_process_logs")return ok(route,logs);
  if(["/rest/v1/event_winners","/rest/v1/group_messages","/rest/v1/private_messages"].includes(path))return ok(route,[]);
  if(path==="/rest/v1/rpc/get_auto_events")return ok(route,events);
  if(path==="/rest/v1/rpc/get_daily_attendance_status")return ok(route,{checked_today:false,total_count:3,reward_ready:false,next_reward_at:30,pending_rewards:0});
  if(path==="/rest/v1/rpc/get_monthly_attendance_calendar"){
   const args=JSON.parse(req.postData()||"{}");return ok(route,{month:String(args.p_month||"").slice(0,7),checked_days:[1,3]});
  }
  if(path==="/rest/v1/rpc/get_my_event_rewards")return ok(route,[{id:"reward-1",reward_name:"검수용 상품",status:"pending",created_at:past,event_id:"event-qa"}]);
  if(path==="/rest/v1/rpc/get_my_private_unread_count")return ok(route,0);
  if(path==="/rest/v1/rpc/get_or_create_admin_chat")return ok(route,"chat-qa-id");
  if(path==="/rest/v1/rpc/mark_private_chat_read")return ok(route,true);
  failures.push(width+": unmocked external request "+req.method()+" "+path);
  return route.fulfill({status:400,contentType:"application/json",body:JSON.stringify({message:"Unexpected request in fixture"})});
 });
 await context.route("**/api/ai-assets",r=>ok(r,{success:true,updatedAt:new Date().toISOString(),assets:[{symbol:"BTC/USD",price:90000},{symbol:"AAPL",price:250}]}));
 const page=await context.newPage();
 page.on("pageerror",err=>failures.push(width+": browser error "+err.message));
 const check=async(name,fn)=>{try{await fn();results.push({width,name,ok:true});console.log("PASS",width,name)}catch(e){failures.push(width+": "+name+": "+String(e.message||e));results.push({width,name,ok:false});console.error("FAIL",width,name,String(e.message||e).slice(0,220))}};
 await check("approved saved session redirects into home",async()=>{
  await page.goto(origin+"/design-entry",{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForURL("**/design-home",{timeout:15000});
  await page.getByText("1,050,000",{exact:false}).first().waitFor({timeout:12000});
 });
 const routes=[
  ["/design-event","검수 이벤트"],
  ["/design-attendance","나의 누적 출석"],
  ["/design-ai-process","나의 진행 상태"],
  ["/design-reward","상품 지급 처리 현황"],
  ["/design-home","1,050,000"]
 ];
 for(const [path,text] of routes){
  await check("navigation "+path,async()=>{
   await page.locator('.member-app-nav a[href="'+path+'"]').click();
   await page.waitForURL("**"+path,{timeout:15000});
   await page.getByText(text,{exact:false}).first().waitFor({timeout:15000});
   assert.equal(await page.locator('.member-app-nav a[aria-current="page"]').count(),1);
   await page.screenshot({path:"artifacts/member-auth-journey/"+width+"-"+path.slice(8)+".png",animations:"disabled"});
  });
 }
 await check("attendance mock count and button",async()=>{
  await page.goto(origin+"/design-attendance",{waitUntil:"domcontentloaded"});
  await page.locator(".total").getByText("3",{exact:false}).first().waitFor({timeout:15000});
  const btn=page.getByRole("button",{name:"오늘 출석하기"});
  await btn.waitFor({state:"visible",timeout:15000});assert(await btn.isEnabled());
 });
 await check("AI mock running state",async()=>{
  await page.goto(origin+"/design-ai-process",{waitUntil:"domcontentloaded"});
  await page.locator(".ai-state-current").getByText("진행 중").waitFor({timeout:15000});
 });
 const forbidden=calls.filter(c=>!["GET","HEAD","OPTIONS"].includes(c.method)&&!c.path.includes("/rpc/get_")&&!["/rest/v1/rpc/mark_private_chat_read","/rest/v1/rpc/get_or_create_admin_chat"].includes(c.path));
 if(forbidden.length)failures.push(width+": unexpected writes "+JSON.stringify(forbidden));
 await page.close();await context.close();
}
await browser.close();
await writeFile("artifacts/member-auth-journey/report.json",JSON.stringify({mode:"isolated mock account / no live database",results,failures},null,2));
console.log("Mocked authenticated navigation checks="+results.length+" failures="+failures.length);
if(failures.length){for(const f of failures)console.error("FAIL",f);process.exitCode=1}
