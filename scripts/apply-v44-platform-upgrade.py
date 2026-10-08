from pathlib import Path

PAGE = Path('app/page.js')
text = PAGE.read_text(encoding='utf-8')


def must_replace(src, old, new, label):
    if old not in src:
        raise RuntimeError(f'anchor not found: {label}')
    return src.replace(old, new, 1)


def replace_between(src, start_marker, end_marker, replacement, label):
    start = src.find(start_marker)
    if start < 0:
        raise RuntimeError(f'start not found: {label}')
    end = src.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f'end not found: {label}')
    return src[:start] + replacement + src[end:]

# ------------------------------------------------------------------
# State: event reward management, AI demo, compact market panel
# ------------------------------------------------------------------
text = must_replace(
    text,
    '  const [eventPrizes, setEventPrizes] = useState([]);\n  const [showAllEvents, setShowAllEvents] = useState(false);\n  const [newEventPrize, setNewEventPrize] = useState("");',
    '  const [eventPrizes, setEventPrizes] = useState([]);\n  const [showAllEvents, setShowAllEvents] = useState(false);\n  const [myEventRewards, setMyEventRewards] = useState([]);\n  const [adminEventRewards, setAdminEventRewards] = useState([]);\n  const [eventRewardWorking, setEventRewardWorking] = useState(false);\n  const [newEventPrize, setNewEventPrize] = useState("");\n  const [newEventRewardType, setNewEventRewardType] = useState("physical");\n  const [newEventPrizeValue, setNewEventPrizeValue] = useState("");\n  const [newEventPrizeQty, setNewEventPrizeQty] = useState("1");\n  const [newAiDemoAmount, setNewAiDemoAmount] = useState("10000");\n  const [newAiDemoMinutes, setNewAiDemoMinutes] = useState("60");\n  const [aiDemo, setAiDemo] = useState(null);\n  const [aiMarketExpanded, setAiMarketExpanded] = useState(false);',
    'event reward states'
)

# ------------------------------------------------------------------
# Event prize load/add functions upgraded to typed rewards
# ------------------------------------------------------------------
start = '  async function loadEventPrizes() {'
end = '  async function selectEventPrize(id, name) {'
replacement = '''  async function loadEventPrizes() {
    if (profile?.role !== "admin") return;
    const { data, error } = await supabase
      .from("event_prize_catalog")
      .select("id,name,is_active,is_selected,reward_type,face_value,stock_qty,used_qty,ai_demo_amount,ai_demo_minutes,notes,created_at,updated_at")
      .eq("is_active", true)
      .order("is_selected", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("상품 목록 조회 오류:", error);
      return;
    }
    setEventPrizes(data || []);
  }

  async function addEventPrize() {
    const name = newEventPrize.trim();
    if (name.length < 2 || prizeWorking) return;
    setPrizeWorking(true);
    const { error } = await supabase.rpc("admin_add_event_reward", {
      p_name: name,
      p_reward_type: newEventRewardType,
      p_face_value: newEventRewardType === "physical" ? (Number(newEventPrizeValue) || null) : null,
      p_stock_qty: Math.max(1, Number(newEventPrizeQty) || 1),
      p_ai_demo_amount: newEventRewardType === "ai_process" ? Math.max(1000, Number(newAiDemoAmount) || 10000) : null,
      p_ai_demo_minutes: newEventRewardType === "ai_process" ? Math.max(3, Number(newAiDemoMinutes) || 60) : null,
      p_notes: null,
    });
    if (error) setNotice(`혜택 등록 실패: ${error.message}`);
    else {
      setNewEventPrize("");
      setNewEventPrizeValue("");
      setNewEventPrizeQty("1");
      setNotice(`이벤트 혜택 “${name}”을 등록했습니다.`);
      await loadEventPrizes();
    }
    setPrizeWorking(false);
  }

'''
text = replace_between(text, start, end, replacement, 'event prize functions')

