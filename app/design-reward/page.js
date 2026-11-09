"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import MemberNav from "../components/design/MemberNav";
import {HomeReturnLink,PageActionLink} from "../components/design/PageLinks";
import {supabase} from "../supabase";
import {isApprovedProfile,isDesignUiLocked,observeDesignUiLock} from "../lib/design-member-access";
function urlBase64ToUint8Array(base64String){const padding="=".repeat((4-(base64String.length%4))%4);const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from([...window.atob(base64)].map(x=>x.charCodeAt(0)))}
function Message({value,onOpenAi,onOpenGift,openingGift}){
 const raw=String(value||"");
 if(raw.startsWith("[[GIFT]]")){
  const [id,name,image]=raw.slice("[[GIFT]]".length).split("|");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||""))return <span>기프티콘 지급 메시지 형식이 올바르지 않습니다.</span>;
  return <div className="gift"><strong>🎁 기프티콘 지급 안내</strong>{/^https:\/\//i.test(image||"")&&<img src={image} alt={name||"지급 상품"} style={{display:"block",maxWidth:"100%",maxHeight:160,objectFit:"contain",marginTop:8}}/>}<p>{name||"기프티콘"}</p><button type="button" disabled={openingGift===id} onClick={()=>onOpenGift(id)}>{openingGift===id?"기프티콘 확인 중...":"기프티콘 확인하기"}</button></div>;
 }
 if(raw.startsWith("[[GIFT_REWARD]]")){
  try{const data=JSON.parse(raw.slice("[[GIFT_REWARD]]".length));const url=String(data.gift_url||"");
  return <div className="gift"><strong>{data.reward_type==="attendance"?"출석 달성 보상":"이벤트 당첨 상품"}</strong><p>{data.product_name||"기프티콘"}</p>{/^https:\/\//i.test(url)?<a href={url} target="_blank" rel="noopener noreferrer">기프티콘 확인하기 ↗</a>:<p>기프티콘 링크를 확인할 수 없습니다.</p>}</div>}catch{return <span>기프티콘 지급 메시지를 불러올 수 없습니다.</span>}
 }
 if(raw.startsWith("[[VIP_SURPRISE_LINK]]")){
  try{const data=JSON.parse(raw.slice("[[VIP_SURPRISE_LINK]]".length));return <div className="gift"><strong>AI PROCESS 안내</strong><p>{data.text||""}</p><button type="button" onClick={onOpenAi}>AI PROCESS 바로가기 ›</button></div>}catch{return <span>AI PROCESS 안내를 표시할 수 없습니다.</span>}
 }
 if(raw.startsWith("[[LINK_BUTTON]]")){
  try{const data=JSON.parse(raw.slice("[[LINK_BUTTON]]".length));const url=String(data.button_url||"");return <div className="gift"><strong>상품 지급 안내</strong><p>{data.text||""}</p>{/^https:\/\//i.test(url)?<a href={url} target="_blank" rel="noopener noreferrer">{data.button_text||"링크 열기"} ↗</a>:<p>연결 링크를 확인할 수 없습니다.</p>}</div>}catch{return <span>링크 안내 메시지를 표시할 수 없습니다.</span>}
 }
 if(raw.startsWith("[[IMAGE]]")){
  const url=raw.slice("[[IMAGE]]".length).trim();return /^https:\/\//i.test(url)?<img src={url} alt="지급 안내 이미지" style={{maxWidth:"100%",height:"auto"}}/>:<span>이미지 주소를 확인할 수 없습니다.</span>
 }
 return <span className="plain">{raw.split(/(https?:\/\/[^\s]+)/g).map((part,i)=>/^https?:\/\//i.test(part)?<a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>:<span key={i}>{part}</span>)}</span>
}
function messagePreview(raw){
 const text=String(raw||"");
 if(text.startsWith("[[IMAGE]]"))return "사진이 도착했습니다.";
 if(text.startsWith("[[GIFT]]"))return "기프티콘 지급 안내 · "+(text.slice("[[GIFT]]".length).split("|")[1]||"상품 확인");
 for(const p of ["[[GIFT_REWARD]]","[[VIP_SURPRISE_LINK]]","[[LINK_BUTTON]]"]){if(text.startsWith(p)){try{const data=JSON.parse(text.slice(p.length));return String(data.product_name||data.text||data.button_text||"새 상품 지급 안내").slice(0,140)}catch{return "새 상품 지급 안내"}}}
 return text.replace(/\s+/g," ").slice(0,140);
}
export default function DesignReward(){const [user,setUser]=useState(null),[chat,setChat]=useState(null),[messages,setMessages]=useState([]),[loading,setLoading]=useState(true),[accessState,setAccessState]=useState("loading"),[notice,setNotice]=useState(""),[text,setText]=useState(""),[sending,setSending]=useState(false),[unreadAtOpen,setUnreadAtOpen]=useState(0),[toast,setToast]=useState(""),[pushWorking,setPushWorking]=useState(false),[pushEnabled,setPushEnabled]=useState(false);const [rewardRecords,setRewardRecords]=useState([]),[rewardLoading,setRewardLoading]=useState(false),[rewardError,setRewardError]=useState(false),[giftOpening,setGiftOpening]=useState("");const messageBoxRef=useRef(null),toastTimerRef=useRef(null);
// Override the black browser canvas of the legacy root layout for
// the reward route only, and restore its original styles after leaving.
useEffect(()=>{
 const elements=[document.documentElement,document.body];
 const previous=elements.map(el=>({value:el.style.getPropertyValue("background-color"),priority:el.style.getPropertyPriority("background-color")}));
 elements.forEach(el=>el.style.setProperty("background-color","#edf3fa","important"));
 return()=>elements.forEach((el,i)=>{
  if(previous[i].value)el.style.setProperty("background-color",previous[i].value,previous[i].priority);
  else el.style.removeProperty("background-color");
 });
},[]);
async function refreshRewards(){
 setRewardLoading(true);
 try{
  const {data,error}=await supabase.rpc("get_my_event_rewards");
  if(error)throw error;
  setRewardRecords(Array.isArray(data)?data:[]);
  setRewardError(false);
 }catch{
  setRewardError(true);
 }finally{
  setRewardLoading(false);
 }
}
async function openGiftDelivery(id){
 if(giftOpening||isDesignUiLocked())return;
 setGiftOpening(id);setNotice("");
 const tab=window.open("about:blank","_blank");
 try{
  const {data,error}=await supabase.rpc("get_my_gift_link",{p_delivery_id:id});
  if(error||!/^https?:\/\//i.test(String(data||"")))throw new Error(error?.message||"상품 링크가 유효하지 않습니다.");
  if(tab){tab.opener=null;tab.location.replace(data)}else window.location.assign(data);
  await refreshRewards();
 }catch(e){
  if(tab&&!tab.closed)tab.close();
  setNotice("기프티콘 확인 실패: "+(e?.message||"지급 내역을 확인해주세요."));
 }finally{setGiftOpening("")}
}
async function refresh(id){const {data,error}=await supabase.from("private_messages").select("*").eq("chat_id",id).eq("is_deleted",false).order("created_at",{ascending:false}).limit(200);if(error)setNotice("지급 메시지를 불러오지 못했습니다.");else setMessages([...(data||[])].reverse())}
useEffect(()=>{let alive=true;async function boot(){try{
 if(isDesignUiLocked()){if(alive){setAccessState("locked");setLoading(false)}return}
 if(typeof navigator!=="undefined"&&"serviceWorker" in navigator){try{await navigator.serviceWorker.register("/sw.js",{scope:"/"});}catch{}}
 const {data:{user:currentUser},error:authError}=await supabase.auth.getUser();
 if(!alive)return;
 if(!currentUser){setAccessState("login");setLoading(false);return}
 if(authError)throw authError;
 const {data:profile,error:profileError}=await supabase.from("profiles").select("role,approval_status").eq("id",currentUser.id).maybeSingle();
 if(!alive)return;
 if(profileError)throw profileError;
 if(!isApprovedProfile(profile)){setAccessState("unapproved");setNotice("승인된 회원만 이용할 수 있습니다.");setLoading(false);return}
 if(profile.role==="admin"){setAccessState("admin");setNotice("관리자 지급 관리는 기존 관리자 화면을 이용하세요.");setLoading(false);return}
 setUser(currentUser);
 await refreshRewards();
 const {data:unread}=await supabase.rpc("get_my_private_unread_count");
 if(alive)setUnreadAtOpen(Number(unread||0));
 const {data:id,error}=await supabase.rpc("get_or_create_admin_chat");
 if(!alive)return;
 if(error||!id){setAccessState("error");setNotice("상품 지급 메시지함 연결에 실패했습니다.");setLoading(false);return}
 setChat(id);await supabase.rpc("mark_private_chat_read",{target_chat_id:id});await refresh(id);
 if(alive){setAccessState("member");setLoading(false)}
 }catch(e){if(alive){setAccessState("error");setNotice("상품 지급센터 정보를 불러오지 못했습니다.");setLoading(false)}}}
 void boot();return()=>{alive=false;if(toastTimerRef.current)clearTimeout(toastTimerRef.current)}},[]);
useEffect(()=>observeDesignUiLock(()=>{setChat(null);setUser(null);setMessages([]);setAccessState("locked");setLoading(false)}),[]);
useEffect(()=>{if(!chat||!user?.id)return;
 const notify=payload=>{
  if(isDesignUiLocked()||payload.eventType!=="INSERT"||payload.new?.sender_id===user.id)return;
  const preview=messagePreview(payload.new?.content);
  setToast("새 상품 지급 메시지 · "+preview);
  if(toastTimerRef.current)clearTimeout(toastTimerRef.current);
  toastTimerRef.current=setTimeout(()=>setToast(""),5500);
  if(typeof window!=="undefined"&&"Notification" in window&&Notification.permission==="granted"){
   try{new Notification("AI PROCESS VIP · 상품 지급",{body:preview,icon:"/avatars/admin.png.png"})}catch{}
  }
 };
 const channel=supabase.channel("design-reward-"+chat).on("postgres_changes",{event:"*",schema:"public",table:"private_messages",filter:"chat_id=eq."+chat},payload=>{
  notify(payload);
  void refresh(chat);
  if(payload.eventType==="INSERT"&&payload.new?.sender_id!==user.id&&document.visibilityState==="visible"&&!isDesignUiLocked())void supabase.rpc("mark_private_chat_read",{target_chat_id:chat});
 }).subscribe();
 const onFocus=()=>{if(isDesignUiLocked()){setChat(null);setUser(null);setMessages([]);setAccessState("locked");return}if(document.visibilityState==="visible"){void supabase.rpc("mark_private_chat_read",{target_chat_id:chat});void refresh(chat);void refreshRewards()}};
 document.addEventListener("visibilitychange",onFocus);window.addEventListener("focus",onFocus);
 const rewardTimer=setInterval(()=>{if(document.visibilityState==="visible"&&!isDesignUiLocked())void refreshRewards()},30000);
 return()=>{clearInterval(rewardTimer);supabase.removeChannel(channel);document.removeEventListener("visibilitychange",onFocus);window.removeEventListener("focus",onFocus)}
},[chat,user?.id]);
useEffect(()=>{if(messageBoxRef.current)messageBoxRef.current.scrollTop=messageBoxRef.current.scrollHeight},[messages.length,chat]);
async function enablePrivateNotifications(){
 if(!user||isDesignUiLocked()){setNotice("회원 입장 화면에서 잠금을 해제한 뒤 알림을 설정하세요.");return}
 if(typeof window==="undefined"||!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){setNotice("이 기기에서는 푸시 알림을 지원하지 않습니다.");return}
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
 const standalone=window.matchMedia?.("(display-mode: standalone)")?.matches||navigator.standalone===true;
 if(ios&&!standalone){setNotice("아이폰은 홈 화면에 앱을 추가하고 앱으로 실행한 뒤 알림을 설정해주세요.");return}
 setPushWorking(true);setNotice("");
 try{
 let permission=Notification.permission;
 if(permission==="default")permission=await Notification.requestPermission();
 if(permission!=="granted"){setNotice(permission==="denied"?"브라우저 알림 권한이 차단되어 있습니다.":"알림이 허용되지 않았습니다.");return}
 const registration=await navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"});
 await registration.update().catch(()=>{});
 let subscription=await registration.pushManager.getSubscription();
 if(!subscription){const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!key)throw new Error("알림 설정 정보를 확인할 수 없습니다.");subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)})}
 const json=subscription.toJSON();
 if(!json.endpoint||!json.keys?.p256dh||!json.keys?.auth)throw new Error("알림 구독 정보를 만들지 못했습니다.");
 const {error}=await supabase.from("push_subscriptions").upsert({user_id:user.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:"endpoint"});
 if(error)throw error;
 setPushEnabled(true);setNotice("상품 지급 알림이 설정되었습니다.");
 }catch(e){setNotice("알림 설정 실패: "+(e?.message||"알 수 없는 오류"))}finally{setPushWorking(false)}
}
async function sendPush(targetChat,content){try{const {data}=await supabase.auth.getSession();const token=data?.session?.access_token;if(!token)return;await fetch("/api/push/private-message",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},cache:"no-store",body:JSON.stringify({chatId:targetChat,content,destination:"design-reward"})})}catch{}}
async function send(e){e.preventDefault();const content=text.trim();if(!content||!chat||!user||sending||isDesignUiLocked())return;setSending(true);setNotice("");try{const {error}=await supabase.from("private_messages").insert({chat_id:chat,sender_id:user.id,message_type:"text",content,is_deleted:false,is_read:false});if(error){setNotice("메시지 전송 실패: "+error.message)}else{setText("");await refresh(chat);void sendPush(chat,content)}}catch{setNotice("메시지 전송 중 오류가 발생했습니다.")}finally{setSending(false)}}
const gifts=messages.filter(m=>String(m.content||"").startsWith("[[GIFT_REWARD]]")||String(m.content||"").startsWith("[[GIFT]]")).length;
const pendingRewards=rewardRecords.filter(r=>r.status==="pending"||r.status==="ready").length;
return <div className="stage reward-viewport"><div className="shell"><header className="reward-topbar"><HomeReturnLink/><b className="reward-wordmark">AI PROCESS</b></header><main><div className="kicker">REWARD CENTER</div><h1>상품 지급센터</h1><p className="sub">이벤트와 출석 혜택으로 받은 상품을 확인하세요.</p><section className="summary"><div><small>지급 안내</small><strong>{loading?<span className="summary-pending" role="status">확인 중</span>:<>{gifts}<em>건</em></>}</strong></div><div><small>메시지</small><strong>{loading?<span className="summary-pending" role="status">확인 중</span>:<>{messages.length}<em>건</em></>}</strong></div></section><section className="benefits"><strong>VIP 이벤트 및 출석 혜택</strong><p>시간별 이벤트는 회차당 1회 참여할 수 있으며, 당첨 상품은 상품지급센터로 안내됩니다.</p><p>출석은 하루 1회, 누적 30회 달성 시 기프티콘 보상이 지급될 수 있습니다. 연속 출석이 아니어도 누적 횟수로 인정됩니다.</p><div className="reward-benefit-links"><Link href="/design-event" className="reward-benefit-link"><span className="reward-benefit-icon" aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z"/><path d="M12 5v14" strokeDasharray="2.4 3.2"/></svg></span><span className="reward-benefit-copy"><strong>시간별 이벤트</strong><small>진행 회차 확인</small></span><span className="reward-benefit-chevron" aria-hidden="true">›</span></Link><Link href="/design-attendance" className="reward-benefit-link"><span className="reward-benefit-icon" aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 6 2.5 2.5L16 13"/></svg></span><span className="reward-benefit-copy"><strong>출석 이벤트</strong><small>출석·누적 혜택</small></span><span className="reward-benefit-chevron" aria-hidden="true">›</span></Link></div></section>{user&&<section className="reward-history"><div className="reward-history-heading"><strong>상품 지급 처리 현황</strong><span>{rewardLoading?"확인 중":rewardError?"조회 오류":`지급 대기·준비 ${pendingRewards}건`}</span></div>{rewardError?<p className="reward-history-empty" role="status">지급 처리 내역을 불러오지 못했습니다. 페이지를 다시 열어 확인해주세요.</p>:rewardLoading&&rewardRecords.length===0?<p className="reward-history-empty">지급 내역 확인 중...</p>:rewardRecords.length===0?<p className="reward-history-empty">등록된 지급 처리 내역이 없습니다.</p>:<div className="reward-history-list">{rewardRecords.slice(0,10).map(r=><div key={r.id} className="reward-history-row"><div><b>{r.reward_name||"상품 지급 안내"}</b><small>{r.created_at?new Date(r.created_at).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"}):""}{r.event_id?" · 이벤트":" · 출석 보상"}</small></div><span className={r.status==="delivered"?"reward-status-delivered":"reward-status-pending"}>{r.status==="delivered"?"지급 완료":r.status==="ready"?"지급 준비":"지급 대기"}</span></div>)}</div>}<p className="reward-history-foot">지급 대기·준비는 상품 전달 완료가 아닙니다. 실제 기프티콘은 아래 지급 메시지에서 확인해주세요.</p></section>}<section className="inbox"><div className="heading"><h2>지급 메시지</h2><span>{unreadAtOpen>0?`입장 전 미확인 ${unreadAtOpen}건`:"회원 전용"}</span></div>{user&&chat&&<div className="reward-actions"><button type="button" onClick={enablePrivateNotifications} disabled={pushWorking||pushEnabled}>{pushWorking?"알림 설정 중":pushEnabled?"🔔 알림 사용 중":"🔔 상품 지급 알림 허용"}</button></div>}{loading?<p className="empty">불러오는 중...</p>:accessState!=="member"?<div className="empty">{accessState==="locked"?"회원 입장 화면에서 잠금을 해제해주세요.":accessState==="login"?"회원 로그인 후 이용할 수 있습니다.":accessState==="unapproved"?"관리자 승인 후 상품지급센터를 이용할 수 있습니다.":accessState==="admin"?"관리자 지급 관리는 기존 관리자 화면에서 확인하세요.":"상품 지급 메시지 연결을 확인해주세요."}{(accessState==="login"||accessState==="locked")&&<PageActionLink href="/design-entry?next=%2Fdesign-reward" label="회원 입장" detail="로그인 후 지급 내역 확인" icon="gift"/>}{accessState==="admin"&&<PageActionLink href="/?tab=private" label="관리자 문의 관리" detail="AI 프로젝트 관리자 화면" icon="admin"/>}</div>:messages.length===0?<div className="empty reward-no-messages" role="status"><div className="reward-no-messages-symbol" aria-hidden="true"><svg viewBox="0 0 48 48" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 12h32v22H19L8 41V12Z"/><path d="m16 23 5 5 10-11"/></svg></div><strong>아직 도착한 지급 메시지가 없습니다</strong><p>이벤트 당첨이나 출석 혜택 안내가 도착하면 이곳에서 확인할 수 있습니다.</p></div>:<div className="messages" ref={messageBoxRef}>{messages.map(m=><div key={m.id} className={m.sender_id===user.id?"bubble mine":"bubble"}><Message value={m.content} onOpenAi={()=>window.location.assign("/design-ai-process")} onOpenGift={openGiftDelivery} openingGift={giftOpening}/><small>{m.created_at?new Date(m.created_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):""}</small></div>)}</div>}{notice&&<p role="alert" className="notice">{notice}</p>}{toast&&<p role="status" className="reward-toast">{toast}</p>}{chat&&<form onSubmit={send}><input aria-label="메시지" placeholder="문의 내용을 입력하세요" value={text} onChange={e=>setText(e.target.value)}/><button disabled={sending||!text.trim()}>{sending?"전송 중":"전송"}</button></form>}</section></main><MemberNav current="reward"/><style jsx>{`.stage{min-height:100vh;width:100%;word-break:keep-all;overflow-wrap:break-word;background:#edf3fa;padding:20px 12px;font-family:Arial,"Noto Sans KR",sans-serif;color:#142642}.shell{max-width:440px;min-height:100vh;margin:auto;background:#f8faff;box-shadow:0 15px 55px #25476c1d;position:relative;padding-bottom:85px}header{display:flex;justify-content:space-between;padding:26px 22px}header a{text-decoration:none;color:#48617f;font-size:14px}header b{color:#086ee5}main{padding:20px 16px}.kicker{color:#086ee5;font-size:11px;font-weight:800;letter-spacing:2px}h1{font-size:29px;letter-spacing:-1px;margin:12px 0}.sub{font-size:14px;color:#71819a;line-height:1.7}.summary{display:flex;background:#102d56;color:white;border-radius:16px;margin:28px 0 15px;padding:24px 20px}.summary div{width:50%}.summary small{display:block;color:#c5d5ea;font-size:12px}.summary strong{display:block;font-size:35px;margin-top:12px}.summary em{font-size:13px;font-style:normal;margin-left:4px}.summary .summary-pending{display:inline-block;min-height:39px;padding-top:7px;font-size:15px;font-weight:700;color:#d6e7f8}.benefits{background:white;border:1px solid #e5edf7;border-radius:12px;padding:14px 16px;margin-bottom:12px}.benefits strong{font-size:13px}.benefits p{font-size:14px;color:#657990;line-height:1.75;margin:8px 0}.inbox{background:white;border:1px solid #e5edf7;border-radius:16px;min-height:340px;padding:18px 15px}.heading{display:flex;justify-content:space-between;align-items:center}.heading h2{font-size:17px}.heading span{font-size:12px;color:#7c8ca3}.empty{font-size:13px;color:#8493a9;text-align:center;padding:50px 10px}.empty a{color:#086ee5}.reward-no-messages{display:flex;align-items:center;flex-direction:column;justify-content:center;gap:10px;min-height:210px;padding:32px 14px}.reward-no-messages-symbol{width:62px;height:62px;display:grid;place-items:center;border-radius:18px;background:#edf5ff;border:1px solid #d7e9ff;color:#2372ce}.reward-no-messages strong{font-size:14px;line-height:1.6;color:#243f63;font-weight:800}.reward-no-messages p{max-width:250px;font-size:12px;line-height:1.8;color:#7b8da4;margin:0}.messages{display:flex;flex-direction:column;gap:12px;max-height:470px;overflow-y:auto;padding:12px 0}.bubble{background:#f1f5fa;border-radius:12px;padding:13px;max-width:90%;font-size:14px;line-height:1.7;align-self:flex-start;overflow-wrap:anywhere}.bubble.mine{align-self:flex-end;background:#e4f0ff}.bubble small{display:block;font-size:10px;color:#8a9bb1;margin-top:8px}.notice{font-size:12px;color:#b13c3c}form{display:flex;gap:7px;border-top:1px solid #edf1f6;padding-top:14px;margin-top:15px}input{flex:1;min-width:0;padding:12px;border:1px solid #dae5f0;border-radius:9px}form button{border:0;border-radius:9px;background:#086ee5;color:white;padding:0 16px;font-weight:700}form button:disabled{opacity:.5}nav{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-around;align-items:center;height:72px;background:white;border-top:1px solid #e6edf6;font-size:10px}nav a,nav span{text-decoration:none;color:#71819a}nav span{color:#086ee5;font-weight:800}`}</style><style jsx global>{`html:has(.reward-viewport),body:has(.reward-viewport){background:#edf3fa!important}@media(max-width:500px){.reward-viewport{padding:0!important}.reward-viewport .shell{width:100%;max-width:none;box-shadow:none}.reward-viewport nav{position:fixed;bottom:0;left:50%;right:auto;transform:translateX(-50%);width:100%;max-width:440px;z-index:20;padding-bottom:env(safe-area-inset-bottom);height:calc(72px + env(safe-area-inset-bottom))}}.reward-actions{display:flex;justify-content:flex-end;margin:6px 0}.reward-actions button{border:1px solid #c6dafa;border-radius:7px;background:#f1f7ff;color:#145cb5;font-size:11px;padding:7px 10px;cursor:pointer}.reward-actions button:disabled{opacity:.65}.gift strong{font-size:13px}.gift a,.gift button{display:inline-block;background:#086ee5;color:white;text-decoration:none;border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.plain{white-space:pre-wrap;overflow-wrap:anywhere}.plain a{color:#086ee5;word-break:break-all}.reward-toast{background:#e8f4ff;border:1px solid #bcd9fa;padding:10px 12px;border-radius:9px;font-size:12px;color:#194a83}.gift p{font-size:12px}.reward-history{background:#fff;border:1px solid #e5edf7;border-radius:12px;padding:15px 16px;margin-bottom:12px}.reward-history-heading{display:flex;justify-content:space-between;align-items:center;gap:10px}.reward-history-heading strong{font-size:13px}.reward-history-heading span{font-size:11px;color:#51729c}.reward-history-empty{font-size:13px;color:#7a8ca4;line-height:1.7;margin:13px 0 0}.reward-history-list{margin-top:11px}.reward-history-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #edf2f8}.reward-history-row>div{min-width:0;flex:1}.reward-history-row b{display:block;font-size:12px;line-height:1.6;overflow-wrap:anywhere}.reward-history-row small{display:block;font-size:10px;color:#8395aa;margin-top:4px}.reward-history-row>span{font-size:10px;font-weight:700;white-space:nowrap;border-radius:5px;padding:5px 7px}.reward-status-pending{color:#936014;background:#fff3de}.reward-status-delivered{color:#168456;background:#e9f8f0}.reward-history-foot{font-size:12px;color:#7586a0;line-height:1.7;margin:9px 0 0}.reward-viewport .reward-topbar{align-items:center;padding:21px 22px 17px}.reward-viewport .reward-back{display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:6px 12px 6px 7px;border:1px solid #dae6f4;border-radius:10px;background:#fff;color:#24496f;text-decoration:none;font-size:13px;font-weight:800;box-shadow:0 2px 9px #18426c0a;transition:background .15s,border-color .15s}.reward-viewport .reward-back-icon{width:25px;height:25px;border-radius:7px;display:grid;place-items:center;background:#edf5ff;color:#086ee5}.reward-viewport .reward-back:hover{background:#f2f8ff;border-color:#aacaf0}.reward-viewport .reward-back:focus-visible,.reward-viewport .reward-benefit-link:focus-visible{outline:2px solid #0b70e7;outline-offset:2px}.reward-viewport .reward-wordmark{font-size:15px;font-weight:900;letter-spacing:1.3px;color:#086ee5}.reward-viewport .reward-benefit-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:14px}.reward-viewport .reward-benefit-link{display:flex;align-items:center;gap:8px;min-width:0;min-height:69px;padding:11px 10px;background:#f7faff;border:1px solid #dfe9f6;border-radius:11px;color:#18395e;text-decoration:none;transition:border-color .15s,background .15s,box-shadow .15s}.reward-viewport .reward-benefit-link:hover{background:#edf5ff;border-color:#a9cef5;box-shadow:0 4px 12px #2461a60d}.reward-viewport .reward-benefit-icon{display:grid;place-items:center;flex-shrink:0;width:31px;height:34px;border-radius:9px;background:#e4effe;color:#0a67d5}.reward-viewport .reward-benefit-copy{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1}.reward-viewport .reward-benefit-copy strong{display:block;font-size:11px;line-height:1.35;font-weight:800;color:#1a3b62;white-space:normal;word-break:keep-all;overflow-wrap:anywhere}.reward-viewport .reward-benefit-copy small{font-size:11px;line-height:1.4;color:#7187a2;white-space:normal;word-break:keep-all;overflow-wrap:anywhere}.reward-viewport .reward-benefit-chevron{font-size:18px;font-weight:700;line-height:1;color:#8ba4c3;flex-shrink:0}.reward-viewport nav a{color:#71819a;text-decoration:none}.reward-viewport nav a:focus-visible{outline:2px solid #0b70e7;outline-offset:2px}@media(max-width:365px){.reward-viewport .reward-benefit-links{gap:6px}.reward-viewport .reward-benefit-link{gap:5px;padding:10px 7px}.reward-viewport .reward-benefit-icon{width:27px;height:31px}.reward-viewport .reward-benefit-icon svg{width:18px;height:18px}.reward-viewport .reward-benefit-copy strong{font-size:11px}.reward-viewport .reward-benefit-copy small{font-size:11px}}`}</style></div></div>}
