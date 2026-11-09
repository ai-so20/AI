"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {supabase} from "../supabase";
import {isApprovedProfile,isDesignUiLocked,observeDesignUiLock} from "../lib/design-member-access";
function urlBase64ToUint8Array(base64String){const padding="=".repeat((4-(base64String.length%4))%4);const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from([...window.atob(base64)].map(x=>x.charCodeAt(0)))}
function Message({value,onOpenAi}){
 const raw=String(value||"");
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
 for(const p of ["[[GIFT_REWARD]]","[[VIP_SURPRISE_LINK]]","[[LINK_BUTTON]]"]){if(text.startsWith(p)){try{const data=JSON.parse(text.slice(p.length));return String(data.product_name||data.text||data.button_text||"새 상품 지급 안내").slice(0,140)}catch{return "새 상품 지급 안내"}}}
 return text.replace(/\s+/g," ").slice(0,140);
}
export default function DesignReward(){const [user,setUser]=useState(null),[chat,setChat]=useState(null),[messages,setMessages]=useState([]),[loading,setLoading]=useState(true),[accessState,setAccessState]=useState("loading"),[notice,setNotice]=useState(""),[text,setText]=useState(""),[sending,setSending]=useState(false),[unreadAtOpen,setUnreadAtOpen]=useState(0),[toast,setToast]=useState(""),[pushWorking,setPushWorking]=useState(false),[pushEnabled,setPushEnabled]=useState(false);const [rewardRecords,setRewardRecords]=useState([]),[rewardLoading,setRewardLoading]=useState(false),[rewardError,setRewardError]=useState(false);const messageBoxRef=useRef(null),toastTimerRef=useRef(null);
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
 return()=>{supabase.removeChannel(channel);document.removeEventListener("visibilitychange",onFocus);window.removeEventListener("focus",onFocus)}
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
const gifts=messages.filter(m=>String(m.content||"").startsWith("[[GIFT_REWARD]]")).length;
const pendingRewards=rewardRecords.filter(r=>r.status==="pending"||r.status==="ready").length;
return <div className="stage reward-viewport"><div className="shell"><header><Link href="/design-home">‹ 홈</Link><b>AI</b></header><main><div className="kicker">REWARD CENTER</div><h1>상품 지급센터</h1><p className="sub">이벤트와 출석 혜택으로 받은 상품을 확인하세요.</p><section className="summary"><div><small>지급 안내</small><strong>{loading?"—":gifts}<em>건</em></strong></div><div><small>메시지</small><strong>{loading?"—":messages.length}<em>건</em></strong></div></section><section className="benefits"><strong>VIP 이벤트 및 출석 혜택</strong><p>시간별 이벤트는 회차당 1회 참여할 수 있으며, 당첨 상품은 상품지급센터로 안내됩니다.</p><p>출석은 하루 1회, 누적 30회 달성 시 기프티콘 보상이 지급될 수 있습니다. 연속 출석이 아니어도 누적 횟수로 인정됩니다.</p><div><Link href="/design-event">시간별 이벤트</Link><Link href="/design-attendance">출석 이벤트</Link></div></section>{user&&<section className="reward-history"><div className="reward-history-heading"><strong>상품 지급 처리 현황</strong><span>{rewardLoading?"확인 중":rewardError?"조회 오류":`지급 대기·준비 ${pendingRewards}건`}</span></div>{rewardError?<p className="reward-history-empty" role="status">지급 처리 내역을 불러오지 못했습니다. 페이지를 다시 열어 확인해주세요.</p>:rewardLoading&&rewardRecords.length===0?<p className="reward-history-empty">지급 내역 확인 중...</p>:rewardRecords.length===0?<p className="reward-history-empty">등록된 지급 처리 내역이 없습니다.</p>:<div className="reward-history-list">{rewardRecords.slice(0,10).map(r=><div key={r.id} className="reward-history-row"><div><b>{r.reward_name||"상품 지급 안내"}</b><small>{r.created_at?new Date(r.created_at).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"}):""}{r.event_id?" · 이벤트":" · 출석 보상"}</small></div><span className={r.status==="delivered"?"reward-status-delivered":"reward-status-pending"}>{r.status==="delivered"?"지급 완료":r.status==="ready"?"지급 준비":"지급 대기"}</span></div>)}</div>}<p className="reward-history-foot">지급 대기·준비는 상품 전달 완료가 아닙니다. 실제 기프티콘은 아래 지급 메시지에서 확인해주세요.</p></section>}<section className="inbox"><div className="heading"><h2>지급 메시지</h2><span>{unreadAtOpen>0?`입장 전 미확인 ${unreadAtOpen}건`:"회원 전용"}</span></div>{user&&chat&&<div className="reward-actions"><button type="button" onClick={enablePrivateNotifications} disabled={pushWorking||pushEnabled}>{pushWorking?"알림 설정 중":pushEnabled?"🔔 알림 사용 중":"🔔 상품 지급 알림 허용"}</button></div>}{loading?<p className="empty">불러오는 중...</p>:accessState!=="member"?<div className="empty">{accessState==="locked"?"회원 입장 화면에서 잠금을 해제해주세요.":accessState==="login"?"회원 로그인 후 이용할 수 있습니다.":accessState==="unapproved"?"관리자 승인 후 상품지급센터를 이용할 수 있습니다.":accessState==="admin"?"관리자 지급 관리는 기존 관리자 화면에서 확인하세요.":"상품 지급 메시지 연결을 확인해주세요."}{(accessState==="login"||accessState==="locked")&&<p><Link href="/design-entry?next=%2Fdesign-reward">회원 입장</Link></p>}{accessState==="admin"&&<p><Link href="/?tab=private">AI 프로젝트 1:1 문의 관리로 이동 ›</Link></p>}</div>:messages.length===0?<p className="empty">도착한 메시지가 없습니다.</p>:<div className="messages" ref={messageBoxRef}>{messages.map(m=><div key={m.id} className={m.sender_id===user.id?"bubble mine":"bubble"}><Message value={m.content} onOpenAi={()=>window.location.assign("/design-ai-process")}/><small>{m.created_at?new Date(m.created_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):""}</small></div>)}</div>}{notice&&<p role="alert" className="notice">{notice}</p>}{toast&&<p role="status" className="reward-toast">{toast}</p>}{chat&&<form onSubmit={send}><input aria-label="메시지" placeholder="문의 내용을 입력하세요" value={text} onChange={e=>setText(e.target.value)}/><button disabled={sending||!text.trim()}>{sending?"전송 중":"전송"}</button></form>}</section></main><nav><Link href="/design-home">홈</Link><Link href="/design-event">이벤트</Link><Link href="/design-attendance">출석</Link><Link href="/design-ai-process">AI PROCESS</Link><span>상품 지급</span></nav><style jsx>{`.stage{min-height:100vh;width:100%;background:#edf3fa;padding:20px 12px;font-family:Arial,"Noto Sans KR",sans-serif;color:#142642}.shell{max-width:440px;min-height:100vh;margin:auto;background:#f8faff;box-shadow:0 15px 55px #25476c1d;position:relative;padding-bottom:85px}header{display:flex;justify-content:space-between;padding:26px 22px}header a{text-decoration:none;color:#48617f;font-size:14px}header b{color:#086ee5}main{padding:20px 16px}.kicker{color:#086ee5;font-size:11px;font-weight:800;letter-spacing:2px}h1{font-size:29px;letter-spacing:-1px;margin:12px 0}.sub{font-size:13px;color:#71819a;line-height:1.7}.summary{display:flex;background:#102d56;color:white;border-radius:16px;margin:28px 0 15px;padding:24px 20px}.summary div{width:50%}.summary small{display:block;color:#c5d5ea;font-size:12px}.summary strong{display:block;font-size:35px;margin-top:12px}.summary em{font-size:13px;font-style:normal;margin-left:4px}.benefits{background:white;border:1px solid #e5edf7;border-radius:12px;padding:14px 16px;margin-bottom:12px}.benefits strong{font-size:13px}.benefits p{font-size:11px;color:#657990;line-height:1.7;margin:8px 0}.benefits>div{display:flex;gap:14px}.benefits a{font-size:11px;color:#0b70e7;text-decoration:none;font-weight:700}.inbox{background:white;border:1px solid #e5edf7;border-radius:16px;min-height:340px;padding:18px 15px}.heading{display:flex;justify-content:space-between;align-items:center}.heading h2{font-size:17px}.heading span{font-size:12px;color:#7c8ca3}.empty{font-size:13px;color:#8493a9;text-align:center;padding:50px 10px}.empty a{color:#086ee5}.messages{display:flex;flex-direction:column;gap:12px;max-height:470px;overflow-y:auto;padding:12px 0}.bubble{background:#f1f5fa;border-radius:12px;padding:13px;max-width:90%;font-size:13px;line-height:1.7;align-self:flex-start;overflow-wrap:anywhere}.bubble.mine{align-self:flex-end;background:#e4f0ff}.bubble small{display:block;font-size:10px;color:#8a9bb1;margin-top:8px}.notice{font-size:12px;color:#b13c3c}form{display:flex;gap:7px;border-top:1px solid #edf1f6;padding-top:14px;margin-top:15px}input{flex:1;min-width:0;padding:12px;border:1px solid #dae5f0;border-radius:9px}form button{border:0;border-radius:9px;background:#086ee5;color:white;padding:0 16px;font-weight:700}form button:disabled{opacity:.5}nav{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-around;align-items:center;height:72px;background:white;border-top:1px solid #e6edf6;font-size:10px}nav a,nav span{text-decoration:none;color:#71819a}nav span{color:#086ee5;font-weight:800}`}</style><style jsx global>{`html:has(.reward-viewport),body:has(.reward-viewport){background:#edf3fa!important}@media(max-width:500px){.reward-viewport{padding:0!important}.reward-viewport .shell{width:100%;max-width:none;box-shadow:none}.reward-viewport nav{position:fixed;bottom:0;left:50%;right:auto;transform:translateX(-50%);width:100%;max-width:440px;z-index:20;padding-bottom:env(safe-area-inset-bottom);height:calc(72px + env(safe-area-inset-bottom))}}.reward-actions{display:flex;justify-content:flex-end;margin:6px 0}.reward-actions button{border:1px solid #c6dafa;border-radius:7px;background:#f1f7ff;color:#145cb5;font-size:11px;padding:7px 10px;cursor:pointer}.reward-actions button:disabled{opacity:.65}.gift strong{font-size:13px}.gift a,.gift button{display:inline-block;background:#086ee5;color:white;text-decoration:none;border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.plain{white-space:pre-wrap;overflow-wrap:anywhere}.plain a{color:#086ee5;word-break:break-all}.reward-toast{background:#e8f4ff;border:1px solid #bcd9fa;padding:10px 12px;border-radius:9px;font-size:12px;color:#194a83}.gift p{font-size:12px}.reward-history{background:#fff;border:1px solid #e5edf7;border-radius:12px;padding:15px 16px;margin-bottom:12px}.reward-history-heading{display:flex;justify-content:space-between;align-items:center;gap:10px}.reward-history-heading strong{font-size:13px}.reward-history-heading span{font-size:11px;color:#51729c}.reward-history-empty{font-size:12px;color:#7a8ca4;line-height:1.7;margin:13px 0 0}.reward-history-list{margin-top:11px}.reward-history-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #edf2f8}.reward-history-row>div{min-width:0;flex:1}.reward-history-row b{display:block;font-size:12px;line-height:1.6;overflow-wrap:anywhere}.reward-history-row small{display:block;font-size:10px;color:#8395aa;margin-top:4px}.reward-history-row>span{font-size:10px;font-weight:700;white-space:nowrap;border-radius:5px;padding:5px 7px}.reward-status-pending{color:#936014;background:#fff3de}.reward-status-delivered{color:#168456;background:#e9f8f0}.reward-history-foot{font-size:11px;color:#7586a0;line-height:1.7;margin:9px 0 0}`}</style></div></div>}
