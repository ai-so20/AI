export const dynamic = "force-dynamic";
export async function GET() {
 const headers = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, s-maxage=60, stale-while-revalidate=60"};
 const blank = (name, source) => ({name, value:null, change:null, history:[], asOf:null, source, status:"unavailable"});
 const items=[blank("코스피","KRX"),blank("코스닥","KRX"),blank("비트코인","Upbit")];
 try {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),7000);
  try {
   const [tr,cr]=await Promise.all([
    fetch("https://api.upbit.com/v1/ticker?markets=KRW-BTC",{signal:controller.signal,cache:"no-store"}),
    fetch("https://api.upbit.com/v1/candles/days?market=KRW-BTC&count=30",{signal:controller.signal,cache:"no-store"})
   ]);
   if(!tr.ok||!cr.ok)throw Error("Quote provider unavailable");
   const tick=(await tr.json())[0],candles=await cr.json();
   if(!Number.isFinite(tick?.trade_price)||!Array.isArray(candles))throw Error("Invalid quote data");
   items[2]={name:"비트코인",value:tick.trade_price,change:tick.signed_change_rate*100,history:candles.slice().reverse().map(c=>c.trade_price).filter(Number.isFinite),asOf:new Date(tick.timestamp||Date.now()).toISOString(),source:"Upbit KRW-BTC",status:"ok"};
  }finally{clearTimeout(timeout)}
 }catch(e){/* Never synthesize quotes on errors. */}
 return new Response(JSON.stringify({items,notice:"KOSPI/KOSDAQ public display requires an authorized data source; no fabricated values are shown."}),{headers});
}