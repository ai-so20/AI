"use client";
import {useState,useEffect} from "react";
import {useRouter} from "next/navigation";
import {isApprovedProfile,isDesignUiLocked,observeDesignUiLock} from "../lib/design-member-access";
import {supabase} from "../supabase";
import {buildStoredSessionSnapshot,buildStoredMarketStates,buildStoredMarketHistory} from "../lib/ai-process-session-view";

const menu=[["home","홈"],["event","이벤트"],["attendance","출석"],["ai","AI PROCESS"],["reward","상품 지급 센터"]];
const shortcuts=[["market","시장 분석","실시간 동향"],["attendance","출석 체크","매일 혜택"],["event","이벤트","다양한 혜택"],["reward","상품 지급","당첨·지급 확인"]];
const markets=[["코스피","2,748.56","+0.68%"],["코스닥","892.31","+1.29%"],["비트코인","161,320,000","+2.47%"]];
const paths={"1주":"M0 69 Q15 65 27 58 T55 56 T86 46 T115 42 T148 32 T178 34 T207 23 T240 19","1개월":"M0 75 Q20 70 32 63 T62 57 T92 60 T125 40 T155 44 T187 31 T215 26 T240 16","3개월":"M0 75 Q18 74 30 64 T60 60 T90 51 T120 54 T150 43 T180 38 T210 27 T240 13","6개월":"M0 78 Q20 76 35 69 T70 60 T105 61 T140 46 T175 41 T205 29 T240 16","전체":"M0 80 Q25 75 45 68 T85 59 T125 48 T165 39 T205 28 T240 12"};
const glyphs={home:<><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,event:<><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8C6 8 7 2 9 3c2 0 3 3 3 5Zm0 0c6 0 5-6 3-5-2 0-3 3-3 5Z"/></>,attendance:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-12 5 2 2 4-4"/></>,ai:<><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4"/><text x="8" y="15" stroke="none" fill="currentColor" fontSize="8">AI</text></>,reward:<><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8C6 8 7 2 9 3c2 0 3 3 3 5Zm0 0c6 0 5-6 3-5-2 0-3 3-3 5Z"/></>,market:<><path d="M3 20V14m6 6V10m6 10V6m6 14V2"/></>};
function Icon({name,size=23}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{glyphs[name]}</svg>}
function Market(){const [feed,setFeed]=useState(null),[error,setError]=useState(false);
const [member,setMember]=useState(null),[memberId,setMemberId]=useState(null),[marketLogs,setMarketLogs]=useState([]),[memberAccess,setMemberAccess]=useState("loading"),[marketTick,setMarketTick]=useState(0);
useEffect(()=>{let active=true;
 async function loadMember(){
  try{
   if(isDesignUiLocked()){if(active){setMember(null);setMemberId(null);setMarketLogs([]);setMemberAccess("locked")}return}
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(!active)return;
   if(!user){setMember(null);setMemberId(null);setMemberAccess("login");return}
   if(authError)throw authError;
   const {data:profile,error:profileError}=await supabase.from("profiles").select("approval_status,role").eq("id",user.id).maybeSingle();
   if(profileError)throw profileError;if(!active)return;
   if(!isApprovedProfile(profile)){setMember(null);setMemberAccess("unapproved");return}
   if(profile.role==="admin"){setMember(null);setMemberAccess("admin");return}
   const {data:rows,error:memberError}=await supabase.from("ai_process_sessions").select("*").eq("user_id",user.id).order("started_at",{ascending:false}).limit(50);
   if(!active)return;
   if(memberError){setMember(null);setMarketLogs([]);setMemberAccess("error");return}
   const found=(rows||[]).find(x=>x.status==="running")||(rows||[])[0]||null;
   const {data:logs,error:logError}=found?.id?await supabase.from("ai_process_logs").select("id,process_id,user_id,market_at,asset_symbol,asset_name,market_pct,delta,amount_after").eq("process_id",found.id).eq("user_id",user.id).order("market_at",{ascending:false}).limit(120):{data:[],error:null};
   if(!active)return;
   setMemberId(user.id);setMember(found);setMarketLogs(logError?[]:(logs||[]));setMemberAccess(found?(logError?"log-error":"connected"):"ready");
  }catch{if(active){setMember(null);setMemberAccess("error")}}
 }
 void loadMember();
 const membershipTimer=setInterval(()=>{void loadMember()},60000);
 const tickTimer=setInterval(()=>setMarketTick(v=>v+1),10000);
 return()=>{active=false;clearInterval(membershipTimer);clearInterval(tickTimer)};
},[]);
useEffect(()=>observeDesignUiLock(()=>{setMember(null);setMemberId(null);setMemberAccess("locked")}),[]);
void marketTick;
const activeProcess=!isDesignUiLocked()&&member&&["running","completed","stopped"].includes(member.status);
const snapshot=activeProcess?buildStoredSessionSnapshot(member,marketLogs):null;
const marketStates=snapshot?buildStoredMarketStates(marketLogs):[];
const marketHistory=snapshot?buildStoredMarketHistory(marketLogs):[];
const marketStateBySymbol=Object.fromEntries(marketStates.map(item=>[item.symbol,item]));
const marketCounts={recorded:marketStates.filter(item=>item.phase==="record").length,missing:marketStates.filter(item=>item.phase!=="record").length};
const memberStatusText=memberAccess==="unavailable"?"회원 상태 데이터 미연결":memberAccess==="error"?"회원 상태 조회 실패":memberAccess==="log-error"?"반영 기록 조회 실패":memberAccess==="login"?"로그인 후 AI 상태 확인":memberAccess==="locked"?"회원 입장 잠금 해제 필요":memberAccess==="unapproved"?"회원 승인 후 확인":memberAccess==="admin"?"회원 전용 상태":memberAccess==="ready"?"AI PROCESS 진행 전":memberAccess==="loading"?"회원 상태 확인 중":member?.status==="waiting"?"AI PROCESS 시작 준비":member?.status==="ready"?"AI PROCESS 진행 전":member?.status==="completed"?"AI PROCESS 진행 완료":member?.status==="stopped"?"AI PROCESS 진행 중단":"AI PROCESS 진행 중";
useEffect(()=>{let active=true;async function load(){try{const r=await fetch("/api/ai-assets",{cache:"no-store"});if(!r.ok)throw Error("feed");const data=await r.json();if(!data?.success||!Array.isArray(data.assets))throw Error("invalid feed");if(active){setFeed(data);setError(false)}}catch{if(active)setError(true)}}load();const t=setInterval(load,60000);return()=>{active=false;clearInterval(t)}},[]);const defaults=[["BTC/USD","비트코인","coin"],["ETH/USD","이더리움","coin"],["SOL/USD","솔라나","coin"],["XRP/USD","XRP","coin"],["AAPL","애플","stock"],["NVDA","엔비디아","stock"],["MSFT","마이크로소프트","stock"],["TSLA","테슬라","stock"]].map(([symbol,name,type])=>({symbol,name,type,price:null}));const items=feed?.assets||defaults;return <section className="panel ai-assets-panel"><div className="section-title"><b>AI 주식·코인 현황</b><span>AI DB 반영 기록</span></div><div className="ai-assets-info"><span>시장가격 <strong>{error?"연결 대기":feed?.stale?"최근 정상값":feed?"연결됨":"확인 중"}</strong></span><span>{feed?.updatedAt?"기준 "+new Date(feed.updatedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}):"업데이트 대기"}</span></div><div className="ai-assets-process"><span>AI PROCESS <strong>{memberStatusText}</strong></span>{snapshot&&<span>조회 로그 {marketLogs.length.toLocaleString("ko-KR")}건 · 최근 기록</span>}</div>{snapshot&&<div className="ai-assets-counts"><span>반영 기록 확인 {marketCounts.recorded}종</span><span>기록 없음 {marketCounts.missing}종</span></div>}<div className="ai-assets-list">{items.map(item=><div className="ai-assets-row" key={item.symbol}><span className={"ai-assets-mark "+item.type}>{item.type==="coin"?"₿":"ST"}</span><div className="ai-assets-name"><strong>{item.name}</strong><small>{item.symbol}</small></div><div className="ai-assets-price"><strong>{Number.isFinite(item.price)&&item.price>0?"$"+item.price.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:item.price<1?4:2}):"가격 대기"}</strong><small>{Number.isFinite(item.price)&&item.price>0?"시장가격":"데이터 미연결"}</small></div><div className="ai-assets-state"><span className={marketStateBySymbol[item.symbol]?.direction.tone==="down"?"ai-assets-down":marketStateBySymbol[item.symbol]?.direction.tone==="up"?"ai-assets-up":""}>{marketStateBySymbol[item.symbol]?.direction.label||"방향 확인 대기"}</span><strong>{marketStateBySymbol[item.symbol]?.label||"AI 상태 미연결"}</strong><small>{marketStateBySymbol[item.symbol]?.action||memberStatusText}</small></div></div>)}</div>{marketHistory.length>0&&<div className="ai-assets-history"><div className="ai-assets-history-title"><strong>최근 AI 상태 변화</strong><span>최근 {marketHistory.length}건 중 5건</span></div>{marketHistory.slice(0,5).map(row=><div className="ai-assets-history-row" key={row.id}><span>{row.name}<small>{row.at?new Date(row.at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}):"—"}</small></span><section><b>{row.previousLabel} → {row.label}</b><small>{row.action}</small></section></div>)}</div>}<p className="ai-assets-note">시장가격은 기존 26의 데이터 공급원을 조회합니다. 자산별 상태와 변화 내역은 AI DB에 저장된 최근 반영 기록이며 실제 주문·체결을 의미하지 않습니다.{error?" · 시장가격 공급원 연결 실패":""}</p><style jsx global>{`.stage .ai-assets-panel{padding:14px 13px;background:#fff;border:1px solid #e5edf7;border-radius:17px}.stage .ai-assets-panel .section-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:11px}.stage .ai-assets-panel .section-title span{font-size:10px;color:#71819a}.stage .ai-assets-info{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#72829b;background:#f4f8fd;padding:10px;border-radius:9px}.stage .ai-assets-info strong{color:#0c6de1}.stage .ai-assets-process{display:flex;flex-wrap:wrap;justify-content:space-between;gap:7px;margin-top:8px;padding:7px 4px;color:#637991;font-size:10px}.stage .ai-assets-process strong{color:#164f90}.stage .ai-assets-counts{display:flex;justify-content:space-between;gap:7px;padding:9px 8px;background:#edf5ff;border-radius:8px;color:#31577d;font-size:10px}.stage .ai-assets-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:11px}.stage .ai-assets-row{display:flex;flex-wrap:wrap;align-items:center;gap:7px;min-width:0;padding:11px 7px;background:#f9fbff;border:1px solid #e7edf6;border-radius:11px}.stage .ai-assets-mark{display:grid;place-items:center;flex-shrink:0;width:28px;height:28px;border-radius:8px;background:#e4f0ff;color:#0877ed;font-size:12px;font-weight:800}.stage .ai-assets-mark.stock{background:#eaf0fa;color:#46658e;font-size:10px}.stage .ai-assets-name{min-width:0;flex:1}.stage .ai-assets-name strong{display:block;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stage .ai-assets-name small{display:block;font-size:9px;color:#8493a7;margin-top:4px}.stage .ai-assets-price{text-align:right;min-width:0}.stage .ai-assets-price strong{display:block;font-size:10px;white-space:nowrap}.stage .ai-assets-price small{display:block;font-size:9px;color:#8a9aaf;margin-top:4px}.stage .ai-assets-state{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 7px;flex-basis:100%;border-top:1px solid #e9eff7;padding-top:7px;margin-top:3px}.stage .ai-assets-state>span{font-size:10px;font-weight:700;color:#536780}.stage .ai-assets-state .ai-assets-down{color:#58769c}.stage .ai-assets-state .ai-assets-up{color:#d44b70}.stage .ai-assets-state>strong{font-size:10px;color:#284966}.stage .ai-assets-state>small{flex-basis:100%;font-size:9px;color:#7f8fa4;line-height:1.55}.stage .ai-assets-history{margin-top:12px;padding:10px 11px;background:#f7faff;border:1px solid #e5edf7;border-radius:10px}.stage .ai-assets-history-title{display:flex;justify-content:space-between;align-items:center;gap:8px;padding-bottom:7px;border-bottom:1px solid #e5edf7}.stage .ai-assets-history-title strong{font-size:12px}.stage .ai-assets-history-title span{font-size:10px;color:#8090a6}.stage .ai-assets-history-row{display:flex;justify-content:space-between;gap:9px;padding:9px 0;border-bottom:1px solid #edf1f7}.stage .ai-assets-history-row:last-child{border-bottom:0}.stage .ai-assets-history-row>span{flex:0 0 35%;font-size:11px;font-weight:700}.stage .ai-assets-history-row section{flex:1;text-align:right;min-width:0}.stage .ai-assets-history-row b{display:block;font-size:10px;color:#385575}.stage .ai-assets-history-row small{display:block;font-size:9px;color:#8798ab;line-height:1.5;margin-top:3px}.stage .ai-assets-note{font-size:10px;color:#74859c;line-height:1.65;margin:12px 2px 0}@media(max-width:370px){.stage .ai-assets-list{grid-template-columns:1fr}}`}</style></section>}