# ------------------------------------------------------------------
# Reward delivery + surprise AI demo helpers
# ------------------------------------------------------------------
anchor = '  useEffect(() => {\n    if (typeof window === "undefined") return;\n    setInstallDismissed(window.localStorage.getItem("vip-install-dismissed-v1") === "1");\n  }, []);'
helpers = '''  async function loadEventRewards() {
    if (!user || !profile) return;
    const fn = profile.role === "admin" ? "get_admin_event_rewards" : "get_my_event_rewards";
    const { data, error } = await supabase.rpc(fn);
    if (error) {
      console.error("이벤트 혜택 조회 오류:", error);
      return;
    }
    if (profile.role === "admin") setAdminEventRewards(data || []);
    else setMyEventRewards(data || []);
  }

  async function markEventRewardDelivered(deliveryId) {
    if (profile?.role !== "admin" || eventRewardWorking) return;
    setEventRewardWorking(true);
    const { error } = await supabase.rpc("admin_mark_event_reward_delivered", {
      p_delivery_id: deliveryId,
      p_note: null,
    });
    if (error) setNotice(`지급 처리 실패: ${error.message}`);
    else {
      setNotice("혜택을 지급 완료로 처리했습니다.");
      await loadEventRewards();
    }
    setEventRewardWorking(false);
  }

  async function loadAiDemo() {
    if (!user || profile?.role === "admin") return;
    const { data, error } = await supabase.rpc("get_my_ai_process_demo");
    if (error) {
      console.error("AI PROCESS 체험 조회 오류:", error);
      return;
    }
    setAiDemo(Array.isArray(data) ? (data[0] || null) : null);
  }

  async function startSurpriseAiDemo() {
    if (profile?.role !== "admin" || eventRewardWorking) return;
    setEventRewardWorking(true);
    const { data, error } = await supabase.rpc("admin_start_surprise_ai_demo", {
      p_amount: Math.max(1000, Number(newAiDemoAmount) || 10000),
      p_minutes: Math.max(3, Number(newAiDemoMinutes) || 60),
    });
    if (error) setNotice(`돌발 체험 시작 실패: ${error.message}`);
    else {
      const result = data || {};
      setNotice(`${result.nickname || "선정 회원"} 님의 AI PROCESS 돌발 체험을 시작했습니다.`);
      await Promise.all([loadMessages(), loadEventRewards()]);
    }
    setEventRewardWorking(false);
  }

'''
text = must_replace(text, anchor, helpers + anchor, 'reward helpers')

text = must_replace(
    text,
    '  useEffect(() => {\n    if (profile?.role === "admin") loadEventPrizes();\n  }, [profile?.role]);',
    '  useEffect(() => {\n    if (!profile) return;\n    if (profile.role === "admin") loadEventPrizes();\n    loadEventRewards();\n    loadAiDemo();\n  }, [profile?.role, user?.id]);',
    'event reward useEffect'
)

text = must_replace(
    text,
    '    setAutoEvents(data || []);\n  }',
    '    setAutoEvents(data || []);\n    await Promise.all([loadEventRewards(), loadAiDemo()]);\n  }',
    'load auto events refresh extras'
)

# ------------------------------------------------------------------
# HOME: turn it into an actual daily VIP briefing
# ------------------------------------------------------------------
home_welcome = '''                <section className="vip-home-v20-welcome">
                  <div><span>AI PROCESS VIP</span><h2>{profile.nickname}님, 지금 확인할 내용입니다.</h2><p>대화, 진행 중인 PROCESS, 이벤트를 한 화면에서 빠르게 확인하세요.</p></div>
                  <img src={avatarSrc(profile.avatar)} alt="프로필" />
                </section>'''
