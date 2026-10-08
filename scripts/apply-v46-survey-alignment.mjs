import fs from 'node:fs';

let page = fs.readFileSync('app/page.js','utf8');

function replaceOnce(from,to,label){
  const next = typeof from === 'string' ? page.replace(from,to) : page.replace(from,to);
  if(next === page) throw new Error('anchor not found: '+label);
  page = next;
}

replaceOnce(
  '  const [eventRewardWorking, setEventRewardWorking] = useState(false);',
  '  const [eventRewardWorking, setEventRewardWorking] = useState(false);\n  const [homeNotice, setHomeNotice] = useState(null);\n  const [homeNoticeTitle, setHomeNoticeTitle] = useState("VIP 운영 안내");\n  const [homeNoticeBody, setHomeNoticeBody] = useState("");\n  const [eventRuntimeEnabled, setEventRuntimeEnabled] = useState(true);\n  const [adminEventOps, setAdminEventOps] = useState([]);',
  'states'
);

const giftRendererOld = String.raw`    if (content.startsWith("[[GIFT]]")) {
      const payload = content.slice(8);
      const splitAt = payload.indexOf("|");
      const deliveryId = splitAt >= 0 ? payload.slice(0, splitAt) : payload;
      const giftName = splitAt >= 0 ? payload.slice(splitAt + 1) : "이벤트 당첨 상품";
      return (
        <div style={{minWidth:"220px",padding:"12px",borderRadius:"14px",background:"linear-gradient(145deg,#fffaf1,#f3eadc)",border:"1px solid #dfccb0",color:"#30271f"}}>
          <span style={{display:"block",fontSize:"10px",fontWeight:900,color:"#8b6738"}}>🎁 이벤트 당첨 상품</span>
          <strong style={{display:"block",marginTop:"5px",fontSize:"14px"}}>{giftName}</strong>
          <button type="button" onClick={() => openGiftDelivery(deliveryId)} style={{width:"100%",marginTop:"10px",border:0,borderRadius:"10px",padding:"9px",background:"#243d38",color:"#fff",fontWeight:900,cursor:"pointer"}}>기프티콘 확인하기</button>
        </div>
      );
    }`;
const giftRendererNew = String.raw`    if (content.startsWith("[[GIFT]]")) {
      const payload = content.slice(8);
      const parts = payload.split("|");
      const deliveryId = parts[0] || "";
      const giftName = parts[1] || "이벤트 당첨 상품";
      const giftImage = parts.slice(2).join("|");
      return (
        <div style={{minWidth:"220px",maxWidth:"280px",padding:"12px",borderRadius:"14px",background:"#fff",border:"1px solid #d8e0dd",color:"#26332f",boxShadow:"0 8px 24px rgba(31,54,47,.08)"}}>
          {giftImage && <img src={giftImage} alt={giftName} style={{display:"block",width:"100%",maxHeight:"150px",objectFit:"cover",borderRadius:"10px",marginBottom:"10px"}}/>}
          <span style={{display:"block",fontSize:"10px",fontWeight:900,color:"#4d7569"}}>🎁 이벤트 당첨 상품</span>
          <strong style={{display:"block",marginTop:"5px",fontSize:"14px"}}>{giftName}</strong>
          <button type="button" onClick={() => openGiftDelivery(deliveryId)} style={{width:"100%",marginTop:"10px",border:0,borderRadius:"10px",padding:"9px",background:"#243d38",color:"#fff",fontWeight:900,cursor:"pointer"}}>기프티콘 확인하기</button>
        </div>
      );
    }`;
replaceOnce(giftRendererOld,giftRendererNew,'gift renderer');

