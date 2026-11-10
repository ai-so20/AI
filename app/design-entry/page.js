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
  const [realName,setRealName]=useState("");
  const [signupMode,setSignupMode]=useState(false);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [existing,setExisting]=useState(null);
  const [notice,setNotice]=useState("");

  useEffect(()=>{if(typeof window!=="undefined" && new URLSearchParams(window.location.search).get("legacy")==="1")setSignupMode(true);},[]);

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
        const accountSwitchRequested=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("switch")==="1";
        if(!isDesignUiLocked()&&!accountSwitchRequested){navigateAfterEntry(router,profile);return}
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
  async function submitSignup(e){
    e.preventDefault();
    const name=nickname.trim(),person=realName.trim();
    if(working)return;
    if(!name||!person||!password){setNotice("닉네임, 성함, 비밀번호를 모두 입력해주세요.");return}
    if(password.length<4){setNotice("비밀번호는 4자리 이상 입력해주세요.");return}
    setWorking(true);setNotice("");
    try{
      const response=await fetch("/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({nickname:name,realName:person,password:normalizePasswordInput(password)})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){setNotice(result?.message||"가입 신청 중 오류가 발생했습니다.");return}
      setNickname("");setRealName("");setPassword("");setSignupMode(false);
      setNotice("가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
    }catch{setNotice("가입 신청 중 오류가 발생했습니다.")}
    finally{setWorking(false)}
  }
  async function enterExisting(){
    if(working||!existing)return;
    setWorking(true);setNotice("");
    try{
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(authError||!user){setExisting(null);setNotice("로그인이 만료되었습니다. 다시 로그인해주세요.");return}
      const {data:profile,error:profileError}=await supabase.from("profiles")
        .select("id,nickname,approval_status,role").eq("id",user.id).maybeSingle();
      if(profileError||!isApprovedProfile(profile)){setExisting(null);setNotice("관리자 승인 후 이용할 수 있습니다.");return}
      navigateAfterEntry(router,profile);
    }catch{setNotice("회원 상태를 확인하는 중 문제가 발생했습니다.")}
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
  return <main className="design-entry"><section className="entry-panel">
    <span className="eyebrow">AI PROCESS</span>
    <h1>{signupMode?"회원가입":"회원 로그인"}</h1>
    <p className="intro">{signupMode?"기존 회원과 동일한 AI PROCESS 서비스를 이용하기 위한 회원가입입니다.":"AI PROCESS 계정으로 로그인하세요."}</p>
    {loading?<p className="status">로그인 확인 중</p>:existing?
      <div className="entry-actions"><p><strong>{existing.nickname||"회원"}</strong> 계정으로 입장할 수 있습니다.</p>
        <button type="button" onClick={enterExisting} disabled={working}>{working?"승인 상태 확인 중":"로그인 상태로 입장"}</button>
        <button type="button" className="secondary" onClick={switchAccount} disabled={working}>다른 계정으로 로그인</button>
      </div>:
      <>
        <div className="entry-tabs" aria-label="로그인 또는 가입 신청">
          <button type="button" className={!signupMode?"is-active":""} onClick={()=>{setSignupMode(false);setNotice("");}}>로그인</button>
          <button type="button" className={signupMode?"is-active":""} onClick={()=>{setSignupMode(true);setNotice("");}}>가입 신청</button>
        </div>
        <form onSubmit={signupMode?submitSignup:submit}>
          <label htmlFor="design-nickname">닉네임</label>
          <input id="design-nickname" value={nickname} maxLength={40} onChange={e=>setNickname(e.target.value)} autoComplete="username" required/>
          {signupMode&&<>
            <label htmlFor="design-real-name">성함</label>
            <input id="design-real-name" value={realName} maxLength={80} onChange={e=>setRealName(e.target.value)} autoComplete="name" required/>
          </>}
          <label htmlFor="design-password">비밀번호</label>
          <input id="design-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={signupMode?"new-password":"current-password"} required/>
          <button type="submit" disabled={working}>{working?"처리 중...":signupMode?"가입 신청하기":"로그인"}</button>
        </form>
      </>
    }
    {notice&&<p className="notice" role="status">{notice}</p>}
    <p className="foot">AI PROCESS 회원 서비스 · 기존 계정과 기록은 그대로 유지됩니다.</p>
  </section><style jsx>{`
    .design-entry{min-height:100vh;display:grid;place-items:center;background:#f2f6fb;color:#14253e;padding:24px 15px;font-family:Arial,"Noto Sans KR",sans-serif}
    .entry-panel{width:min(100%,430px);background:white;padding:30px 25px;border:1px solid #dfe8f2;border-radius:14px}
    .eyebrow{display:block;margin-top:35px;color:#1674d9;font-size:10px;font-weight:800;letter-spacing:1px}
    h1{font-size:27px;margin:10px 0 6px}
    .intro{color:#697a8e;font-size:12px;line-height:1.8;margin-bottom:25px}
    form{display:flex;flex-direction:column;gap:9px}
    label{font-size:12px;font-weight:700;margin-top:8px}
    input{width:100%;height:45px;border:1px solid #cedae8;border-radius:8px;padding:0 12px;background:#fff;font-size:15px}
    button{width:100%;min-height:46px;margin-top:16px;border:0;border-radius:8px;background:#116bd5;color:white;font-size:14px;font-weight:800;cursor:pointer}
    button:disabled{opacity:.65;cursor:default}
    .secondary{background:#edf4fc;color:#1f619f;margin-top:7px}
    .entry-actions p{font-size:13px;line-height:1.7}
    .notice{font-size:12px;color:#a64242;line-height:1.6;margin:20px 0 0}
    .status{font-size:13px;color:#60758b}
    .foot{font-size:11px;color:#8b99a9;line-height:1.7;margin-top:27px}
    .entry-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;background:#edf3fa;border-radius:9px;margin:0 0 18px}
    .entry-tabs button{margin:0;min-height:42px;border-radius:7px;background:transparent;color:#5c7086;font-size:13px}
    .entry-tabs button.is-active{background:#fff;color:#145ea9;box-shadow:0 1px 5px #142d4619}
  `}</style></main>
}
