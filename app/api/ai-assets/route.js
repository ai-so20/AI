export const dynamic = "force-dynamic";
const ASSETS=[{symbol:"BTC/USD",name:"비트코인",type:"coin"},{symbol:"ETH/USD",name:"이더리움",type:"coin"},{symbol:"SOL/USD",name:"솔라나",type:"coin"},{symbol:"XRP/USD",name:"XRP",type:"coin"},{symbol:"AAPL",name:"애플",type:"stock"},{symbol:"NVDA",name:"엔비디아",type:"stock"},{symbol:"MSFT",name:"마이크로소프트",type:"stock"},{symbol:"TSLA",name:"테슬라",type:"stock"}];
export async function GET(){const headers={"Cache-Control":"public, s-maxage=60, stale-while-revalidate=60"};
  // Isolated AI read-only quote fetch. NEVER call other projects or the local engine,
  // modify Supabase caches, or fabricate an unavailable market price.
  const yahooSymbols={"BTC/USD":"BTC-USD","ETH/USD":"ETH-USD","SOL/USD":"SOL-USD","XRP/USD":"XRP-USD"};
  const requests=ASSETS.map(async asset=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),5500);
    try{
      const symbol=yahooSymbols[asset.symbol]||asset.symbol;
      const url="https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(symbol)+"?interval=1m&range=2d";
      const response=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0",Accept:"application/json"}});
      if(!response.ok)return null;
      const data=await response.json();
      const result=data?.chart?.result?.[0];
      const close=result?.indicators?.quote?.[0]?.close;
      const times=result?.timestamp;
      let price=null,at=null;
      if(Array.isArray(close)&&Array.isArray(times)){
        for(let i=Math.min(close.length,times.length)-1;i>=0;i--){
          const candidate=Number(close[i]),stamp=Number(times[i]);
          if(Number.isFinite(candidate)&&candidate>0&&Number.isFinite(stamp)&&stamp>0){price=candidate;at=stamp;break}
        }
      }
      if(price===null){
        const candidate=Number(result?.meta?.regularMarketPrice);
        if(Number.isFinite(candidate)&&candidate>0)price=candidate;
        at=Number(result?.meta?.regularMarketTime)||null;
      }
      return price===null?null:{symbol:asset.symbol,price,at};
    }catch{return null}finally{clearTimeout(timer)}
  });
  const responses=await Promise.all(requests);
  const available=responses.filter(Boolean);
  if(available.length){
    const priceBySymbol=new Map(available.map(q=>[q.symbol,q.price]));
    const latestAt=Math.max(0,...available.map(q=>q.at||0));
    return Response.json({
      success:true,stale:true,
      updatedAt:latestAt?new Date(latestAt*1000).toISOString():null,
      assets:ASSETS.map(a=>({...a,price:priceBySymbol.get(a.symbol)??null})),
      source:"Yahoo Finance chart (read only)",
      availableCount:available.length
    },{headers});
  }
  return Response.json({success:false,assets:ASSETS.map(a=>({...a,price:null})),updatedAt:null,stale:true,error:"시장가격 제공처 연결 대기 중"},{status:503,headers});
}