const functionsAnchor = '  async function loadGiftInventorySummary() {';
const extraFunctions = String.raw`  async function loadHomeNotice() {
    const { data, error } = await supabase.rpc("get_home_notice");
    if (error) return;
    const row = Array.isArray(data) ? data[0] : null;
    setHomeNotice(row || null);
    if (row) {
      setHomeNoticeTitle(row.title || "VIP 운영 안내");
      setHomeNoticeBody(row.body || "");
    }
  }

  async function saveHomeNotice() {
    if (profile?.role !== "admin") return;
    const { error } = await supabase.rpc("admin_set_home_notice", {
      p_title: homeNoticeTitle,
      p_body: homeNoticeBody,
      p_active: true,
    });
    if (error) setNotice("공지 저장 실패: " + error.message);
    else { setNotice("홈 중요 공지를 저장했습니다."); await loadHomeNotice(); }
  }

  async function loadEventRuntimeSettings() {
    const { data, error } = await supabase.rpc("get_event_runtime_settings");
    if (error) return;
    const row = Array.isArray(data) ? data[0] : null;
    if (row) setEventRuntimeEnabled(Boolean(row.enabled));
  }

  async function toggleEventRuntimeEnabled() {
    if (profile?.role !== "admin") return;
    const next = !eventRuntimeEnabled;
    const { error } = await supabase.rpc("admin_set_event_runtime_enabled", { p_enabled: next });
    if (error) setNotice("자동 이벤트 설정 실패: " + error.message);
    else { setEventRuntimeEnabled(next); setNotice(next ? "자동 이벤트를 켰습니다." : "자동 이벤트를 중지했습니다."); }
  }

  async function loadAdminEventOperations() {
    if (profile?.role !== "admin") return;
    const { data, error } = await supabase.rpc("get_admin_event_operations");
    if (!error) setAdminEventOps(data || []);
  }

  async function uploadPrizeImage(file) {
    if (!file || profile?.role !== "admin" || prizeWorking) return;
    if (!file.type.startsWith("image/")) { setNotice("상품 이미지만 업로드할 수 있습니다."); return; }
    setPrizeWorking(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi,"").toLowerCase() || "jpg";
      const path = "event-prizes/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "." + ext;
      const { error } = await supabase.storage.from("chat-media").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
      if (error) throw error;
      const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
      setNewEventPrizeImage(data.publicUrl || "");
      setNotice("상품 이미지를 등록했습니다.");
    } catch (error) { setNotice("상품 이미지 업로드 실패: " + error.message); }
    setPrizeWorking(false);
  }

`;
replaceOnce(functionsAnchor,extraFunctions+functionsAnchor,'extra functions');

replaceOnce(
  '    if (profile.role === "admin") { loadEventPrizes(); loadGiftInventorySummary(); }\n    loadEventRewards();\n    loadAiDemo();',
  '    loadHomeNotice();\n    loadEventRuntimeSettings();\n    if (profile.role === "admin") { loadEventPrizes(); loadGiftInventorySummary(); loadAdminEventOperations(); }\n    loadEventRewards();\n    loadAiDemo();',
  'profile loading'
);

replaceOnce(
  '    setAutoEvents(data || []);\n    await Promise.all([loadEventRewards(), loadAiDemo()]);',
  '    setAutoEvents(data || []);\n    await Promise.all([loadEventRewards(), loadAiDemo(), loadHomeNotice(), loadEventRuntimeSettings(), profile?.role === "admin" ? loadAdminEventOperations() : Promise.resolve()]);',
  'event refresh extras'
);