home_brief = home_welcome + '''
                <section style={{padding:"14px",borderRadius:"18px",background:"#fffaf2",border:"1px solid #ead8bf",boxShadow:"0 8px 22px rgba(73,50,31,.06)"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",marginBottom:"11px"}}>
                    <div><span style={{display:"block",fontSize:"9px",fontWeight:900,letterSpacing:"1.2px",color:"#a8793c"}}>TODAY BRIEF</span><strong style={{display:"block",marginTop:"3px",fontSize:"15px",color:"#32261e"}}>오늘의 VIP 브리핑</strong></div>
                    <small style={{fontSize:"9px",fontWeight:900,color:"#8f7a66"}}>{groupChatOperating ? "운영 중" : "운영 종료"}</small>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:"7px"}}>
                    {[
                      ["LIVE EVENT", activeEvent ? "진행 중" : nextEvent ? "예정" : "종료"],
                      ["내 참여", autoEvents.filter((item)=>item.participated).length + "회"],
                      ["받은 혜택", myEventRewards.length + "건"],
                      ["AI PROCESS", aiSession?.status === "running" ? aiSignedPct(aiSession?.total_return || 0) : "대기"],
                    ].map(([label,value]) => <div key={label} style={{padding:"10px 5px",borderRadius:"12px",background:"#fff",border:"1px solid #eee0ce",textAlign:"center"}}><small style={{display:"block",fontSize:"8px",color:"#9a8979"}}>{label}</small><b style={{display:"block",marginTop:"4px",fontSize:"12px",color:"#34271f"}}>{value}</b></div>)}
                  </div>
                  {myEventRewards[0] && <button type="button" onClick={() => changeTab("event")} style={{width:"100%",marginTop:"10px",border:"1px solid #e2c892",background:"#fff3d8",borderRadius:"11px",padding:"9px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",color:"#5b401f",fontSize:"10px",fontWeight:900,cursor:"pointer"}}><span>🎁 최근 혜택 · {myEventRewards[0].reward_name}</span><em style={{fontStyle:"normal"}}>{myEventRewards[0].status === "delivered" ? "지급완료" : myEventRewards[0].reward_type === "ai_process" ? "체험 활성" : "지급대기"} ›</em></button>}
                </section>'''
text = must_replace(text, home_welcome, home_brief, 'home daily brief')

# ------------------------------------------------------------------
# EVENT admin: typed rewards + payout dashboard + surprise AI demo
# ------------------------------------------------------------------
text = must_replace(
    text,
    '<div><span style={{display:"block",fontSize:"9px",fontWeight:900,letterSpacing:"1.2px",color:"#a77a3f"}}>EVENT PRIZE</span><strong style={{display:"block",marginTop:"3px",fontSize:"15px",color:"#34251d"}}>기프티콘 상품 관리</strong><small style={{display:"block",marginTop:"3px",fontSize:"10px",color:"#8d7867"}}>선택한 상품명이 이후 예약 이벤트와 당첨 안내에 자동 반영됩니다.</small></div>',
    '<div><span style={{display:"block",fontSize:"9px",fontWeight:900,letterSpacing:"1.2px",color:"#a77a3f"}}>EVENT REWARD CENTER</span><strong style={{display:"block",marginTop:"3px",fontSize:"15px",color:"#34251d"}}>이벤트 혜택 관리</strong><small style={{display:"block",marginTop:"3px",fontSize:"10px",color:"#8d7867"}}>실제 상품과 AI PROCESS 체험 혜택을 분리해 등록하고 운영합니다.</small></div>',
    'event admin title'
)

old_input = '''                    <div style={{display:"flex",gap:"7px",marginBottom:"10px"}}>
                      <input value={newEventPrize} onChange={(e)=>setNewEventPrize(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();addEventPrize();}}} placeholder="예: 스타벅스 아메리카노" style={{flex:1,minWidth:0,border:"1px solid #dccbb6",borderRadius:"10px",padding:"9px 10px",background:"#fff",fontSize:"11px"}}/>
                      <button type="button" disabled={prizeWorking || newEventPrize.trim().length<2} onClick={addEventPrize} style={{border:"1px solid #c7903b",borderRadius:"10px",padding:"8px 11px",background:"#fff0cf",color:"#6b4619",fontSize:"10px",fontWeight:900,cursor:"pointer"}}>상품 등록</button>
                    </div>'''
