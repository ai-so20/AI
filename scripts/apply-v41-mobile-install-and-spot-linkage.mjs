import fs from 'node:fs';

function replaceOrFail(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`anchor not found: ${label}`);
  return text.replace(search, replacement);
}

// 1) Mobile-only install UI + iPhone/Android guide
const pagePath = 'app/page.js';
let page = fs.readFileSync(pagePath, 'utf8');

page = replaceOrFail(page,
`  function isIOSDevice() {\n    if (typeof navigator === \"undefined\") return false;\n    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||\n      (navigator.platform === \"MacIntel\" && navigator.maxTouchPoints > 1);\n  }`,
`  function isIOSDevice() {\n    if (typeof navigator === \"undefined\") return false;\n    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||\n      (navigator.platform === \"MacIntel\" && navigator.maxTouchPoints > 1);\n  }\n\n  function isAndroidDevice() {\n    if (typeof navigator === \"undefined\") return false;\n    return /android/i.test(navigator.userAgent);\n  }`,
'isAndroidDevice');

page = replaceOrFail(page,
`          {profile?.role !== \"admin\" && !isStandaloneApp && !installDismissed && (`,
`          {profile?.role !== \"admin\" && !isStandaloneApp && !installDismissed && (isIOSDevice() || isAndroidDevice()) && (`,
'mobile-only install banner');

page = replaceOrFail(page,
`<b style={{display:\"block\",fontSize:\"12px\",color:\"#3d2c22\"}}>AI PROCESS VIP 앱으로 더 편하게 이용하세요</b><span style={{display:\"block\",marginTop:\"2px\",fontSize:\"10px\",color:\"#8b735e\"}}>바탕화면에 설치하면 VIP 라운지를 바로 열 수 있습니다.</span>`,
`<b style={{display:\"block\",fontSize:\"12px\",color:\"#3d2c22\"}}>AI PROCESS VIP 홈화면에 추가하기</b><span style={{display:\"block\",marginTop:\"2px\",fontSize:\"10px\",color:\"#8b735e\"}}>홈화면에서 VIP 라운지를 바로 열 수 있습니다.</span>`,
'install banner copy');

page = replaceOrFail(page,
`>앱 설치</button>`,
`>홈화면에 추가하기</button>`,
'install button label');

page = replaceOrFail(page,
`                    <p style={styles.installGuideText}>\n                      자동 설치창을 사용할 수 없는 브라우저입니다.\n                      <br />브라우저 메뉴의 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택해주세요.\n                    </p>\n                    <button type=\"button\" onClick={() => setShowInstallGuide(false)} style={styles.installGuideOk}>확인</button>`,
`                    <p style={styles.installGuideText}>\n                      안드로이드 홈화면에 추가하기\n                    </p>\n                    <div style={styles.installGuideSteps}>\n                      <div><b>1</b><span>브라우저 오른쪽 위 <strong>⋮ 메뉴</strong> 누르기</span></div>\n                      <div><b>2</b><span><strong>홈 화면에 추가</strong> 선택</span></div>\n                      <div><b>3</b><span><strong>추가</strong> 누르기</span></div>\n                      <div><b>4</b><span>홈 화면의 <strong>AI PROCESS VIP</strong> 아이콘 실행</span></div>\n                    </div>\n                    <button type=\"button\" onClick={() => setShowInstallGuide(false)} style={styles.installGuideOk}>확인</button>`,
'android install guide');

fs.writeFileSync(pagePath, page);

