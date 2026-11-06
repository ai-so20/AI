"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {supabase} from "../supabase";
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
export default function DesignReward(){const [user,setUser]=useState(null),[chat,setChat]=useState(null),[messages,setMessages]=useState([]),[loading,setLoading]=useState(true),[notice,setNotice]=useState(""),[text,setText]=useState(""),[sending,setSending]=useState(false),[unreadAtOpen,setUnreadAtOpen]=useState(0),[toast,setToast]=useState("");const messageBoxRef=useRef(null),toastTimerRef=useRef(null);
async function refresh(id){const {data,error}=await supabase.from("private_messages").select("*").eq("chat_id",id).eq("is_deleted",false).order("created_at",{ascending:false}).limit(200);if(error)setNotice("지급 메시지를 불러오지 못했습니다.");else setMessages([...(data||[])].reverse())}
useEffect(()=>{let alive=true;async function boot(){try{
 if(typeof navigator!=="undefined"&&"serviceWorker" in navigator){try{await navigator.serviceWorker.register("/sw.js",{scope:"/"});}catch{}}
 const {data:{user:currentUser},error:authError}=await supabase.auth.getUser();
 if(!alive)return;
 if(authError)throw authError;
 if(!currentUser){setLoading(false);return}
 const {data:profile,error:profileError}=await supabase.from("profiles").select("role,approval_status").eq("id",currentUser.id).maybeSingle();
 if(!alive)return;
 if(profileError||!profile||String(profile.approval_status)!=="1"){setNotice("승인된 회원만 이용할 수 있습니다.");setLoading(false);return}
 setUser(currentUser);
 if(profile.role==="admin"){setNotice("관리자 지급 관리는 기존 관리자 화면을 이용하세요.");setLoading(false);return}
 const {data:unread}=await supabase.rpc("get_my_private_unread_count");
 if(alive)setUnreadAtOpen(Number(unread||0));
 const {data:id,error}=await supabase.rpc("get_or_create_admin_chat");
 if(!alive)return;
 if(error||!id){setNotice("상품 지급 메시지함 연결에 실패했습니다.");setLoading(false);return}
 setChat(id);await supabase.rpc("mark_private_chat_read",{target_chat_id:id});await refresh(id);
 if(alive)setLoading(false)
 }catch(e){if(alive){setNotice("상품 지급센터 정보를 불러오지 못했습니다.");setLoading(false)}}}
 void boot();return()=>{alive=false;if(toastTimerRef.current)clearTimeout(toastTimerRef.current)}},[]);
useEffect(()=>{if(!chat||!user?.id)return;
 const notify=payload=>{
  if(payload.eventType!=="INSERT"||payload.new?.sender_id===user.id)return;
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
  if(payload.eventType==="INSERT"&&payload.new?.sender_id!==user.id)void supabase.rpc("mark_private_chat_read",{target_chat_id:chat});
 }).subscribe();
 const onFocus=()=>{if(document.visibilityState==="visible"){void supabase.rpc("mark_private_chat_read",{target_chat_id:chat});void refresh(chat)}};
 document.addEventListener("visibilitychange",onFocus);window.addEventListener("focus",onFocus);
 return()=>{supabase.removeChannel(channel);document.removeEventListener("visibilitychange",onFocus);window.removeEventListener("focus",onFocus)}
},[chat,user?.id]);
useEffect(()=>{if(messageBoxRef.current)messageBoxRef.current.scrollTop=messageBoxRef.current.scrollHeight},[messages.length,chat]);
async function sendPush(targetChat,content){try{const {data}=await supabase.auth.getSession();const token=data?.session?.access_token;if(!token)return;await fetch("/api/push/private-message",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},cache:"no-store",body:JSON.stringify({chatId:targetChat,content,destination:"design-reward"})})}catch{}}
async function send(e){e.preventDefault();const content=text.trim();if(!content||!chat||!user||sending)return;setSending(true);const {error}=await supabase.from("private_messages").insert({chat_id:chat,sender_id:user.id,message_type:"text",content,is_deleted:false,is_read:false});if(error)setNotice("메시지 전송 실패: "+error.message);else{setText("");await refresh(chat)}setSending(false)}
const gifts=messages.filter(m=>String(m.content||"").startsWith("[[GIFT_REWARD]]")).length;
return <div className="stage"><div className="shell"><header><Link href="/design-home">‹ 홈</Link><b>AI</b></header><main><div className="kicker">REWARD CENTER</div><h1>상품 지급센터</h1><p className="sub">이벤트와 출석 혜택으로 받은 상품을 확인하세요.</p><section className="summary"><div><small>지급 안내</small><strong>{loading?"—":gifts}<em>건</em></strong></div><div><small>메시지</small><strong>{loading?"—":messages.length}<em>건</em></strong></div></section><section className="inbox"><div className="heading"><h2>지급 메시지</h2><span>회원 전용</span></div>{loading?<p className="empty">불러오는 중...</p>:!user?<div className="empty">로그인 후 이용할 수 있습니다.<p><Link href="/">회원 로그인</Link></p></div>:messages.length===0?<p className="empty">도착한 메시지가 없습니다.</p>:<div className="messages">{messages.map(m=><div key={m.id} className={m.sender_id===user.id?"bubble mine":"bubble"}><Message value={m.content}/><small>{m.created_at?new Date(m.created_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):""}</small></div>)}</div>}{notice&&<p role="status" className="notice">{notice}</p>}{chat&&<form onSubmit={send}><input aria-label="메시지" placeholder="문의 내용을 입력하세요" value={text} onChange={e=>setText(e.target.value)}/><button disabled={sending||!text.trim()}>{sending?"전송 중":"전송"}</button></form>}</section></main><nav><Link href="/design-home">홈</Link><Link href="/?tab=event">이벤트</Link><Link href="/design-attendance">출석</Link><Link href="/design-ai-process">AI PROCESS</Link><span>상품 지급</span></nav><style jsx>{`.stage{min-height:100vh;background:#edf3fa;padding:20px 12px;font-family:Arial,"Noto Sans KR",sans-serif;color:#142642}.shell{max-width:440px;min-height:100vh;margin:auto;background:#f8faff;box-shadow:0 15px 55px #25476c1d;position:relative;padding-bottom:85px}header{display:flex;justify-content:space-between;padding:26px 22px}header a{text-decoration:none;color:#48617f;font-size:14px}header b{color:#086ee5}main{padding:20px 16px}.kicker{color:#086ee5;font-size:11px;font-weight:800;letter-spacing:2px}h1{font-size:29px;letter-spacing:-1px;margin:12px 0}.sub{font-size:13px;color:#71819a;line-height:1.7}.summary{display:flex;background:#102d56;color:white;border-radius:16px;margin:28px 0 15px;padding:24px 20px}.summary div{width:50%}.summary small{display:block;color:#c5d5ea;font-size:12px}.summary strong{display:block;font-size:35px;margin-top:12px}.summary em{font-size:13px;font-style:normal;margin-left:4px}.inbox{background:white;border:1px solid #e5edf7;border-radius:16px;min-height:340px;padding:18px 15px}.heading{display:flex;justify-content:space-between;align-items:center}.heading h2{font-size:17px}.heading span{font-size:12px;color:#7c8ca3}.empty{font-size:13px;color:#8493a9;text-align:center;padding:50px 10px}.empty a{color:#086ee5}.messages{display:flex;flex-direction:column;gap:12px;max-height:470px;overflow-y:auto;padding:12px 0}.bubble{background:#f1f5fa;border-radius:12px;padding:13px;max-width:90%;font-size:13px;line-height:1.7;align-self:flex-start;overflow-wrap:anywhere}.bubble.mine{align-self:flex-end;background:#e4f0ff}.bubble small{display:block;font-size:10px;color:#8a9bb1;margin-top:8px}.notice{font-size:12px;color:#b13c3c}form{display:flex;gap:7px;border-top:1px solid #edf1f6;padding-top:14px;margin-top:15px}input{flex:1;min-width:0;padding:12px;border:1px solid #dae5f0;border-radius:9px}form button{border:0;border-radius:9px;background:#086ee5;color:white;padding:0 16px;font-weight:700}form button:disabled{opacity:.5}nav{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-around;align-items:center;height:72px;background:white;border-top:1px solid #e6edf6;font-size:10px}nav a,nav span{text-decoration:none;color:#71819a}nav span{color:#086ee5;font-weight:800}`}</style><style jsx global>{`.gift strong{font-size:13px}.gift a{display:inline-block;background:#086ee5;color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:700}.gift p{font-size:12px}`}</style></div></div>}