new_input = '''                    <div style={{display:"grid",gridTemplateColumns:"120px minmax(180px,1fr) 110px 90px",gap:"7px",marginBottom:"8px"}}>
                      <select value={newEventRewardType} onChange={(e)=>setNewEventRewardType(e.target.value)} style={{border:"1px solid #dccbb6",borderRadius:"10px",padding:"9px 8px",background:"#fff",fontSize:"10px",fontWeight:800}}><option value="physical">실제 상품</option><option value="ai_process">AI PROCESS 혜택</option></select>
                      <input value={newEventPrize} onChange={(e)=>setNewEventPrize(e.target.value)} placeholder={newEventRewardType === "physical" ? "예: 스타벅스 아메리카노" : "예: AI PROCESS 1만원 체험"} style={{minWidth:0,border:"1px solid #dccbb6",borderRadius:"10px",padding:"9px 10px",background:"#fff",fontSize:"11px"}}/>
                      {newEventRewardType === "physical" ? <input value={newEventPrizeValue} onChange={(e)=>setNewEventPrizeValue(e.target.value.replace(/[^0-9]/g,""))} placeholder="금액(원)" style={{border:"1px solid #dccbb6",borderRadius:"10px",padding:"9px",background:"#fff",fontSize:"10px"}}/> : <input value={newAiDemoAmount} onChange={(e)=>setNewAiDemoAmount(e.target.value.replace(/[^0-9]/g,""))} placeholder="체험금" style={{border:"1px solid #dccbb6",borderRadius:"10px",padding:"9px",background:"#fff",fontSize:"10px"}}/>}
                      {newEventRewardType === "physical" ? <input value={newEventPrizeQty} onChange={(e)=>setNewEventPrizeQty(e.target.value.replace(/[^0-9]/g,""))} placeholder="수량" style={{border:"1px solid #dccbb6",borderRadius:"10px",padding:"9px",background:"#fff",fontSize:"10px"}}/> : <input value={newAiDemoMinutes} onChange={(e)=>setNewAiDemoMinutes(e.target.value.replace(/[^0-9]/g,""))} placeholder="분" style={{border:"1px solid #dccbb6",borderRadius:"10px",padding:"9px",background:"#fff",fontSize:"10px"}}/>}
                    </div>
                    <button type="button" disabled={prizeWorking || newEventPrize.trim().length<2} onClick={addEventPrize} style={{width:"100%",marginBottom:"10px",border:"1px solid #c7903b",borderRadius:"10px",padding:"9px 11px",background:"#fff0cf",color:"#6b4619",fontSize:"10px",fontWeight:900,cursor:"pointer"}}>+ 새 이벤트 혜택 등록</button>'''
text = must_replace(text, old_input, new_input, 'event reward form')

text = text.replace('{prize.is_selected?"✓ 현재 상품 · ":"선택 · "}{prize.name}', '{prize.is_selected?"✓ 현재 · ":"선택 · "}{prize.reward_type === "ai_process" ? "AI PROCESS · " : "실제 상품 · "}{prize.name}', 1)

