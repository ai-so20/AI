"use client";
import Link from "next/link";
import MemberNav from "../components/design/MemberNav";
import {HomeReturnLink,PageActionLink} from "../components/design/PageLinks";
import {useEffect,useState} from "react";
import {supabase} from "../supabase";
import {isApprovedProfile,isDesignUiLocked,observeDesignUiLock} from "../lib/design-member-access";
const tabs=["전체","참여 가능","참여 완료"];
const eventVisuals={
 number:{label:"숫자",image:"/event-icons/number.svg"},
 gift_box:{label:"랜덤",image:"/event-icons/gift_box.svg"},
 roulette:{label:"룰렛",image:"/event-icons/roulette.svg"},
 quiz:{label:"퀴즈",image:"/event-icons/quiz.svg"},
 first_come:{label:"선착순",image:"/event-icons/first_come.svg"},
 draw:{label:"추첨",image:"/event-icons/draw.svg"},
 attendance:{label:"출석",image:"/event-icons/attendance.svg"}
};
function EventTypeBadge({type}){
 const visual=eventVisuals[type];
 return <div className={"event-icon event-icon--"+(visual?type:"default")} aria-label={(visual?.label||"이벤트")+" 종류"}>
 {visual?<img src={visual.image} width="52" height="52" alt="" aria-hidden="true" loading="lazy"/>:<span className="event-icon-fallback">★</span>}
 <span className="event-icon-label">{visual?.label||"이벤트"}</span>
 </div>;
}
function parsePublishedWinner(row){
 const content=String(row?.content||"");
 if(!content.startsWith("🎉 VIP EVENT · 당첨 안내"))return null;
 const name=content.match(/🏆\s*([^\n]+?)\s*님(?:입니다|이|께|$)/)?.[1]?.trim();
 if(!name)return null;
 const prize=content.match(/🎁\s*당첨 상품\s*\n([^\n]+)/)?.[1]?.trim()||"";
 return {id:row.id,name,prize,at:row.created_at};
}
function EventInput({item,answer,onChange,submit,busy}){
 if(item.event_type==="number")return <div className="event-action"><input type="number" min="1" max="100" value={answer||""} onChange={e=>onChange(e.target.value)} placeholder="1~100 숫자"/><button disabled={busy} onClick={()=>submit()}>숫자 제출</button></div>;
 if(item.event_type==="quiz"||item.event_type==="gift_box")return <div className="event-action"><div className="question">{item.event_type==="quiz"?item.quiz_question:"상자 하나를 선택하세요"}</div><div className="choices">{[1,2,3,4].map(n=><button key={n} className={String(answer)===String(n)?"picked":""} onClick={()=>onChange(String(n))}>{item.event_type==="quiz"?(item["quiz_option_"+n]||n+"번"):n+"번 상자"}</button>)}</div><button disabled={busy} onClick={()=>submit()}>참여하기</button></div>;
 return <div className="event-action"><button disabled={busy} onClick={()=>submit(item.event_type==="roulette"?"roulette":null)}>{item.event_type==="roulette"?"룰렛 돌리고 응모하기":item.event_type==="first_come"?"선착순 참여하기":item.event_type==="attendance"?"출석 참여하기":"응모하기"}</button></div>
}
export default function DesignEvent(){
const [showAllEvents,setShowAllEvents]=useState(false);const [nickname,setNickname]=useState(""),[recentWinners,setRecentWinners]=useState([]),[winnerHistoryState,setWinnerHistoryState]=useState("loading"),[tab,setTab]=useState("전체"),[events,setEvents]=useState([]),[loading,setLoading]=useState(true),[signed,setSigned]=useState(false),[accessState,setAccessState]=useState("loading"),[answers,setAnswers]=useState({}),[busy,setBusy]=useState(null),[notice,setNotice]=useState(""),[eventLoadError,setEventLoadError]=useState("");
async function load(){
 try{
 const {data,error}=await supabase.rpc("get_auto_events");
 if(error)setEventLoadError("이벤트 조회 실패: "+error.message);
 else{
  const rows=(data||[]).filter(x=>x.event_type!=="attendance");
  rows.sort((a,b)=>{const order=x=>isLive(x)?0:x.status==="scheduled"?1:x.status==="completed"?2:3;return order(a)-order(b)||Number(a.round_number||0)-Number(b.round_number||0)});
  setEvents(rows);setEventLoadError("");
 }
 }catch{setEventLoadError("이벤트를 불러오는 중 문제가 발생했습니다.")}
 try{
  // AI-owned completed event winners are the authoritative history.
  // Read names through the existing approved-member RLS on members.
  const {data:rows,error:historyError}=await supabase.from("event_winners")
   .select("id,selected_at,members(nickname),events(title,prize,status)")
   .order("selected_at",{ascending:false}).limit(40);
  if(historyError)throw historyError;
  const history=(rows||[]).filter(row=>row.events?.status==="completed"&&row.members?.nickname)
   .map(row=>({id:row.id,name:row.members.nickname,prize:row.events.prize||row.events.title||"이벤트 당첨",at:row.selected_at}));
  setRecentWinners(history);setWinnerHistoryState("ready");
 }catch{
  // Preserve the previous announcement-based fallback if history is inaccessible.
  try{
   const {data:announcements,error:announcementsError}=await supabase.from("group_messages").select("id,content,created_at").eq("is_deleted",false).eq("message_type","event").like("content","🎉 VIP EVENT · 당첨 안내%").order("created_at",{ascending:false}).limit(40);
   if(announcementsError)throw announcementsError;
   setRecentWinners((announcements||[]).map(parsePublishedWinner).filter(Boolean));setWinnerHistoryState("ready");
  }catch{setRecentWinners([]);setWinnerHistoryState("error")}
 }
 setLoading(false);
}
useEffect(()=>{let active=true;async function boot(){try{if(isDesignUiLocked()){if(active){setSigned(false);setAccessState("locked");setLoading(false)}return}const {data:{user},error:authError}=await supabase.auth.getUser();if(!active)return;if(!user){setSigned(false);setAccessState("login");setLoading(false);return}if(authError)throw authError;const {data:profile,error:profileError}=await supabase.from("profiles").select("approval_status,nickname,role").eq("id",user.id).maybeSingle();if(profileError)throw profileError;if(!active)return;if(isApprovedProfile(profile)&&profile.role!=="admin"){setNickname(String(profile.nickname||""));setAccessState("member");setSigned(true);await load()}else{setSigned(false);setAccessState(isApprovedProfile(profile)?"admin":"unapproved");setNotice(isApprovedProfile(profile)?"관리자 이벤트 관리는 기존 관리자 화면을 이용하세요.":"승인된 회원만 이벤트에 참여할 수 있습니다.");setLoading(false)}}catch{if(active){setSigned(false);setAccessState("error");setNotice("회원 정보를 확인할 수 없습니다.");setLoading(false)}}}void boot();return()=>{active=false}},[]);
useEffect(()=>observeDesignUiLock(()=>{setSigned(false);setAccessState("locked");setNickname("");setEvents([]);setRecentWinners([]);setLoading(false)}),[]);
useEffect(()=>{if(!signed)return;const timer=setInterval(()=>{void load()},30000);return()=>clearInterval(timer)},[signed]);
async function submit(item,direct){if(busy||!signed||isDesignUiLocked())return;if(item.participated||!isLive(item)){setNotice(item.participated?"이미 참여한 이벤트입니다.":"현재 참여 가능한 시간이 아닙니다.");await load();return}let answer=direct===undefined?(answers[item.event_id]??null):direct;if(item.event_type==="number"){const n=Number(answer);if(!Number.isInteger(n)||n<1||n>100){setNotice("1~100 사이의 숫자를 선택하세요.");return}answer=String(n)}if(["quiz","gift_box"].includes(item.event_type)&&!["1","2","3","4"].includes(String(answer))){setNotice("먼저 보기를 선택하세요.");return}setBusy(item.event_id);setNotice("");if(item.event_type==="roulette")await new Promise(resolve=>setTimeout(resolve,900));try{const {data,error}=await supabase.rpc("join_auto_event",{target_event_id:item.event_id,submitted_answer:answer});if(error){setNotice("참여 실패: "+error.message)}else if(!data?.success){setNotice(data?.message||"참여가 처리되지 않았습니다.")}else{await load();setNotice(data?.message||item.title+" 참여가 완료되었습니다.")}}catch(e){setNotice("참여 처리 중 오류가 발생했습니다.")}finally{setBusy(null)}}
const isLive=x=>{const start=new Date(x.starts_at).getTime(),end=new Date(x.ends_at).getTime();return Number.isFinite(start)&&Number.isFinite(end)&&Date.now()>=start&&Date.now()<end&&x.status==="active"};
const visible=signed&&!isDesignUiLocked()?events.filter(x=>tab==="전체"||(tab==="참여 가능"?isLive(x)&&!x.participated:Boolean(x.participated))):[];const displayedEvents=showAllEvents?visible:visible.slice(0,6);const active=events.filter(isLive).length,participated=events.filter(x=>x.participated).length,winners=events.filter(x=>x.status==="completed"&&x.winner_nickname),myWins=nickname?winners.filter(x=>String(x.winner_nickname).trim()===nickname.trim()).length:0,displayedWinners=signed&&!isDesignUiLocked()?(recentWinners.length?recentWinners:events.filter(x=>x.status==="completed"&&x.winner_nickname).map(x=>({id:x.event_id,name:x.winner_nickname,prize:x.prize||x.title,at:x.ends_at}))):[];
return <div className="event-stage"><div className="event-phone"><header className="event-hero"><div className="event-top"><HomeReturnLink/><div className="brand"><span className="logo">ΛI</span> PROCESS</div></div><div className="event-hero-copy"><span className="chip">AI PROCESS · BENEFITS</span><h1>지금 참여하는<br/>오늘의 이벤트</h1><p>매시간 이어지는 회원 혜택을 확인하세요.</p></div><span className="event-hero-watermark" aria-hidden="true">24</span></header><main className="event-body"><section className="event-summary"><div><span>진행 중인 이벤트</span><strong>{loading||!signed?"—":active}<small>개</small></strong></div><div><span>오늘 참여</span><strong>{loading||!signed?"—":participated}<small>건</small></strong></div><div><span>오늘 내 당첨</span><strong>{loading||!signed?"—":myWins}<small>건</small></strong></div></section><section className="event-guide" aria-label="이벤트 당첨 혜택">
  <div className="event-guide-head">
    <div><span className="event-guide-kicker">AI PROCESS · EVENT BENEFIT</span><h2>이벤트 당첨 혜택</h2></div>
    <span className="event-guide-hour">매시간 연속 운영</span>
  </div>
  <div className="event-benefit">
    <div className="event-benefit-copy">
      <span className="event-benefit-label">당첨 회원 랜덤 기프티콘</span>
      <strong><small>최대</small> 300,000원</strong>
      <p>3,000원 ~ 300,000원 상당의 랜덤 기프티콘 혜택</p>
    </div>
    <span className="event-benefit-art" aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="12" y="24" width="40" height="32" rx="5"/><path d="M32 24v32M12 35h40M32 24C19 24 22 9 28 12c4 2 4 8 4 12Zm0 0c13 0 10-15 4-12-4 2-4 8-4 12Z"/></svg>
    </span>
    <span className="event-benefit-glow" aria-hidden="true"></span>
  </div>
  <div className="event-guide-foot">이벤트 당첨 시 상품지급센터에서 당첨 결과와 수령 안내를 확인할 수 있습니다.</div>
  <details className="event-guide-details"><summary>참여 조건 · 당첨 및 지급 안내 <span aria-hidden="true">⌄</span></summary>
    <div>
      <p>승인된 회원은 진행 중인 회차에 1회 응모할 수 있습니다. 회차가 끝나면 다음 이벤트가 즉시 시작되며, 당첨 여부는 회차 종료 후 확인할 수 있습니다.</p>
      <p>선착순 이벤트는 서버에 가장 먼저 정상 접수된 회원을 기준으로 판정합니다. 상품 지급 전에는 상품지급센터에서 ‘지급 대기’로 표시될 수 있습니다.</p>
      <p className="event-guide-note">AI PROCESS 돌발 체험 이벤트는 별도 혜택이며, 상세 안내는 AI PROCESS 화면에서 확인할 수 있습니다.</p>
    </div>
  </details>
</section><div className="section-heading"><h2>이벤트</h2><span>실시간 회차 현황</span></div>{eventLoadError&&<p role="alert" className="notice">{eventLoadError}</p>}{notice&&<p role="status" className="notice">{notice}</p>}{!signed&&!loading&&<div className="empty">{accessState==="locked"?"회원 입장 화면에서 잠금을 해제해주세요.":accessState==="login"?"회원 로그인 후 참여할 수 있습니다.":accessState==="unapproved"?"관리자 승인 후 이벤트에 참여할 수 있습니다.":accessState==="admin"?"관리자 이벤트 관리는 기존 관리자 화면을 이용하세요.":"회원 정보를 확인해주세요."} {(accessState==="login"||accessState==="locked")&&<PageActionLink href="/design-entry?next=%2Fdesign-event" label="회원 입장" detail="로그인 후 이벤트에 참여하세요" icon="event"/>}{accessState==="admin"&&<PageActionLink href="/?tab=event" label="이벤트 관리" detail="관리자 화면으로 이동" icon="admin"/>}</div>}<div className="tabs" aria-label="이벤트 보기">{tabs.map(x=><button key={x} className={tab===x?"active":""} onClick={()=>{setTab(x);setShowAllEvents(false)}}>{x}</button>)}</div>{loading?<div className="empty">이벤트 불러오는 중...</div>:visible.length?<div className="events">{displayedEvents.map(x=><article key={x.event_id} className={"event-item "+(isLive(x)?"event-item--live":x.participated?"event-item--done":"")} style={{alignItems:"stretch",flexDirection:"column"}}><div style={{display:"flex",gap:12,alignItems:"center"}}><EventTypeBadge type={x.event_type}/><div className="event-copy"><span className={"event-status "+(isLive(x)?"is-live":"")}>{isLive(x)?"● 진행 중":x.status==="completed"?"종료":"예정"}</span><span className="event-round">{x.round_number||"-"}회차</span><h3>{x.title}</h3><p className="event-prize">{x.prize&&x.prize!=="VIP EVENT 당첨"?"상품 · "+x.prize:"당첨 결과 및 상품은 회차 종료 후 안내됩니다."}</p>{x.description&&<p className="event-desc">{x.description}</p>}<small className="event-schedule">{x.starts_at?new Date(x.starts_at).toLocaleTimeString("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit"}):""} ~ {x.ends_at?new Date(x.ends_at).toLocaleTimeString("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit"}):""} · {x.participated?"참여 완료":isLive(x)?"지금 참여 가능":x.status==="completed"?"종료":"참여 대기"}</small></div></div>{(x.participated||x.winner_nickname||x.revealed_answer)&&<div className="event-result">{x.participated&&<p><strong>내 참여:</strong> {x.my_answer||"응모 완료"}{x.status==="completed"&&x.my_result_text?" · "+x.my_result_text:""}</p>}{x.status==="completed"&&x.revealed_answer&&<p><strong>공개된 정답:</strong> {x.revealed_answer}</p>}{x.status==="completed"&&x.winner_nickname&&<p><strong>🏆 당첨:</strong> {x.winner_nickname}</p>}</div>}{isLive(x)&&!x.participated&&signed&&<EventInput item={x} answer={answers[x.event_id]} onChange={v=>setAnswers(a=>({...a,[x.event_id]:v}))} submit={v=>submit(x,v)} busy={busy===x.event_id}/>}</article>)}{visible.length>displayedEvents.length&&<button type="button" className="event-more" onClick={()=>setShowAllEvents(true)}>나머지 {visible.length-displayedEvents.length}개 회차 더 보기 <span aria-hidden="true">↓</span></button>}{showAllEvents&&visible.length>6&&<button type="button" className="event-more event-more--less" onClick={()=>setShowAllEvents(false)}>회차 목록 접기 <span aria-hidden="true">↑</span></button>}</div>:<div className="empty">{!signed?"이벤트 참여는 회원 로그인 후 가능합니다.":tab==="참여 가능"?"현재 참여할 수 있는 회차가 없습니다. 다음 회차는 바로 이어집니다.":tab==="참여 완료"?"아직 참여한 이벤트가 없습니다.":"표시할 이벤트가 없습니다."}</div>}<section className="winner"><div className="section-heading"><h2>최근 당첨 내역</h2><span>조회 가능한 최근 기록</span></div>{winnerHistoryState==="error"&&<p className="winner-status" role="status">과거 당첨 공지를 조회하지 못했습니다. 확인 가능한 오늘 회차 결과만 표시합니다.</p>}{winnerHistoryState==="ready"&&recentWinners.length===0&&displayedWinners.length>0&&<p className="winner-status">현재 계정에서 확인 가능한 과거 공지가 없어 오늘 회차 결과만 표시합니다.</p>}{displayedWinners.length?<div className="events">{displayedWinners.slice(0,8).map(w=><article className="event-item" key={w.id}><div className="event-copy"><h3>🏆 {w.name}</h3><p>{w.prize||"이벤트 당첨"}</p>{w.at&&<small>{new Date(w.at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</small>}</div></article>)}</div>:<p>현재 계정에서 확인 가능한 당첨 내역이 없습니다.</p>}</section></main><MemberNav current="event"/></div><style jsx>{`
.winner-status{background:#f5f9ff;border:1px solid #e4edf9;padding:10px 12px;font-size:12px;color:#54708e;line-height:1.6;border-radius:9px;margin:0 0 10px}.event-result{width:100%;margin-top:9px;padding:10px 11px;background:#f4f8fd;border-radius:8px}.event-result p{font-size:12px;line-height:1.6;margin:2px 0;color:#315073}.event-result strong{color:#142f51}.notice{font-size:12px;color:#086ee5;padding:10px}
`}</style><style jsx>{`
.event-stage,.event-stage *{box-sizing:border-box}.event-stage{min-height:100vh;word-break:keep-all;overflow-wrap:break-word;padding:20px 12px 36px;background:#edf3fa;font-family:Arial,"Noto Sans KR",sans-serif;color:#11213e}.event-phone{position:relative;max-width:440px;min-height:100vh;margin:0 auto;overflow:hidden;background:#f7faff;box-shadow:0 15px 55px #25476c1d;padding-bottom:90px}.event-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.event-top .brand{font-size:16px;white-space:nowrap}.event-top .logo{font-size:25px}.event-hero{height:332px;padding:27px 24px 0;background-image:linear-gradient(to bottom,transparent 0%,transparent 45%,#f7faff 100%),url("/hero_clean.png");background-size:100% 100%,100% auto;background-repeat:no-repeat;background-position:top center}.brand{display:flex;align-items:center;gap:5px;font-size:20px;font-weight:900;letter-spacing:-.6px}.logo{font-size:31px;color:#0870e9;letter-spacing:-5px;padding-right:5px}.chip{display:inline-block;margin-top:47px;padding:5px 11px;background:#d8eaff;color:#076be0;border-radius:100px;font-size:11px;font-weight:800}.event-hero h1{font-size:27px;line-height:1.4;letter-spacing:-1.1px;margin:15px 0 10px}.event-hero p{font-size:14px;line-height:1.7;color:#3e506c}.event-body{padding:0 12px}.event-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:17px 10px;background:#ffffffed;border:1px solid #e5edf7;border-radius:17px;box-shadow:0 5px 17px #244d7b10}.event-summary>div{padding:0 10px;min-width:0}.event-summary>div+div{border-left:1px solid #e7eef7}.event-summary span{display:block;min-height:32px;font-size:12px;line-height:1.35;color:#64758d;white-space:normal;word-break:keep-all;overflow-wrap:anywhere}.event-summary strong{display:block;margin-top:8px;font-size:23px;line-height:1.25;font-variant-numeric:tabular-nums}.event-summary small{font-size:12px;margin-left:3px}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:27px 5px 12px}.section-heading h2{font-size:19px;letter-spacing:-.5px;margin:0}.section-heading span{font-size:11px;color:#5b6e83}.tabs{display:flex;gap:8px;margin:0 3px 12px}.tabs button{min-height:40px;border:0;background:#eaf1fa;color:#5c6f88;padding:9px 15px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer}.tabs button.active{background:#0877ed;color:white}.events{display:flex;flex-direction:column;gap:9px}.event-item{display:flex;align-items:center;gap:13px;background:#fff;border:1px solid #e1eaf6;border-radius:17px;padding:16px 13px;min-height:118px;box-shadow:0 5px 18px #244d7b0b}.event-icon{width:73px;height:85px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;overflow:hidden;border-radius:15px;background:linear-gradient(145deg,#edf6ff 0%,#cfe4ff 100%);border:1px solid #d9e9fd;box-shadow:inset 0 1px 0 #ffffffd6}.event-icon img{display:block;width:53px;height:53px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 2px 2px #2564c11a)}.event-icon-label{display:inline-flex;align-items:center;justify-content:center;min-width:40px;margin-top:3px;padding:4px 7px;border-radius:999px;background:linear-gradient(145deg,#227ee9,#0e53bc);border:1px solid #ffffff93;box-shadow:0 2px 4px #1459b51d;color:#fff;font-size:10px;line-height:1;white-space:nowrap;font-weight:800;letter-spacing:-.25px}.event-icon--quiz{background:linear-gradient(145deg,#f1f7ff,#dceafe)}.event-icon--draw{background:linear-gradient(145deg,#ecf6ff,#d9e8fe)}.event-icon--first_come{background:linear-gradient(145deg,#fff8e8,#e4efff)}.event-icon--gift_box{background:linear-gradient(145deg,#eff7ff,#d5e8ff)}.event-icon--roulette{background:linear-gradient(145deg,#edf5ff,#d8e6ff)}.event-icon-fallback{font-size:26px;color:#276fcb}.event-copy{min-width:0;flex:1}.event-copy>span{font-size:11px;color:#0b73e6;font-weight:800}.event-copy h3{font-size:15px;margin:5px 0 4px}.event-copy p{font-size:13px;line-height:1.65;color:#61718a;margin:0}.event-copy small{display:block;margin-top:7px;font-size:11px;color:#5b6e83}.chevron{font-size:23px;color:#9aa9bc}.empty{padding:40px 12px;text-align:center;background:white;border:1px solid #e5edf7;border-radius:16px;color:#5b6e83;font-size:12px}.winner{margin-top:8px}.winner>p{padding:28px 12px;text-align:center;background:white;border:1px solid #e5edf7;border-radius:16px;color:#5b6e83;font-size:12px}.bottom{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(100%,440px);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:#fff;border-top:1px solid #e0e9f2;padding:21px 3px calc(21px + env(safe-area-inset-bottom));text-align:center;font-size:10px;color:#5b6c84}.bottom a{color:inherit;text-decoration:none}.bottom .selected{color:#096fec;font-weight:800}.preview{max-width:440px;margin:12px auto;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;color:#6d7d92}.preview a{color:#096be6;background:#fff;border:1px solid #b9d4f1;border-radius:9px;padding:10px;text-decoration:none;font-weight:700}@media(max-width:480px){.event-stage{padding:0 0 22px}.event-phone{box-shadow:none}.preview{padding:0 12px}}@media(max-width:370px){.event-item{gap:8px}.event-copy h3{font-size:13px}.event-icon{width:63px;height:78px;border-radius:12px}.event-icon img{width:45px;height:45px}.event-icon-label{font-size:11px;min-width:36px;padding:4px 6px}.event-summary>div{padding:0 5px}.event-summary span{font-size:12px;line-height:1.35;min-height:32px;white-space:normal;word-break:keep-all;overflow-wrap:anywhere}}

/* Event experience v2: purpose-first, less decorative, high-contrast hierarchy */
.event-stage{background:#eaf0f7;color:#18314f}
.event-phone{background:#fff}
.event-hero{position:relative;isolation:isolate;height:270px;padding:19px 22px 26px;background:linear-gradient(180deg,#112f56 0%,#19568d 62%,#367cb1 77%,#d9eaf6 92%,#fff 100%);color:#fff;overflow:hidden}
.event-hero:before{content:"";pointer-events:none;position:absolute;right:-72px;top:-76px;width:260px;height:260px;border:1px solid #ffffff2c;border-radius:50%;box-shadow:0 0 0 35px #ffffff08,0 0 0 75px #ffffff06;z-index:-1}
.event-top{position:relative;z-index:1}.event-top .brand{font-size:14px;color:#dceaff;letter-spacing:0}.event-top .logo{font-size:20px;color:#a6d3ff;letter-spacing:-2px}
.event-hero-copy{position:relative;z-index:1}
.event-hero .chip{margin-top:22px;padding:0;background:none;color:#b7dafa;font-size:10px;letter-spacing:1.4px;border-radius:0}
.event-hero h1{font-size:27px;line-height:1.27;letter-spacing:-1px;margin:10px 0 8px;color:#fff;font-weight:850}
.event-hero p{font-size:13px;line-height:1.55;color:#cfe3f7}
.event-hero-watermark{position:absolute;right:18px;bottom:6px;font-size:104px;line-height:1;font-weight:850;letter-spacing:-8px;color:#ffffff0d;pointer-events:none}
.event-body{padding:0 16px;background:#fff}
.event-summary{position:relative;margin-top:0;padding:17px 4px 15px;border-radius:12px;border-color:#dce7f2;box-shadow:none;background:#fff}
.event-summary>div{padding:0 13px}.event-summary span{font-size:12px;color:#61748c;min-height:17px}
.event-summary strong{font-size:25px;margin-top:7px;color:#15365e}.event-summary small{font-size:12px;color:#6b8098}
.event-guide{margin-top:20px;background:#fff;border:1px solid #dbe6f0;border-radius:12px;overflow:hidden}
.event-guide-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 15px 14px}
.event-guide-head>div{min-width:0;flex:1}
.event-guide-kicker{display:block;font-size:10px;letter-spacing:1.1px;color:#5e7da0;font-weight:850}
.event-guide h2{font-size:18px;letter-spacing:-.55px;color:#183451;margin:5px 0 0}
.event-guide-hour{display:inline-flex;align-items:center;padding:7px 9px;border:1px solid #d3e2f3;border-radius:6px;color:#356b9f;font-size:11px;font-weight:800;white-space:nowrap}
.event-benefit{position:relative;display:flex;align-items:center;isolation:isolate;overflow:hidden;min-height:155px;padding:22px 19px;margin:0 13px 0;background:linear-gradient(115deg,#123458 0%,#164d81 78%,#246aa5 100%);border:1px solid #22588c;border-radius:10px;color:#fff}
.event-benefit:before{content:"";pointer-events:none;position:absolute;right:-65px;top:-75px;width:215px;height:215px;border:1px solid #ffffff28;border-radius:50%;box-shadow:0 0 0 27px #ffffff08,0 0 0 57px #ffffff05;z-index:-1}
.event-benefit-copy{position:relative;z-index:1;min-width:0;flex:1}
.event-benefit-label{display:block;color:#b9d7f3;font-size:12px;line-height:1.45;font-weight:750}
.event-benefit-copy>strong{display:block;white-space:nowrap;margin:9px 0 8px;color:#fff;font-size:29px;line-height:1.15;letter-spacing:-1px;font-weight:850;font-variant-numeric:tabular-nums}
.event-benefit-copy>strong small{font-size:14px;font-weight:750;color:#c2daf2;letter-spacing:0}
.event-benefit-copy>p{margin:0;color:#dfedfb;font-size:12px;line-height:1.55;word-break:keep-all}
.event-benefit-art{position:absolute;right:9px;top:16px;display:grid;place-items:center;width:81px;height:81px;opacity:.16;transform:rotate(-13deg);color:#d9ebff;pointer-events:none}
.event-benefit-art svg{display:block;width:100%;height:100%}
.event-benefit-glow{position:absolute;right:-30px;bottom:-88px;width:150px;height:150px;border:1px solid #ffffff26;border-radius:50%;pointer-events:none}
.event-guide-foot{padding:13px 16px 12px;color:#526d8b;font-size:12px;line-height:1.6;word-break:keep-all}
.event-guide-details{border-top:1px solid #e6eef7}
.event-guide-details>summary{list-style:none;display:flex;justify-content:space-between;gap:7px;align-items:center;padding:12px 15px;cursor:pointer;color:#286eab;font-size:13px;font-weight:750;min-height:46px}
.event-guide-details>summary::-webkit-details-marker{display:none}
.event-guide-details>summary>span{font-size:20px;line-height:1;transition:transform .2s}
.event-guide-details[open]>summary>span{transform:rotate(180deg)}
.event-guide-details>summary:focus-visible{outline:2px solid #2575c8;outline-offset:-2px}
.event-guide-details>div{padding:0 16px 15px;border-top:1px solid #ecf1f7}
.event-guide-details p{font-size:12px;line-height:1.75;color:#4c637e;margin:12px 0 0;word-break:keep-all}
.event-guide-details .event-guide-note{margin-top:12px;padding:10px;background:#edf5ff;border-left:3px solid #3782ce;border-radius:4px;color:#315a82}
.section-heading{margin:25px 1px 11px}.section-heading h2{font-size:19px;color:#1b3451}.section-heading span{font-size:12px}
.tabs{margin:0 0 12px;gap:5px}.tabs button{flex:1;padding:10px 6px;min-width:0;min-height:44px;border-radius:8px;font-size:13px;background:#edf2f9;color:#53677e}
.tabs button.active{background:#1e65b1;box-shadow:none}
.event-item{border-radius:11px;padding:14px;min-height:0;box-shadow:none;gap:10px}
.event-item--live{border-color:#b9d5ee;border-left:3px solid #2682d8;background:#fff}
.event-item--done{background:#fafcfe}
.event-icon{width:59px;height:68px;border-radius:10px;box-shadow:none}
.event-icon img{width:39px;height:39px;filter:none}
.event-icon-label{font-size:10px;padding:3px 6px;background:#1f65b0;border:0;box-shadow:none;margin-top:0}
.event-copy>span{font-size:12px}.event-copy .event-status{display:inline-block;padding:4px 7px;margin-right:6px;background:#edf1f5;border-radius:5px;color:#5a7089;font-size:11px;font-weight:800}
.event-copy .event-status.is-live{background:#e5f3ff;color:#106bc1}
.event-copy .event-round{font-size:11px;font-weight:700;color:#60748a}
.event-copy h3{font-size:16px;color:#173450;letter-spacing:-.4px;margin:7px 0 5px}
.event-copy p{font-size:12px;line-height:1.6}.event-copy .event-prize{color:#2c5c91;font-weight:650}
.event-copy .event-desc{color:#63768c;margin-top:5px}.event-copy .event-schedule{color:#6a7e94;font-size:12px;margin-top:9px;line-height:1.55}
.event-more{width:100%;min-height:44px;background:#fff;border:1px solid #cedbe9;border-radius:9px;color:#1b5f9b;font-size:13px;font-weight:800;cursor:pointer}
.event-more--less{color:#66788d;background:#f3f6fa}
.event-result{margin-top:4px;border-radius:7px;border:1px solid #e4edf8;background:#f6faff}
.event-result p{font-size:13px}.notice{margin:8px 0;border:1px solid #d7e8fa;border-radius:9px;background:#f2f8ff;color:#235a90;font-size:13px}
.empty{padding:25px 12px;border-radius:11px;font-size:13px;line-height:1.6}
.winner .events .event-item{padding:13px 15px}.winner .event-copy h3{font-size:14px}
@media(max-width:370px){.event-hero{height:263px;padding:18px 17px 22px}.event-body{padding:0 12px}.event-summary>div{padding:0 7px}.event-summary strong{font-size:21px}.event-guide-head{padding:14px 12px}.event-guide h2{font-size:17px}.event-guide-hour{padding:6px;font-size:10px}.event-benefit{margin:0 10px;padding:20px 13px;min-height:148px}.event-benefit-copy>strong{font-size:25px}.event-benefit-copy>p{font-size:11px}.event-benefit-art{width:60px;height:60px;right:0}.event-icon{width:54px;height:64px}.event-copy h3{font-size:15px}}
 `}</style><style jsx global>{`.event-stage .event-action{padding:12px 2px 0;display:flex;flex-direction:column;gap:10px}
.event-stage .event-action>button{width:100%;min-height:46px;padding:12px 16px;border:1px solid #086ee5;border-radius:13px;background:#086ee5;color:#fff;font-family:inherit;font-size:14px;line-height:1.35;font-weight:800;box-shadow:0 3px 8px #086ee51f;cursor:pointer}
.event-stage .event-action>button:hover:not(:disabled){background:#075fc9}
.event-stage .event-action input{min-height:44px;padding:11px 12px;border:1px solid #cbdcf0;border-radius:10px;background:#fff;color:#17335b;font:inherit;font-size:14px}
.event-stage .event-action button:disabled{opacity:.55;cursor:not-allowed}
.event-stage .event-action .question{font-size:14px;line-height:1.6;word-break:keep-all;color:#3e506c}
.event-stage .event-action .choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.event-stage .event-action .choices button{min-height:44px;padding:10px 8px;border:1px solid #cbdcf0;border-radius:10px;background:#fff;color:#223a5c;font-size:13px;line-height:1.4;cursor:pointer;word-break:keep-all}
.event-stage .event-action .choices button.picked{background:#e4f1ff;border-color:#086ee5;color:#075fc9;font-weight:750}
.event-stage .event-action button:focus-visible{outline:2px solid #086ee5;outline-offset:2px}`}</style></div>}
