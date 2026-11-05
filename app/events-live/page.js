"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../supabase";
export default function EventsLive(){
 const [items,setItems]=useState([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;async function load(){const {data,error}=await supabase.rpc("get_auto_events");if(!alive)return;setItems(Array.isArray(data)?data:[]);setError(error?.message||"");setLoading(false)}load();const timer=setInterval(load,30000);return()=>{alive=false;clearInterval(timer)}},[]);
 return <main style={{minHeight:"100vh",background:"#f7faff",color:"#11213e",fontFamily:"Arial,sans-serif",padding:"24px 16px",maxWidth:480,margin:"auto"}}>
 <Link href="/design-home" style={{color:"#086be1",textDecoration:"none"}}>‹ 홈</Link>
 <h1 style={{marginTop:35,fontSize:27}}>이벤트</h1><p style={{color:"#65758e"}}>현재 진행되는 이벤트를 확인하세요.</p>
 {loading?<p>이벤트 불러오는 중...</p>:error?<p role="alert">이벤트 조회 실패: {error}</p>:items.length===0?<p>표시할 이벤트가 없습니다.</p>:items.map((item,i)=><article key={item.event_id||i} style={{background:"white",border:"1px solid #e2eaf5",borderRadius:14,padding:18,marginTop:12}}>
 <div style={{fontSize:12,color:"#086be1"}}>{item.status==="active"?"진행 중":item.status==="completed"?"완료":"예정"}</div><h2 style={{fontSize:17}}>{item.title||"이벤트"}</h2><p style={{fontSize:13,color:"#687992"}}>{item.description||"상세 내용은 회원 서비스에서 확인하세요."}</p>
 <div style={{fontSize:12,color:"#65758e"}}>{item.round_number?item.round_number+"회차 · ":""}{item.participant_count??0}명 참여</div></article>)}
 <p style={{fontSize:12,color:"#65758e",marginTop:24}}>이벤트 참여 및 당첨 처리 기능은 기존 회원 서비스에서 이용할 수 있습니다.</p><Link href="/" style={{color:"#086be1"}}>회원 서비스로 이동</Link>
 </main>
}