const homeAnchor = '                <section className="vip-home-v20-alerts">';
const homeCards = String.raw`                <section style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:"10px",marginTop:"12px"}}>
                  <button type="button" onClick={()=>changeTab("ai")} style={{textAlign:"left",border:"1px solid #cbdcd7",borderRadius:"16px",padding:"14px",background:"linear-gradient(145deg,#f1f7f5,#e8f1ee)",color:"#23443a",cursor:"pointer"}}>
                    <span style={{display:"block",fontSize:"9px",fontWeight:900,color:"#4d7a6d"}}>AI PROCESS 체험</span>
                    <strong style={{display:"block",marginTop:"4px",fontSize:"14px"}}>{aiDemo?.status === "running" ? "모의체험 진행 중" : "AI PROCESS 돌발 체험"}</strong>
                    <p style={{margin:"6px 0 0",fontSize:"10px",lineHeight:1.5,color:"#667b75"}}>{aiDemo?.status === "running" ? "현재 " + aiKrw(aiDemo.current_amount) + " · " + aiSignedPct(aiDemo.total_return || 0) : "선정된 회원에게 1회 체험 혜택이 표시됩니다."}</p>
                    <em style={{display:"block",marginTop:"8px",fontStyle:"normal",fontSize:"9px",fontWeight:900,color:"#356b5d"}}>{aiDemo?.status === "running" ? "체험 화면 보기 ›" : "선정 시 AI PROCESS에서 시작"}</em>
                  </button>
                  <button type="button" onClick={()=>changeTab("event")} style={{textAlign:"left",border:"1px solid #dfe3e1",borderRadius:"16px",padding:"14px",background:"#fff",color:"#303a37",cursor:"pointer"}}>
                    <span style={{display:"block",fontSize:"9px",fontWeight:900,color:"#74827e"}}>내 이벤트 혜택</span>
                    <strong style={{display:"block",marginTop:"4px",fontSize:"14px"}}>받은 혜택 {myEventRewards.length}건</strong>
                    <p style={{margin:"6px 0 0",fontSize:"10px",lineHeight:1.45,color:"#7b8783"}}>{myEventRewards[0] ? myEventRewards[0].reward_name : "당첨 혜택이 생기면 이곳에 표시됩니다."}</p>
                    <em style={{display:"block",marginTop:"7px",fontStyle:"normal",fontSize:"9px",fontWeight:900,color:"#4d665e"}}>혜택 확인 ›</em>
                  </button>
                </section>
                {featuredEvent && <button type="button" onClick={()=>changeTab("event")} style={{width:"100%",marginTop:"10px",padding:"13px 14px",border:"1px solid #dde3e0",borderRadius:"16px",background:"#fff",display:"flex",alignItems:"center",gap:"11px",textAlign:"left",cursor:"pointer",color:"#293633"}}><div style={{fontSize:"24px"}}>{eventIcon(featuredEvent.event_type)}</div><div style={{flex:1,minWidth:0}}><span style={{display:"block",fontSize:"9px",fontWeight:900,color:"#6b7d77"}}>{activeEvent ? "진행 중 이벤트" : "다음 이벤트"}</span><strong style={{display:"block",marginTop:"3px",fontSize:"13px"}}>{featuredEvent.title}</strong><small style={{display:"block",marginTop:"3px",color:"#7b8884"}}>{activeEvent ? (featuredEvent.participated ? "참여 완료" : "지금 참여 가능") : formatEventTime(featuredEvent.starts_at) + " ~ " + formatEventTime(featuredEvent.ends_at)}</small></div><b>›</b></button>}
                {homeNotice?.is_active && <section style={{marginTop:"10px",padding:"13px 14px",borderRadius:"14px",background:"#f6f8f7",border:"1px solid #dde3e0"}}><span style={{display:"block",fontSize:"9px",fontWeight:900,color:"#62756e"}}>중요 공지</span><strong style={{display:"block",marginTop:"4px",fontSize:"13px",color:"#2d3b37"}}>{homeNotice.title}</strong><p style={{margin:"5px 0 0",fontSize:"10px",lineHeight:1.55,color:"#71807b",whiteSpace:"pre-wrap"}}>{homeNotice.body}</p></section>}
`;
replaceOnce(homeAnchor,homeCards+homeAnchor,'home cards');