admin_reward_panel = '''                {profile?.role === "admin" && (
                  <section style={{margin:"0 0 14px",padding:"14px",border:"1px solid #d8ccb9",borderRadius:"16px",background:"#211d1a",color:"#fff8ed"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px",marginBottom:"10px"}}><div><span style={{display:"block",fontSize:"8px",fontWeight:900,letterSpacing:"1.2px",color:"#d4a75e"}}>WINNER & DELIVERY</span><strong style={{display:"block",marginTop:"3px",fontSize:"14px"}}>당첨 · 지급 관리</strong></div><button type="button" disabled={eventRewardWorking} onClick={startSurpriseAiDemo} style={{border:"1px solid #c49348",borderRadius:"10px",background:"#3a2b1d",color:"#ffd992",padding:"8px 10px",fontSize:"9px",fontWeight:900,cursor:"pointer"}}>⚡ AI PROCESS 돌발 체험 추첨</button></div>
                    <div style={{display:"grid",gap:"7px"}}>
                      {adminEventRewards.slice(0,8).map((reward)=><div key={reward.id} style={{display:"grid",gridTemplateColumns:"minmax(90px,1fr) minmax(120px,1.6fr) 80px 78px",gap:"8px",alignItems:"center",padding:"9px 10px",borderRadius:"10px",background:"rgba(255,255,255,.055)",fontSize:"10px"}}><b>{reward.nickname}</b><span>{reward.reward_type === "ai_process" ? "◆ " : "🎁 "}{reward.reward_name}</span><em style={{fontStyle:"normal",color:reward.status === "delivered" ? "#83d9b1" : "#e8bf79"}}>{reward.status === "delivered" ? "지급완료" : reward.reward_type === "ai_process" ? "체험활성" : "지급대기"}</em>{reward.status !== "delivered" ? <button type="button" disabled={eventRewardWorking} onClick={()=>markEventRewardDelivered(reward.id)} style={{border:"1px solid #6c5a45",borderRadius:"8px",background:"#332a22",color:"#fff3df",padding:"6px",fontSize:"9px",cursor:"pointer"}}>완료 처리</button> : <small>완료</small>}</div>)}
                      {!adminEventRewards.length && <div style={{padding:"12px",borderRadius:"10px",background:"rgba(255,255,255,.04)",fontSize:"10px",color:"#b9aa99"}}>아직 당첨·지급 기록이 없습니다.</div>}
                    </div>
                  </section>
                )}
'''
text = must_replace(text, '                {eventSuccess && (', admin_reward_panel + '                {eventSuccess && (', 'admin reward panel')

# User event page: AI PROCESS demo + benefits
user_event_cards = '''                {profile?.role !== "admin" && (
                  <section style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:"9px",margin:"0 0 12px"}}>
                    <button type="button" onClick={()=>setChatTab("ai")} style={{textAlign:"left",border:"1px solid #c9d8e7",borderRadius:"16px",padding:"14px",background:"linear-gradient(145deg,#eef6ff,#e5effb)",color:"#17324d",cursor:"pointer"}}><span style={{display:"block",fontSize:"8px",fontWeight:900,letterSpacing:"1.1px",color:"#527ba1"}}>AI PROCESS SPECIAL</span><strong style={{display:"block",marginTop:"4px",fontSize:"14px"}}>{aiDemo?.status === "running" ? "모의체험 진행 중" : "AI PROCESS 돌발 체험"}</strong><p style={{margin:"6px 0 0",fontSize:"10px",lineHeight:1.5,color:"#60778b"}}>{aiDemo?.status === "running" ? `체험금 ${aiKrw(aiDemo.start_amount)} · 현재 ${aiKrw(aiDemo.current_amount)} · ${aiSignedKrw(aiDemo.total_profit || 0)}` : "선정 회원에게 실제 잔액과 분리된 체험금으로 AI PROCESS가 자동 진행됩니다."}</p><em style={{display:"block",marginTop:"8px",fontStyle:"normal",fontSize:"9px",fontWeight:900,color:"#2a6498"}}>{aiDemo?.status === "running" ? "체험 화면 보기 ›" : "선정 시 자동 안내됩니다"}</em></button>
                    <div style={{border:"1px solid #ead4ad",borderRadius:"16px",padding:"14px",background:"linear-gradient(145deg,#fff9ec,#f8ecd4)",color:"#4d351c"}}><span style={{display:"block",fontSize:"8px",fontWeight:900,letterSpacing:"1.1px",color:"#a47332"}}>MY REWARDS</span><strong style={{display:"block",marginTop:"4px",fontSize:"14px"}}>내 이벤트 혜택 {myEventRewards.length}건</strong>{myEventRewards[0] ? <><p style={{margin:"6px 0 0",fontSize:"10px",lineHeight:1.45}}>{myEventRewards[0].reward_name}</p><em style={{display:"block",marginTop:"7px",fontStyle:"normal",fontSize:"9px",fontWeight:900,color:"#8c5d22"}}>{myEventRewards[0].status === "delivered" ? "지급 완료" : myEventRewards[0].reward_type === "ai_process" ? "체험 활성" : "지급 대기"}</em></> : <p style={{margin:"6px 0 0",fontSize:"10px",color:"#9a8266"}}>당첨 혜택은 이곳에 자동 표시됩니다.</p>}</div>
                  </section>
                )}
'''
text = must_replace(text, '                {featuredEvent && (', user_event_cards + '                {featuredEvent && (', 'user event benefit cards')

