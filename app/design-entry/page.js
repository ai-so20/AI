"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {supabase} from "../supabase";
import {normalizePasswordInput} from "../lib/ui-helpers";
import {isApprovedProfile,isDesignUiLocked} from "../lib/design-member-access";

const allowedDestinations=new Set([
  "/design-home","/design-ai-process","/design-event","/design-attendance","/design-reward"
]);
function getSafeDestination(){
  if(typeof window==="undefined")return "/design-home";
  try{
    const next=new URLSearchParams(window.location.search).get("next")||"";
    return allowedDestinations.has(next)?next:"/design-home";
  }catch{return "/design-home"}
}
function navigateAfterEntry(router,profile){
  if(typeof window!=="undefined"){
    window.localStorage.removeItem("vip-ui-locked");
    window.sessionStorage.setItem("vip-active-tab",profile?.role==="admin"?"admin":"home");
  }
  router.replace(profile?.role==="admin"?"/?tab=admin":getSafeDestination());
}

export default function DesignEntry(){
  const router=useRouter();
  const [nickname,setNickname]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [existing,setExisting]=useState(null);
  const [notice,setNotice]=useState("");

  useEffect(()=>{let active=true;
    async function check(){
      try{
        const {data:{user},error}=await supabase.auth.getUser();
        if(!active)return;
        if(error||!user){setLoading(false);return}
        const {data:profile,error:profileError}=await supabase.from("profiles")
          .select("id,nickname,approval_status,role").eq("id",user.id).maybeSingle();
        if(!active)return;
        if(profileError||!isApprovedProfile(profile)){setNotice("관리자 승인 후 이용할 수 있습니다.");setLoading(false);return}
        if(!isDesignUiLocked()){navigateAfterEntry(router,profile);return}
        setExisting(profile);
      }catch{if(active)setNotice("로그인 상태를 확인할 수 없습니다.")}
      finally{if(active)setLoading(false)}
    }
    void check();return()=>{active=false}
  },[router]);

  async function submit(e){
    e.preventDefault();
    const name=nickname.trim();
    if(working||!name||!password){setNotice("닉네임과 비밀번호를 입력해주세요.");return}
    setWorking(true);setNotice("");
    try{
      const normalized=normalizePasswordInput(password);
      const passwordCandidates=[...new Set([password,normalized,normalized.toUpperCase()].filter(Boolean))];
      const response=await fetch("/api/auth/login",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({nickname:name,passwordCandidates}),cache:"no-store"
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result?.accessToken||!result?.refreshToken){
        setNotice(result?.message||"닉네임 또는 비밀번호를 확인해주세요.");return
      }
      const {data,error}=await supabase.auth.setSession({
        access_token:result.accessToken,refresh_token:result.refreshToken
      });
      if(error||!data?.user){setNotice("회원 인증에 실패했습니다.");return}
      const {data:profile,error:profileError}=await supabase.from("profiles")
        .select("id,nickname,approval_status,role").eq("id",data.user.id).maybeSingle();
      if(profileError||!isApprovedProfile(profile)){
        await supabase.auth.signOut();
        setNotice("관리자 승인 후 이용할 수 있습니다.");return
      }
      setPassword("");
      navigateAfterEntry(router,profile);
    }catch{setNotice("로그인 중 오류가 발생했습니다.")}
    finally{setWorking(false)}
  }
  async function switchAccount(){
    if(working)return;
    setWorking(true);
    try{
      const {error}=await supabase.auth.signOut();
      if(error)throw error;
      setExisting(null);setNotice("");setNickname("");setPassword("");
      if(typeof window!=="undefined")window.localStorage.removeItem("vip-ui-locked");
    }catch{setNotice("계정 전환에 실패했습니다. 다시 시도해주세요.")}
    finally{setWorking(false)}
  }
  return <main className="design-entry"><div className="entry-shell">
    <header className="entry-header">
      <Link href="/design-home" className="back">‹ 홈</Link>
      <span className="wordmark"><strong>AI</strong> PROCESS</span>
    </header>
    <div className="entry-content">
      <span className="eyebrow">MEMBER ACCESS</span>
      <h1>안녕하세요.<br/>회원 입장을 시작합니다.</h1>
      <p className="intro">기존 AI 계정으로 로그인한 후<br/>이용하시던 화면으로 돌아갈 수 있습니다.</p>
      {loading?<p className="status" role="status">로그인 상태를 확인하고 있습니다.</p>:existing?
        <div className="entry-actions">
          <div className="member-detail"><small>확인된 회원 계정</small><strong>{existing.nickname||"회원"}</strong></div>
          <button type="button" onClick={()=>navigateAfterEntry(router,existing)} disabled={working}>잠금 해제 후 입장 <span>›</span></button>
          <button type="button" className="secondary" onClick={switchAccount} disabled={working}>다른 계정으로 로그인</button>
        </div>:
        <form onSubmit={submit}>
          <label htmlFor="design-nickname">닉네임</label>
          <input id="design-nickname" value={nickname} maxLength={40} onChange={e=>setNickname(e.target.value)} autoComplete="username" placeholder="가입 시 등록한 닉네임" required/>
          <label htmlFor="design-password">비밀번호</label>
          <input id="design-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="비밀번호 입력" required/>
          <button type="submit" disabled={working}>{working?"로그인 확인 중":"회원 로그인"} <span>›</span></button>
        </form>
      }
      {notice&&<p className="notice" role="alert">{notice}</p>}
      <div className="entry-note"><strong>회원 서비스 안내</strong><p>가입된 계정의 승인 상태를 확인한 후 이동합니다. 승인 대기 중인 계정은 이용할 수 없습니다.</p></div>
    </div>
    <footer className="entry-footer"><span>AI PROCESS</span><span>MEMBER SERVICE</span></footer>
  </div><style jsx>{`
    *{box-sizing:border-box}
    .design-entry{background:#e9eef4;min-height:100vh;padding:0 12px;color:#1d3047;font-family:"Pretendard Variable","Pretendard","Apple SD Gothic Neo","Malgun Gothic",Arial,sans-serif;-webkit-font-smoothing:antialiased}
    .entry-shell{width:min(100%,460px);min-height:100vh;margin:auto;background:#fff;box-shadow:0 0 48px #1f3a5912;display:flex;flex-direction:column}
    .entry-header{height:70px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e9edf2;padding:0 25px}
    .back{font-size:12px;color:#728198;text-decoration:none}
    .wordmark{font-size:16px;font-weight:840;letter-spacing:-.7px}
    .wordmark strong{color:#1867ba}
    .entry-content{padding:47px 26px 28px;flex:1}
    .eyebrow{font-size:10px;color:#336d9f;font-weight:800;letter-spacing:1.3px}
    h1{font-size:29px;line-height:1.42;letter-spacing:-1.3px;color:#192c45;margin:13px 0 12px;font-weight:810}
    .intro{font-size:12px;line-height:1.8;color:#78879a;margin:0 0 38px}
    form{display:flex;flex-direction:column;gap:0}
    label{font-size:12px;font-weight:760;color:#31475f;margin:0 0 9px}
    input{height:50px;border:1px solid #dae2ec;background:#fafcff;border-radius:7px;padding:0 13px;margin-bottom:23px;color:#1d3045;font-size:14px;outline:none}
    input:focus{border-color:#1c6abd;box-shadow:0 0 0 2px #c9e0f7}
    input::placeholder{color:#a1acba}
    button[type=submit],.entry-actions>button:first-of-type{width:100%;display:flex;justify-content:space-between;align-items:center;min-height:52px;border:0;border-radius:8px;background:#155fb5;color:white;padding:0 18px;font-weight:800;font-size:14px;cursor:pointer;margin-top:5px}
    button span{font-size:20px;font-weight:400}
    button:disabled{opacity:.6;cursor:default}
    .member-detail{border-top:2px solid #1b588e;border-bottom:1px solid #e6edf3;padding:22px 5px;margin-bottom:22px}
    .member-detail small{display:block;color:#8292a4;font-size:11px;margin-bottom:11px}
    .member-detail strong{font-size:22px;color:#1b3048}
    .entry-actions .secondary{width:100%;border:1px solid #dce6f0;color:#3b648b;background:#f6f9fd;border-radius:7px;margin-top:10px;min-height:45px;font-size:12px;font-weight:750;cursor:pointer}
    .status{color:#5f7085;font-size:12px;border-top:1px solid #e6ebf1;padding:22px 0}
    .notice{font-size:12px;color:#b23b44;line-height:1.65;margin:20px 0 0}
    .entry-note{border-top:1px solid #e5ebf2;margin-top:43px;padding:19px 1px}
    .entry-note strong{font-size:12px;color:#2b4865}
    .entry-note p{font-size:11px;color:#8390a0;line-height:1.75;margin:8px 0 0}
    .entry-footer{border-top:1px solid #eef1f5;padding:18px 26px 23px;display:flex;justify-content:space-between;color:#a1acb8;font-size:10px;letter-spacing:.3px}
    @media(max-width:500px){.design-entry{padding:0}.entry-shell{box-shadow:none}}
  `}</style></main>
}