// Remove large non-chat cards from group chat. The compact alert strip remains.
page = page.replace(/\n\s*\{profile\?\.role !== "admin" && \(\n\s*<section style=\{\{display:"grid",gridTemplateColumns:"repeat\(2,minmax\(0,1fr\)\)"[\s\S]*?\n\s*\)\}\n\s*\{featuredEvent && \([\s\S]*?\n\s*\)\}\n\n\s*<form onSubmit=\{sendMessage\}/,
  '\n\n                <form onSubmit={sendMessage}');

// Replace four-step process cards with one current-stage card.
page = page.replace(/<section className="ai-v2-panel" style=\{\{marginBottom:"14px",padding:"16px"\}\}>\n\s*<div className="ai-v2-panel-head"><div><span>PROCESS FLOW<\/span><strong>AI PROCESS 현재 단계<\/strong><\/div>[\s\S]*?<\/section>/,
String.raw`<section className="ai-v2-panel" style={{marginBottom:"14px",padding:"15px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
                    <div><span style={{display:"block",fontSize:"9px",fontWeight:900,color:"#6b7c76"}}>현재 단계</span><strong style={{display:"block",marginTop:"4px",fontSize:"15px",color:"#263833"}}>{aiSimLoading ? "AI 분석 중" : aiSession?.status === "running" ? "결과 반영 · 재분석" : "대기"}</strong></div>
                    <span style={{padding:"6px 9px",borderRadius:"999px",background:aiSession?.status === "running"?"#e7f5f0":"#f0f2f1",color:aiSession?.status === "running"?"#32705e":"#7a8581",fontSize:"9px",fontWeight:900}}>{aiSession?.status === "running" ? "자동 진행 중" : "대기"}</span>
                  </div>
                  <p style={{margin:"8px 0 0",fontSize:"10px",lineHeight:1.55,color:"#788680"}}>{aiLastResult ? aiLastResult.name + " 시장 움직임이 최근 결과에 반영되었습니다." : "시장 데이터를 분석하고 조건에 맞는 대상을 선별합니다."}</p>
                </section>`);

replaceOnce(
  '<span>주식 {aiMarketRows.filter((item)=>item.type !== "crypto").length} · 코인 {aiMarketRows.filter((item)=>item.type === "crypto").length}</span><b style={{color:"#44515b"}}>최근 시장 데이터를 보조 지표로 분석 중</b>',
  '<span>최근 선택 · <b style={{color:"#44515b"}}>{aiLastResult?.name || "분석 중"}</b>{aiLastResult ? " " + aiSignedPct(aiLastResult.intervalPct) : ""}</span><small>전체 시장 {aiMarketRows.length}개 · 펼치기에서 확인</small>',
  'collapsed market summary'
);

replaceOnce(
  'onClick={() => setAiChartHover((current) => current?.at === node.at ? null : node)}',
  'onClick={() => { setAiChartHover((current) => current?.at === node.at ? null : node); window.setTimeout(() => document.querySelector(`[data-ai-at="${node.at}"]`)?.scrollIntoView({behavior:"smooth",block:"center"}), 30); }}',
  'chart record link'
);

replaceOnce(
  '<div className="ai-v2-history-row" key={`${item.at}-${item.symbol}-${index}`}>',
  '<div className={`ai-v2-history-row ${aiChartHover?.at === item.at ? "is-selected" : ""}`} data-ai-at={item.at} key={`${item.at}-${item.symbol}-${index}`} style={aiChartHover?.at === item.at ? {outline:"2px solid #7eb5a5",outlineOffset:"-2px",background:"#f1f8f5"} : undefined}>',
  'history highlight'
);

const eventNoticeAnchor = '                {notice && <div style={styles.refNotice}>{notice}</div>}';
const myHistory = String.raw`                {profile?.role !== "admin" && autoEvents.some((item)=>item.participated) && <section style={{marginTop:"12px",padding:"14px",border:"1px solid #dde4e1",borderRadius:"16px",background:"#fff"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"9px"}}><strong style={{fontSize:"14px",color:"#2c3b37"}}>내 참여 기록</strong><small style={{fontSize:"9px",color:"#7b8a85"}}>오늘 {autoEvents.filter((item)=>item.participated).length}회</small></div><div style={{display:"grid",gap:"7px"}}>{autoEvents.filter((item)=>item.participated).map((item)=><div key={item.event_id} style={{display:"grid",gridTemplateColumns:"34px 1fr auto",gap:"9px",alignItems:"center",padding:"9px 10px",borderRadius:"11px",background:"#f7f9f8"}}><span style={{fontSize:"19px"}}>{eventIcon(item.event_type)}</span><div><b style={{display:"block",fontSize:"11px",color:"#30413c"}}>{item.title}</b><small style={{fontSize:"9px",color:"#82908b"}}>{formatEventTime(item.starts_at)} · {item.my_result_text || (item.status === "completed" ? "결과 확인 가능" : "참여 완료")}</small></div><em style={{fontStyle:"normal",fontSize:"9px",fontWeight:900,color:item.winner_nickname===profile.nickname?"#2c765d":"#71807b"}}>{item.winner_nickname===profile.nickname?"당첨":"참여"}</em></div>)}</div></section>}
`;
replaceOnce(eventNoticeAnchor,myHistory+eventNoticeAnchor,'my event history');

const adminEventAnchor = '                {profile?.role === "admin" && (\n                  <section style={{margin:"0 0 14px",padding:"14px",border:"1px solid #e1cfb4",borderRadius:"16px",background:"#fffaf2"}}>';
const adminOps = String.raw`                {profile?.role === "admin" && <section style={{margin:"0 0 14px",padding:"14px",border:"1px solid #dbe3e0",borderRadius:"16px",background:"#f8faf9"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",marginBottom:"11px"}}><div><strong style={{display:"block",fontSize:"15px",color:"#293a35"}}>이벤트 운영센터</strong><small style={{display:"block",marginTop:"3px",fontSize:"10px",color:"#73817c"}}>일정 · 참여 · 당첨 · 지급 상태를 한곳에서 관리합니다.</small></div><button type="button" onClick={toggleEventRuntimeEnabled} style={{border:0,borderRadius:"999px",padding:"8px 11px",background:eventRuntimeEnabled?"#275c4c":"#ecefee",color:eventRuntimeEnabled?"#fff":"#63706c",fontSize:"9px",fontWeight:900,cursor:"pointer"}}>자동 이벤트 {eventRuntimeEnabled?"ON":"OFF"}</button></div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:"7px",marginBottom:"10px"}}>{[["오늘 회차",adminEventOps.length],["참여",adminEventOps.reduce((s,x)=>s+Number(x.participant_count||0),0)],["당첨",adminEventOps.reduce((s,x)=>s+Number(x.winner_count||0),0)],["지급대기",adminEventRewards.filter((x)=>x.status!=="delivered").length]].map(([label,value])=><div key={label} style={{padding:"10px 6px",borderRadius:"11px",background:"#fff",border:"1px solid #e1e6e4",textAlign:"center"}}><small style={{display:"block",fontSize:"8px",color:"#7d8a86"}}>{label}</small><b style={{display:"block",marginTop:"4px",fontSize:"13px",color:"#2b3d37"}}>{value}</b></div>)}</div>
                  <details><summary style={{cursor:"pointer",fontSize:"10px",fontWeight:900,color:"#4b655d"}}>오늘 회차별 참여 현황 보기</summary><div style={{display:"grid",gap:"6px",marginTop:"9px"}}>{adminEventOps.map((item)=><div key={item.event_id} style={{display:"grid",gridTemplateColumns:"38px 1fr 60px 60px",gap:"8px",alignItems:"center",padding:"8px 9px",borderRadius:"10px",background:"#fff",fontSize:"9px"}}><b>{item.round_number}회</b><span>{item.title}</span><span>참여 {item.participant_count}</span><span>{item.status === "active" ? "진행" : item.status === "completed" ? "완료" : "예정"}</span></div>)}</div></details>
                  <div style={{marginTop:"12px",paddingTop:"12px",borderTop:"1px solid #e1e6e4"}}><strong style={{display:"block",fontSize:"11px",color:"#31453f"}}>홈 중요 공지</strong><div style={{display:"grid",gridTemplateColumns:"1fr",gap:"7px",marginTop:"7px"}}><input value={homeNoticeTitle} onChange={(e)=>setHomeNoticeTitle(e.target.value)} placeholder="공지 제목" style={{border:"1px solid #d7dfdc",borderRadius:"9px",padding:"8px",fontSize:"10px"}}/><textarea value={homeNoticeBody} onChange={(e)=>setHomeNoticeBody(e.target.value)} placeholder="공지 내용" style={{minHeight:"58px",border:"1px solid #d7dfdc",borderRadius:"9px",padding:"8px",fontSize:"10px",resize:"vertical"}}/><button type="button" onClick={saveHomeNotice} style={{border:0,borderRadius:"9px",padding:"8px",background:"#29483f",color:"#fff",fontSize:"9px",fontWeight:900,cursor:"pointer"}}>공지 저장</button></div></div>
                </section>}
`;
replaceOnce(adminEventAnchor,adminOps+adminEventAnchor,'admin operations');

replaceOnce(
  '<select value={newEventRewardType} onChange={(e)=>setNewEventRewardType(e.target.value)} style={{border:"1px solid #dccbb6",borderRadius:"10px",padding:"9px 8px",background:"#fff",fontSize:"10px",fontWeight:800}}><option value="physical">실제 상품</option><option value="ai_process">AI PROCESS 혜택</option></select>',
  '<select value={newEventRewardType} onChange={(e)=>setNewEventRewardType(e.target.value)} style={{border:"1px solid #d8dfdc",borderRadius:"10px",padding:"9px 8px",background:"#fff",fontSize:"10px",fontWeight:800}}><option value="physical">실제 상품</option><option value="ai_process">AI PROCESS 체험금</option><option value="event_bonus">이벤트 전용 보너스</option><option value="custom">관리자 지정 혜택</option></select>',
  'reward types'
);

replaceOnce(
  '{newEventRewardType === "physical" && <input value={newEventPrizeImage} onChange={(e)=>setNewEventPrizeImage(e.target.value)} placeholder="상품 이미지 URL · 선택" style={{width:"100%",boxSizing:"border-box",marginBottom:"8px",border:"1px solid #dccbb6",borderRadius:"10px",padding:"9px 10px",background:"#fff",fontSize:"10px"}}/>}',
  '{newEventRewardType === "physical" && <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}><label style={{border:"1px solid #d5dedb",borderRadius:"10px",padding:"9px 11px",background:"#fff",fontSize:"10px",fontWeight:900,cursor:"pointer"}}>상품 이미지 업로드<input type="file" accept="image/*" hidden onChange={(e)=>uploadPrizeImage(e.target.files?.[0])}/></label>{newEventPrizeImage && <><img src={newEventPrizeImage} alt="상품" style={{width:"42px",height:"42px",objectFit:"cover",borderRadius:"9px"}}/><small style={{fontSize:"9px",color:"#5b776e"}}>이미지 등록 완료</small></>}</div>}',
  'image upload ui'
);

// Remove unnecessary AI demo time input from reward form; target return decides completion.
replaceOnce(
  ': <input value={newAiDemoMinutes} onChange={(e)=>setNewAiDemoMinutes(e.target.value.replace(/[^0-9]/g,""))} placeholder="분" style={{border:"1px solid #dccbb6",borderRadius:"10px",padding:"9px",background:"#fff",fontSize:"10px"}}/>}',
  ': <div style={{border:"1px solid #d7dfdc",borderRadius:"10px",padding:"9px",background:"#f7f9f8",fontSize:"9px",fontWeight:900,color:"#567067"}}>목표 수익률 도달 시 자동 종료</div>}',
  'demo time ui'
);

// Korean labels and restrained copy in touched areas.
page = page.replaceAll('TODAY BRIEF','오늘 브리핑');
page = page.replaceAll('LIVE EVENT','진행 중 이벤트');
page = page.replaceAll('NEXT EVENT','다음 이벤트');
page = page.replaceAll('MY AI PROCESS','내 AI PROCESS');
page = page.replaceAll('EVENT REWARD CENTER','이벤트 혜택 관리');
page = page.replaceAll('WINNER & DELIVERY','당첨 · 지급');
page = page.replaceAll('SIMULATION MODE','모의체험');
page = page.replaceAll('MARKET LINK','시장 연동');
page = page.replaceAll('PERFORMANCE','평가금액 변화');

fs.writeFileSync('app/page.js',page);
console.log('V46 survey alignment patch applied');