# ------------------------------------------------------------------
# AI PROCESS: reduce market dominance, add process-stage hierarchy, remove disclaimer
# ------------------------------------------------------------------
text = must_replace(text, '                    <p>현재 평가금액과 자산 흐름, 시장 연동 상태를 확인하세요.</p>', '                    <p>진행 상태, 평가금액, 수익·손실 기록을 한눈에 확인하세요.</p>', 'ai hero copy')

text = text.replace('                  <div className="ai-v2-summary-card"><span>3분 시장</span><strong>{aiPositiveMarkets}↑ / {aiNegativeMarkets}↓</strong><small>주식·코인 8종 · 3분</small></div>\n', '', 1)

stage_anchor = '                <section className="ai-v2-live-members">'
stage_block = '''                <section className="ai-v2-panel" style={{marginBottom:"14px",padding:"16px"}}>
                  <div className="ai-v2-panel-head"><div><span>PROCESS FLOW</span><strong>AI PROCESS 현재 단계</strong></div><small style={{fontSize:"10px",fontWeight:900,color:"#718092"}}>{aiSession?.status === "running" ? "자동 진행 중" : "대기"}</small></div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:"7px",marginTop:"12px"}}>
                    {["시장 탐색","AI 분석","대상 선별","결과 반영"].map((label,index)=>{const activeIndex=aiSimLoading?1:aiSession?.status === "running"?3:0; const done=aiSession?.status === "running" && index<activeIndex; const active=index===activeIndex; return <div key={label} style={{padding:"11px 8px",borderRadius:"12px",border:active?"1px solid #7fb8a2":"1px solid #e1e7ea",background:active?"#eaf8f2":done?"#f4f8f6":"#f8fafb",textAlign:"center"}}><small style={{display:"block",fontSize:"8px",fontWeight:900,color:active?"#2f7961":"#8b98a1"}}>{done?"✓":"0"+(index+1)}</small><b style={{display:"block",marginTop:"4px",fontSize:"10px",color:active?"#1e604d":"#42505b"}}>{label}</b></div>})}
                  </div>
                  <p style={{margin:"10px 0 0",fontSize:"10px",lineHeight:1.55,color:"#78838d"}}>{aiSession?.status === "running" ? (aiLastResult ? `${aiLastResult.name} 시장 움직임을 반영해 최근 결과가 기록되었습니다.` : "실시간 시장 데이터를 탐색하고 현재 조건에 맞는 대상을 선별하고 있습니다.") : "AI PROCESS 시작 시 탐색부터 결과 반영까지 자동으로 진행됩니다."}</p>
                </section>

'''
text = must_replace(text, stage_anchor, stage_block + stage_anchor, 'ai process stage')

# Compact the market panel without deleting market visibility.
market_start = '                  <section className="ai-v2-panel ai-v2-market-panel">'
market_end = '                  </section>\n                </div>\n\n                <section className="ai-v2-panel ai-v2-log-panel">'
start_i = text.find(market_start)
end_i = text.find(market_end, start_i)
if start_i < 0 or end_i < 0:
    raise RuntimeError('market panel block not found')
