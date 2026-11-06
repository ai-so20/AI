// Read-only presentation adapter for the separate AI Supabase session schema.
// Uses stored ai_process_sessions/ai_process_logs values, not a projected 26 profit curve.
// No writes, market ticks, or RPC side effects.
const SYMBOLS = ["BTC/USD","ETH/USD","SOL/USD","XRP/USD","AAPL","NVDA","MSFT","TSLA"];
const roundAmount = v => Math.round(Number(v || 0));
const timeMs = value => { const n = value ? new Date(value).getTime() : NaN; return Number.isFinite(n) ? n : NaN; };
function durationText(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000),h = Math.floor(s / 3600),m = Math.floor(s % 3600 / 60),sec = s % 60;
  return [h,m,sec].map(n => String(n).padStart(2,"0")).join(":");
}
function chartModel(values) {
  if (values.length < 2) return "";
  const nums=values.slice(-48).map(v=>Number(v)).filter(Number.isFinite);
  if (nums.length < 2) return "";
  const min=Math.min(...nums), max=Math.max(...nums), spread=Math.max(1,max-min);
  return nums.map((v,i)=>`${(18+724*i/(nums.length-1)).toFixed(1)},${(190-145*(v-min)/spread).toFixed(1)}`).join(" ");
}
export function buildStoredSessionSnapshot(session, logs = [], now = Date.now()) {
  if (!session) return null;
  const investment=Math.max(0,Number(session.start_amount||0));
  const totalAmount=Number(session.current_amount ?? session.start_amount ?? 0);
  const earnedProfit=totalAmount-investment;
  const currentReturn=investment>0?100*earnedProfit/investment:0;
  const startedMs=timeMs(session.started_at);
  const finishedMs=timeMs(session.completed_at);
  const endedMs=timeMs(session.ends_at);
  const isRunning=session.status==="running";
  const isFinished=["stopped","completed"].includes(session.status);
  const endMs=isFinished&&Number.isFinite(finishedMs)?finishedMs:now;
  const durationMs=Math.max(1,Number(session.duration_hours||24))*3600000;
  const elapsedMs=Number.isFinite(startedMs)?Math.max(0,endMs-startedMs):0;
  const remainingMs=isRunning&&Number.isFinite(endedMs)?Math.max(0,endedMs-now):0;
  const progress=isFinished?100:Math.min(100,100*elapsedMs/durationMs);
  const datedLogs=(Array.isArray(logs)?logs:[]).filter(row=>Number.isFinite(timeMs(row.market_at))).slice().sort((a,b)=>timeMs(a.market_at)-timeMs(b.market_at));
  const history=[];
  if(Number.isFinite(startedMs))history.push({step:0,amount:investment,delta:0,at:session.started_at,stage:"시작"});
  datedLogs.forEach((row,i)=>history.push({step:i+1,amount:Number(row.amount_after??0),delta:Number(row.delta??0),at:row.market_at,stage:row.asset_name||row.asset_symbol||"AI 반영",symbol:row.asset_symbol,resultType:row.result_type}));
  const values=history.slice(-48).map(x=>x.amount);
  const lastTick=timeMs(session.last_tick_at||session.last_market_at);
  const nextMs=isRunning&&Number.isFinite(lastTick)?Math.max(0,lastTick+180000-now):NaN;
  const totalSteps=Math.max(0,Number(session.snapshot_tick_count||0));
  return {
    investment,totalAmount,earnedProfit,currentReturn,progress,
    elapsedSteps:totalSteps||datedLogs.length,
    averagePerStep:totalSteps>0?earnedProfit/totalSteps:datedLogs.length?earnedProfit/datedLogs.length:0,
    remainingText:isRunning?Number.isFinite(endedMs)?durationText(remainingMs):"종료 예정 시간 미설정":isFinished?"종료":"대기",
    nextText:Number.isFinite(nextMs)?durationText(nextMs):"서버 반영 확인 중",
    chartPoints:chartModel(values),
    history,startedAt:session.started_at,
  };
}
export function buildStoredMarketStates(logs=[]) {
  const newest=new Map();
  for(const row of logs) {
    const symbol=String(row.asset_symbol||"");
    if(!SYMBOLS.includes(symbol))continue;
    if(!newest.has(symbol)||timeMs(row.market_at)>timeMs(newest.get(symbol).market_at))newest.set(symbol,row);
  }
  return SYMBOLS.map(symbol=>{
    const row=newest.get(symbol);
    const pct=Number(row?.market_pct||0),delta=Number(row?.delta||0);
    return {
      symbol,
      phase:row?"record":"unavailable",
      label:row?"반영 기록":"기록 없음",
      action:row?`최근 반영 ${delta>=0?"+":""}${roundAmount(delta).toLocaleString("ko-KR")}원`:"해당 자산 반영 내역 없음",
      direction:row?{tone:pct<0?"down":pct>0?"up":"flat",label:pct<0?"하락 기록":pct>0?"상승 기록":"변동 없음"}:{tone:"flat",label:"—"}
    };
  });
}
export function buildStoredMarketHistory(logs=[]) {
  return [...logs].sort((a,b)=>timeMs(b.market_at)-timeMs(a.market_at)).slice(0,100).map((row,i)=>{
    const delta=Number(row.delta||0);
    return {
      id:row.id||`log-${i}`,
      name:row.asset_name||row.asset_symbol||"AI 반영",
      at:row.market_at,
      previousLabel:"시장 반영",
      label:delta>=0?"수익 반영":"손실 반영",
      action:`${delta>=0?"+":""}${roundAmount(delta).toLocaleString("ko-KR")}원`,
      direction:{tone:delta<0?"down":"up",label:delta>=0?"상승":"하락"}
    };
  });
}