// 2) Expand spot-linked market candidate pool
const routePath = 'app/api/market-sim/route.js';
let route = fs.readFileSync(routePath, 'utf8');
const oldAssets = `const ASSETS = [\n  { symbol: \"AAPL\", yahoo: \"AAPL\", name: \"Apple\", type: \"stock\" },\n  { symbol: \"NVDA\", yahoo: \"NVDA\", name: \"NVIDIA\", type: \"stock\" },\n  { symbol: \"MSFT\", yahoo: \"MSFT\", name: \"Microsoft\", type: \"stock\" },\n  { symbol: \"TSLA\", yahoo: \"TSLA\", name: \"Tesla\", type: \"stock\" },\n  { symbol: \"BTC/USD\", yahoo: \"BTC-USD\", name: \"Bitcoin\", type: \"crypto\" },\n  { symbol: \"ETH/USD\", yahoo: \"ETH-USD\", name: \"Ethereum\", type: \"crypto\" },\n  { symbol: \"SOL/USD\", yahoo: \"SOL-USD\", name: \"Solana\", type: \"crypto\" },\n  { symbol: \"XRP/USD\", yahoo: \"XRP-USD\", name: \"XRP\", type: \"crypto\" },\n];`;
const newAssets = `const ASSETS = [\n  { symbol: \"AAPL\", yahoo: \"AAPL\", name: \"Apple\", type: \"stock\" },\n  { symbol: \"NVDA\", yahoo: \"NVDA\", name: \"NVIDIA\", type: \"stock\" },\n  { symbol: \"MSFT\", yahoo: \"MSFT\", name: \"Microsoft\", type: \"stock\" },\n  { symbol: \"TSLA\", yahoo: \"TSLA\", name: \"Tesla\", type: \"stock\" },\n  { symbol: \"AMZN\", yahoo: \"AMZN\", name: \"Amazon\", type: \"stock\" },\n  { symbol: \"META\", yahoo: \"META\", name: \"Meta\", type: \"stock\" },\n  { symbol: \"GOOGL\", yahoo: \"GOOGL\", name: \"Alphabet\", type: \"stock\" },\n  { symbol: \"AMD\", yahoo: \"AMD\", name: \"AMD\", type: \"stock\" },\n  { symbol: \"NFLX\", yahoo: \"NFLX\", name: \"Netflix\", type: \"stock\" },\n  { symbol: \"AVGO\", yahoo: \"AVGO\", name: \"Broadcom\", type: \"stock\" },\n  { symbol: \"PLTR\", yahoo: \"PLTR\", name: \"Palantir\", type: \"stock\" },\n  { symbol: \"COIN\", yahoo: \"COIN\", name: \"Coinbase\", type: \"stock\" },\n  { symbol: \"BTC/USD\", yahoo: \"BTC-USD\", name: \"Bitcoin\", type: \"crypto\" },\n  { symbol: \"ETH/USD\", yahoo: \"ETH-USD\", name: \"Ethereum\", type: \"crypto\" },\n  { symbol: \"SOL/USD\", yahoo: \"SOL-USD\", name: \"Solana\", type: \"crypto\" },\n  { symbol: \"XRP/USD\", yahoo: \"XRP-USD\", name: \"XRP\", type: \"crypto\" },\n  { symbol: \"BNB/USD\", yahoo: \"BNB-USD\", name: \"BNB\", type: \"crypto\" },\n  { symbol: \"ADA/USD\", yahoo: \"ADA-USD\", name: \"Cardano\", type: \"crypto\" },\n  { symbol: \"DOGE/USD\", yahoo: \"DOGE-USD\", name: \"Dogecoin\", type: \"crypto\" },\n  { symbol: \"LINK/USD\", yahoo: \"LINK-USD\", name: \"Chainlink\", type: \"crypto\" },\n];`;
route = replaceOrFail(route, oldAssets, newAssets, 'market asset pool');
fs.writeFileSync(routePath, route);