market_replacement = '''                  <section className="ai-v2-panel ai-v2-market-panel" style={{alignSelf:"start"}}>
                    <div className="ai-v2-panel-head">
                      <div><span>MARKET LINK</span><strong>실시간 시장 연동</strong></div>
                      <button type="button" onClick={()=>setAiMarketExpanded((value)=>!value)}>{aiMarketExpanded ? "접기" : `펼쳐보기 · ${aiMarketRows.length}개`}</button>
                    </div>
                    {!aiMarketExpanded ? <div style={{padding:"12px 2px 3px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",fontSize:"10px",color:"#78838c"}}><span>주식 {aiMarketRows.filter((item)=>item.type !== "crypto").length} · 코인 {aiMarketRows.filter((item)=>item.type === "crypto").length}</span><b style={{color:"#44515b"}}>최근 시장 데이터를 보조 지표로 분석 중</b></div> : <div className="ai-v2-market-grid">
                      {aiMarketRows.length ? aiMarketRows.map((item) => {
                        const pct = Number(item.changePct || 0);
                        return (
                          <div className="ai-v2-market-row" key={item.symbol}>
                            <div className={`ai-v2-asset-icon ${item.type === "crypto" ? "crypto" : "stock"}`}>{item.type === "crypto" ? "◆" : "●"}</div>
                            <div className="ai-v2-market-name"><strong>{item.name}</strong><span>{item.symbol}</span></div>
                            <div className="ai-v2-market-price"><strong>{aiFormatMarketPrice(item)}</strong><span className={pct > 0 ? "is-profit" : pct < 0 ? "is-loss" : ""}>{pct > 0 ? "▲ " : pct < 0 ? "▼ " : ""}{aiSignedPct(pct)}</span></div>
                          </div>
                        );
                      }) : <div className="ai-v2-market-empty">시장 데이터를 불러오는 중입니다.</div>}
                    </div>}
                  </section>
                </div>

                <section className="ai-v2-panel ai-v2-log-panel">'''
text = text[:start_i] + market_replacement + text[end_i + len(market_end):]

# Remove technical/internal linkage disclaimer completely.
disclaimer = '''
                <div className="ai-v2-disclaimer">
                  <b>연동 기준</b> · 실제 3분 시장 움직임을 기준으로 연동 종목을 선택하고, 현재금액과 자산 그래프는 서버에서 3분 단위로 갱신합니다. 지급 결과는 3분 스냅샷 1건으로 기록되며 실제 주문·체결 내역을 의미하지 않습니다.
                </div>'''
if disclaimer in text:
    text = text.replace(disclaimer, '', 1)

# AI demo card in AI PROCESS page for selected users.
demo_anchor = '                {profile?.role !== "admin" && aiSessions.length > 1 && ('
demo_card = '''                {profile?.role !== "admin" && aiDemo && (
                  <section style={{margin:"0 0 14px",padding:"14px 16px",borderRadius:"16px",border:"1px solid #b9d5ef",background:"linear-gradient(145deg,#f0f7ff,#e7f1fb)",color:"#193a5a"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}><div><span style={{display:"block",fontSize:"8px",fontWeight:900,letterSpacing:"1.2px",color:"#5d82a4"}}>SIMULATION MODE</span><strong style={{display:"block",marginTop:"4px",fontSize:"15px"}}>AI PROCESS 모의체험 {aiDemo.status === "running" ? "진행 중" : "완료"}</strong><p style={{margin:"5px 0 0",fontSize:"10px",color:"#627d95"}}>실제 투자금과 분리된 이벤트 체험금으로 운영됩니다.</p></div><div style={{textAlign:"right"}}><small style={{display:"block",fontSize:"9px",color:"#728ba1"}}>현재 체험금</small><b style={{display:"block",marginTop:"3px",fontSize:"16px"}}>{aiKrw(aiDemo.current_amount)}</b><em className={Number(aiDemo.total_profit||0)>=0?"is-profit":"is-loss"} style={{fontStyle:"normal",fontSize:"10px",fontWeight:900}}>{aiSignedKrw(aiDemo.total_profit||0)} · {aiSignedPct(aiDemo.total_return||0)}</em></div></div>
                    {aiDemo.last_asset_name && <div style={{marginTop:"10px",paddingTop:"9px",borderTop:"1px solid #cfe0ef",fontSize:"10px",display:"flex",justifyContent:"space-between",gap:"10px"}}><span>최근 연동 · {aiDemo.last_asset_name}</span><b className={Number(aiDemo.last_market_pct)>=0?"is-profit":"is-loss"}>{aiSignedPct(aiDemo.last_market_pct||0)}</b></div>}
                  </section>
                )}

'''
text = must_replace(text, demo_anchor, demo_card + demo_anchor, 'ai demo card')

PAGE.write_text(text, encoding='utf-8')
print('V44 platform upgrade patch applied')