export default function DesignHome(){
  const router=useRouter();
  const go=(key)=>{
    const destinations={ai:"/design-ai-process",event:"/design-event",attendance:"/design-attendance",reward:"/design-reward",market:"/design-ai-process"};
    if(key==="home")return;
    router.push(destinations[key]||"/design-home");
  };
  const [started,setStarted]=useState(false);
  const [period,setPeriod]=useState("3개월");
  const [slide,setSlide]=useState(0);
  const notices=[
    {label:"AI PROCESS",title:"데이터 분석부터 운용까지",body:"AI 운용 단계와 최근 반영 내역을 한눈에 확인하세요.",action:"운용 현황 확인",key:"ai"},
    {label:"DAILY CHECK-IN",title:"하루 한 번, 출석 현황 확인",body:"누적 출석과 회원 혜택을 출석 메뉴에서 확인하세요.",action:"출석 메뉴 보기",key:"attendance"},
    {label:"MEMBER EVENT",title:"놓치기 쉬운 회원 이벤트",body:"진행 중인 이벤트와 최근 결과를 확인할 수 있습니다.",action:"이벤트 확인",key:"event"}
  ];
  useEffect(()=>{const timer=setInterval(()=>setSlide(s=>(s+1)%3),10000);return()=>clearInterval(timer)},[]);
  return <div className="stage"><div className="phone">
    <header className="topbar">
      <div className="brand"><span>AI</span> PROCESS</div>
      <button className="service-link" onClick={()=>go("reward")}>상품 지급 센터</button>
    </header>
    <section className="welcome">
      <div className="kicker">MEMBER FINANCIAL HOME</div>
      <h1>{started?<>나의 자산 현황을<br/>확인하세요.</>:<>일상의 자산 관리,<br/>더 명확하게.</>}</h1>
      <p>{started?"아래 평가금액은 디자인 확인용 예시입니다. 실제 금액은 AI PROCESS에서 확인하세요.":"AI 운용 현황과 참여 혜택을 필요한 곳에서 바로 확인하세요."}</p>
    </section>
    <section className="account" aria-label="AI PROCESS 자산 상태">
      <div className="account-top"><b>AI PROCESS</b><span className="status">{started?"진행 중 · 시안":"시작 전"}</span></div>
      {started?<div>
        <div className="account-sublabel">총 평가금액 · 디자인 예시</div>
        <div className="account-amount">12,740,320<small>원</small></div>
        <p className="account-sublabel">투자금 10,000,000원</p>
        <div className="account-returns">
          <div><span>누적 손익</span><strong>+2,740,320<small>원</small></strong></div>
          <div><span>수익률</span><strong>+27.40%</strong></div>
        </div>
        <button className="account-cta" style={{marginTop:17,width:"100%"}} onClick={()=>go("ai")}>AI PROCESS 상세 확인 <span>›</span></button>
      </div>:<div className="account-content">
        <p className="account-lead">진행 상태와 운용 정보를<br/><strong>상세 화면에서 확인하세요.</strong></p>
        <button className="account-cta" onClick={()=>go("ai")}>상태 확인 <span>›</span></button>
      </div>}
    </section>
    <section className="section">
      <div className="section-heading"><h2>바로가기</h2></div>
      <div className="quick">
        {shortcuts.map(([key,title,sub])=><button key={key} onClick={()=>go(key)}>
          <span className="quick-icon"><Icon name={key==="market"?"market":key} size={22}/></span>
          <b>{title}</b><small>{sub}</small>
        </button>)}
      </div>
    </section>
    <section className="section">
      <div className="section-heading"><h2>AI 운용 과정</h2><button onClick={()=>go("ai")}>자세히 보기 ›</button></div>
      <ol className="flow-list">
        <li><span className="flow-num">01</span><div><b>시장 분석</b><small>주식·코인 데이터와 시장 흐름 확인</small></div><span className="flow-arrow">›</span></li>
        <li><span className="flow-num">02</span><div><b>전략 수립</b><small>AI 판단 기준과 운용 단계 확인</small></div><span className="flow-arrow">›</span></li>
        <li><span className="flow-num">03</span><div><b>운용 현황</b><small>반영 기록·손익·자산 상태를 한눈에</small></div><span className="flow-arrow">›</span></li>
      </ol>
    </section>
    <section className="notice" aria-label="회원 서비스 안내">
      <div className="notice-top"><span className="notice-label">{notices[slide].label}</span><span className="notice-index">0{slide+1} / 03</span></div>
      <strong>{notices[slide].title}</strong>
      <p>{notices[slide].body}</p>
      <div className="notice-bottom">
        <button className="notice-link" onClick={()=>go(notices[slide].key)}>{notices[slide].action} ›</button>
        <div className="notice-dots">{notices.map((x,i)=><button key={x.key} className={slide===i?"on":""} aria-label={String(i+1)+"번째 안내"} onClick={()=>setSlide(i)}/>)}</div>
      </div>
    </section>
    {started&&<section className="section trend">
      <div className="section-heading"><h2>자산 변동 추이 · 시안</h2><strong className="trend-summary">+27.40%</strong></div>
      <div className="periods">{Object.keys(paths).map(x=><button key={x} className={period===x?"chosen":""} onClick={()=>setPeriod(x)}>{x}</button>)}</div>
      <svg className="trend-svg" viewBox="0 0 240 90" preserveAspectRatio="none" role="img" aria-label={period+" 자산 변동 추이 디자인 예시"}>
        <path d={paths[period]} stroke="#2377c9" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
      <div className="trend-caption">디자인 예시 데이터 · 실제 기록은 상세 화면에서 확인</div>
    </section>}
    <div className="market-wrap"><Market/></div>
    <nav className="bottom-nav" aria-label="하단 메뉴">
      {menu.map(([key,label])=><button key={key} className={key==="home"?"selected":""} onClick={()=>go(key)} aria-current={key==="home"?"page":undefined}><Icon name={key} size={21}/><span>{label}</span></button>)}
    </nav>
    <style jsx>{`
*{box-sizing:border-box}
.stage{min-height:100vh;background:#e9eef4;color:#17283f;font-family:"Pretendard Variable","Pretendard","Apple SD Gothic Neo","Malgun Gothic",Arial,sans-serif;-webkit-font-smoothing:antialiased;padding:0 12px}
.phone{position:relative;max-width:460px;margin:auto;min-height:100vh;padding-bottom:calc(85px + env(safe-area-inset-bottom));background:#fff;box-shadow:0 0 48px #1f3a5912;overflow:hidden}
.topbar{height:70px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eef1f5}
.brand{font-size:20px;font-weight:850;letter-spacing:-1px;color:#12233e}.brand span{color:#1269d7}
.service-link{border:0;background:none;font-size:11px;font-weight:700;color:#53667c;display:flex;align-items:center;gap:7px;cursor:pointer}
.service-link:after{content:"›";color:#7e8da0;font-size:20px;font-weight:400;line-height:1}
.welcome{padding:29px 25px 20px}
.kicker{font-size:10px;font-weight:800;color:#2968a9;letter-spacing:1.2px}
.welcome h1{font-size:28px;line-height:1.4;letter-spacing:-1.4px;font-weight:780;margin:12px 0 11px;color:#1b2b40}
.welcome p{font-size:12px;line-height:1.85;color:#64748a;margin:0}
.account{position:relative;margin:5px 22px 0;border-top:2px solid #183e70;border-bottom:1px solid #e2e8f0;padding:20px 3px 20px}
.account-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px}
.account-top b{font-size:15px;letter-spacing:-.3px}
.status{font-size:10px;font-weight:750;color:#2463a3;background:#eef5fd;padding:6px 10px;border-radius:4px}
.account-content{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.account-lead{font-size:12px;color:#6a798d;line-height:1.7;margin:0}
.account-lead strong{display:block;color:#243d5a;font-size:18px;letter-spacing:-.7px;margin:4px 0}
.account-cta{display:flex;align-items:center;justify-content:center;min-width:118px;gap:13px;flex-shrink:0;padding:11px 12px;border:0;background:#155db4;color:white;font-weight:750;font-size:12px;border-radius:8px;cursor:pointer}
.account-cta span{font-size:18px;font-weight:400}
.account-amount{font-weight:850;letter-spacing:-1.8px;color:#17283e;font-size:35px;white-space:nowrap;line-height:1.2}
.account-amount small{font-size:15px;letter-spacing:0;margin-left:3px;font-weight:700}
.account-sublabel{font-size:11px;margin:6px 0 16px;color:#65758b}
.account-returns{display:flex;gap:0;border-top:1px solid #edf0f4;padding-top:15px;margin-top:12px}
.account-returns>div{flex:1;min-width:0}
.account-returns>div+div{border-left:1px solid #e6ebf1;padding-left:19px}
.account-returns span{display:block;font-size:11px;color:#68798d;margin-bottom:6px}
.account-returns strong{display:block;font-size:18px;letter-spacing:-.7px;color:#d63858}
.account-returns small{font-size:11px;margin-left:2px}
.section{margin:25px 22px 0}
.section-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}
.section-heading h2{margin:0;font-size:16px;letter-spacing:-.55px;font-weight:800;color:#1b2c43}
.section-heading button{border:0;background:transparent;color:#507291;font-size:11px;font-weight:650;cursor:pointer;padding:4px 0}
.quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:10px 0 11px;gap:4px;border-top:1px solid #e9edf2;border-bottom:1px solid #e9edf2}
.quick button{display:flex;align-items:center;flex-direction:column;border:0;background:none;cursor:pointer;min-width:0;gap:9px;padding:6px 2px}
.quick .quick-icon{display:grid;place-items:center;width:46px;height:46px;background:#eef3f9;border-radius:10px;color:#215b9d}
.quick b{font-size:10px;letter-spacing:-.45px;font-weight:730;white-space:nowrap;color:#2b3e54}
.quick small{display:none}
.flow-list{margin:0;padding:0;list-style:none;border-top:1px solid #e9edf2}
.flow-list li{display:grid;grid-template-columns:35px 1fr 19px;align-items:center;gap:10px;min-height:71px;border-bottom:1px solid #edf0f4}
.flow-num{display:grid;place-items:center;width:30px;height:30px;background:#f0f5fb;color:#2462a8;font-size:11px;font-weight:850;border-radius:7px}
.flow-list b{display:block;font-size:12px;color:#263c55;letter-spacing:-.25px}
.flow-list small{display:block;font-size:10px;line-height:1.6;color:#7b8a9e;margin-top:4px}
.flow-arrow{font-size:20px;color:#9aa8b9;text-align:right;font-weight:300}
.notice{margin:22px 22px 0;background:#f0f4f9;padding:17px 19px 14px;border-left:3px solid #317acc;min-height:130px}
.notice-top{display:flex;justify-content:space-between;gap:8px}
.notice-label{font-weight:750;font-size:10px;letter-spacing:.4px;color:#3772b3}
.notice-index{font-size:10px;color:#8c9cad;font-variant-numeric:tabular-nums}
.notice strong{display:block;margin:11px 0 5px;font-size:14px;letter-spacing:-.3px;color:#253e5b}
.notice p{font-size:11px;line-height:1.65;color:#6c7c91;margin:0 0 10px}
.notice-bottom{display:flex;justify-content:space-between;align-items:center}
.notice-link{border:0;background:none;padding:0;color:#155dab;font-size:11px;font-weight:750;cursor:pointer}
.notice-dots{display:flex;gap:5px}
.notice-dots button{width:18px;height:3px;background:#cdd9e7;border:0;padding:0;cursor:pointer}
.notice-dots button.on{background:#1a6ac5}
.trend{padding:3px 0 13px;border-bottom:1px solid #e8edf3}
.trend-summary{display:flex;justify-content:space-between;align-items:flex-start}
.trend-summary strong{font-size:19px;letter-spacing:-.7px;color:#cf3456}
.periods{display:flex;gap:7px;margin:16px 0 0}
.periods button{background:none;border:0;color:#748398;font-size:10px;padding:6px 9px;border-radius:6px;cursor:pointer}
.periods button.chosen{color:#1c63b5;background:#edf4fd;font-weight:750}
.trend-svg{width:100%;height:116px;display:block;margin:7px 0 0}
.trend-caption{text-align:right;color:#9aa5b2;font-size:10px}
.market-wrap{margin:24px 22px 0}
.bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(100%,460px);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));padding:11px 4px calc(12px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e9edf2;z-index:20;box-shadow:0 -5px 20px #263f5810}
.bottom-nav button{display:flex;align-items:center;flex-direction:column;gap:6px;border:0;background:none;color:#8a97a9;cursor:pointer;min-width:0}
.bottom-nav button.selected{color:#1565bd}
.bottom-nav button span{font-size:9px;font-weight:680;white-space:nowrap;letter-spacing:-.45px}
.preview-controls{max-width:460px;margin:0 auto;padding:13px 14px 20px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;color:#8391a4}
.preview-controls button{border:1px solid #dce5f0;background:#fff;color:#366695;border-radius:6px;padding:7px 10px;font-size:10px;cursor:pointer}
.market-wrap .ai-assets-panel{padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
.market-wrap .ai-assets-panel .section-title{padding-bottom:13px!important;margin:0!important}
.market-wrap .ai-assets-panel .section-title b{font-size:16px!important;color:#1b2c43}
.market-wrap .ai-assets-panel .section-title span{font-size:10px!important}
.market-wrap .ai-assets-info{border-top:1px solid #e9edf2;background:#f5f8fb!important;border-radius:0!important;color:#79889b!important}
.market-wrap .ai-assets-process{padding:12px 3px!important;margin:0!important;border-bottom:1px solid #e9edf2}
.market-wrap .ai-assets-counts{background:#f3f7fc!important;border-radius:4px!important}
.market-wrap .ai-assets-list{display:block!important;margin-top:0!important}
.market-wrap .ai-assets-row{display:flex!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;padding:14px 1px!important;gap:11px!important;border-bottom:1px solid #edf0f4!important}
.market-wrap .ai-assets-mark{width:34px!important;height:34px!important;border-radius:8px!important;background:#edf3f9!important;color:#316ba8!important}
.market-wrap .ai-assets-name strong{font-size:12px!important;color:#243951}
.market-wrap .ai-assets-name small{font-size:10px!important}
.market-wrap .ai-assets-price strong{font-size:12px!important}
.market-wrap .ai-assets-state{padding-left:45px!important;margin-top:-4px!important;border-top:0!important;gap:5px 8px!important}
.market-wrap .ai-assets-state>small{font-size:10px!important}
.market-wrap .ai-assets-history{background:#f8fafc!important;border:0!important;border-radius:0!important}
.market-wrap .ai-assets-note{font-size:10px!important}
@media(max-width:380px){.welcome{padding:25px 19px 18px}.welcome h1{font-size:25px}.account,.section,.notice,.market-wrap{margin-left:16px;margin-right:16px}.quick-icon{width:39px!important;height:39px!important}.account-amount{font-size:30px}.account-cta{min-width:106px}}
@media(max-width:500px){.stage{padding:0}.phone{box-shadow:none}.preview-controls{padding-left:16px;padding-right:16px}}
`}</style>
  </div><div className="preview-controls"><span>디자인 검수 · 자산 숫자는 시안 예시</span><button onClick={()=>setStarted(s=>!s)}>{started?"시작 전 화면":"진행 중 화면"} 보기</button></div></div>;
}