// 3) Persist DB migration source in repo
fs.mkdirSync('supabase/migrations', { recursive: true });
fs.writeFileSync('supabase/migrations/20261008_v41_spot_direction_linkage.sql', `create or replace function public.run_ai_process_market_tick(tick_at timestamptz, market_at timestamptz, market_quotes jsonb)\nreturns integer\nlanguage plpgsql\nsecurity definer\nset search_path='public'\nas $$\ndeclare\n  s public.ai_process_sessions%rowtype;\n  cfg public.app_payout_settings%rowtype;\n  v_symbol text; v_name text; v_type text; v_market_pct numeric;\n  v_before numeric; v_rate numeric; v_delta numeric; v_after numeric; v_result text;\n  v_wants_profit boolean; v_processed integer := 0; v_outcome_index integer; v_offset integer; v_slot integer;\n  v_hash numeric; v_profit_min numeric; v_profit_max numeric; v_loss_min numeric; v_loss_max numeric;\nbegin\n  if market_quotes is null or jsonb_typeof(market_quotes) <> 'array' then return 0; end if;\n  select * into cfg from public.app_payout_settings where id=1;\n  v_profit_min := coalesce(cfg.profit_min_rate,0.0035);\n  v_profit_max := greatest(v_profit_min,coalesce(cfg.profit_max_rate,0.0105));\n  v_loss_min := coalesce(cfg.loss_min_rate,0.0004);\n  v_loss_max := greatest(v_loss_min,coalesce(cfg.loss_max_rate,0.0030));\n  for s in select * from public.ai_process_sessions where status='running' for update skip locked loop\n    if s.ends_at is not null and tick_at >= s.ends_at then\n      update public.ai_process_sessions set status='completed',completed_at=tick_at,updated_at=now() where id=s.id; continue;\n    end if;\n    if s.last_market_snapshot_at is not distinct from market_at then\n      if s.last_tick_at is null or tick_at>s.last_tick_at then update public.ai_process_sessions set last_tick_at=tick_at,updated_at=now() where id=s.id; end if;\n      continue;\n    end if;\n    select count(*)::integer into v_outcome_index from public.ai_process_logs l where l.process_id=s.id and l.result_type in ('profit','loss');\n    v_offset := mod((('x'||substr(md5(s.id::text),1,8))::bit(32)::bigint),20)::integer; if v_offset<0 then v_offset:=v_offset+20; end if;\n    v_slot := mod(v_outcome_index+v_offset,20); v_wants_profit := v_slot not in (4,11,18);\n\n    -- Spot linkage: profit rounds must use a genuinely rising asset; loss rounds a falling asset.\n    select q.symbol,q.name,q.type,q.\"changePct\" into v_symbol,v_name,v_type,v_market_pct\n    from jsonb_to_recordset(market_quotes) as q(symbol text,name text,type text,price numeric,\"beforePrice\" numeric,\"changePct\" numeric)\n    where (v_wants_profit and coalesce(q.\"changePct\",0) > 0) or ((not v_wants_profit) and coalesce(q.\"changePct\",0) < 0)\n    order by abs(q.\"changePct\") desc limit 1;\n    -- Never show a misleading + against a falling market (or - against a rising market).\n    if v_symbol is null then continue; end if;\n\n    v_hash := ((('x'||substr(md5(s.id::text||':'||market_at::text||':rate'),1,8))::bit(32)::bigint)%1000000)::numeric/999999.0; if v_hash<0 then v_hash:=-v_hash; end if;\n    if v_wants_profit then v_rate:=v_profit_min+(v_profit_max-v_profit_min)*v_hash; v_result:='profit';\n    else v_rate:=v_loss_min+(v_loss_max-v_loss_min)*v_hash; v_result:='loss'; end if;\n    v_before:=s.current_amount; v_delta:=round(v_before*v_rate,2); if not v_wants_profit then v_delta:=-v_delta; end if; v_after:=greatest(0,v_before+v_delta);\n    update public.ai_process_sessions set current_amount=v_after,total_profit=v_after-start_amount,total_return=case when start_amount>0 then ((v_after-start_amount)/start_amount)*100 else 0 end,last_market_at=market_at,last_market_snapshot_at=market_at,last_tick_at=tick_at,snapshot_tick_count=1,last_asset_symbol=v_symbol,last_asset_name=v_name,last_asset_type=v_type,last_market_pct=v_market_pct,last_delta=v_delta,updated_at=now() where id=s.id;\n    insert into public.ai_process_logs(process_id,user_id,market_at,asset_symbol,asset_name,asset_type,market_pct,amount_before,delta,amount_after,result_type) values(s.id,s.user_id,market_at,v_symbol,v_name,v_type,v_market_pct,v_before,v_delta,v_after,v_result);\n    v_processed:=v_processed+1;\n  end loop;\n  return v_processed;\nend;\n$$;\n`);

console.log('V41 patch applied');
