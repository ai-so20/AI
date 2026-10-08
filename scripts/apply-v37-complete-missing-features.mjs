import fs from 'node:fs';

function mustReplace(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`anchor not found: ${label}`);
  return source.replace(search, replacement);
}

// ------------------------------------------------------------
// 1) Member/admin UI: PWA install notice + dismiss forever + prize catalog UI
// ------------------------------------------------------------
{
  const path = 'app/page.js';
  let s = fs.readFileSync(path, 'utf8');
  const marker = 'V37 COMPLETE MISSING FEATURES';
  if (!s.includes(marker)) {
    s = mustReplace(
      s,
      '  const [eventSuccess, setEventSuccess] = useState(null);\n',
      '  const [eventSuccess, setEventSuccess] = useState(null);\n  const [eventPrizes, setEventPrizes] = useState([]);\n  const [newEventPrize, setNewEventPrize] = useState("");\n  const [prizeWorking, setPrizeWorking] = useState(false);\n  const [installDismissed, setInstallDismissed] = useState(false); // V37 COMPLETE MISSING FEATURES\n',
      'page states'
    );

    const functionAnchor = '  async function loadAutoEvents() {';
    const helpers = `  function dismissInstallGuideForever() {\n    setShowInstallGuide(false);\n    setInstallDismissed(true);\n    if (typeof window !== "undefined") window.localStorage.setItem("vip-install-dismissed-v1", "1");\n  }\n\n  async function loadEventPrizes() {\n    if (profile?.role !== "admin") return;\n    const { data, error } = await supabase\n      .from("event_prize_catalog")\n      .select("id,name,is_active,is_selected,created_at,updated_at")\n      .eq("is_active", true)\n      .order("is_selected", { ascending: false })\n      .order("created_at", { ascending: true });\n    if (error) {\n      console.error("상품 목록 조회 오류:", error);\n      return;\n    }\n    setEventPrizes(data || []);\n  }\n\n  async function addEventPrize() {\n    const name = newEventPrize.trim();\n    if (name.length < 2 || prizeWorking) return;\n    setPrizeWorking(true);\n    const { error } = await supabase.rpc("admin_add_event_prize", { p_name: name });\n    if (error) setNotice(\`상품 등록 실패: \${error.message}\`);\n    else {\n      setNewEventPrize("");\n      setNotice(\`기프티콘 상품 “\${name}”을 등록했습니다.\`);\n      await loadEventPrizes();\n    }\n    setPrizeWorking(false);\n  }\n\n  async function selectEventPrize(id, name) {\n    if (prizeWorking) return;\n    setPrizeWorking(true);\n    const { error } = await supabase.rpc("admin_select_event_prize", { p_id: id });\n    if (error) setNotice(\`상품 선택 실패: \${error.message}\`);\n    else {\n      setNotice(\`앞으로 시작할 이벤트 상품을 “\${name}”으로 설정했습니다.\`);\n      await Promise.all([loadEventPrizes(), loadAutoEvents()]);\n    }\n    setPrizeWorking(false);\n  }\n\n  async function disableEventPrize(id) {\n    if (prizeWorking) return;\n    setPrizeWorking(true);\n    const { error } = await supabase.rpc("admin_disable_event_prize", { p_id: id });\n    if (error) setNotice(\`상품 비활성화 실패: \${error.message}\`);\n    else await loadEventPrizes();\n    setPrizeWorking(false);\n  }\n\n  useEffect(() => {\n    if (typeof window === "undefined") return;\n    setInstallDismissed(window.localStorage.getItem("vip-install-dismissed-v1") === "1");\n  }, []);\n\n  useEffect(() => {\n    if (profile?.role === "admin") loadEventPrizes();\n  }, [profile?.role]);\n\n`;
    s = mustReplace(s, functionAnchor, helpers + functionAnchor, 'page helpers');

    const navAnchor = '          </nav>\n\n          {showAvatarPicker && (';
    const installBanner = `          </nav>\n\n          {profile?.role !== "admin" && !isStandaloneApp && !installDismissed && (\n            <div style={{margin:"0 12px 10px",padding:"10px 12px",border:"1px solid #e5c98f",borderRadius:"14px",background:"linear-gradient(135deg,#fff8e8,#f8ead0)",display:"flex",alignItems:"center",gap:"10px",boxShadow:"0 5px 18px rgba(92,62,25,.08)"}}>\n              <div style={{fontSize:"22px",lineHeight:1}}>📲</div>\n              <div style={{minWidth:0,flex:1}}><b style={{display:"block",fontSize:"12px",color:"#3d2c22"}}>AI PROCESS VIP 앱으로 더 편하게 이용하세요</b><span style={{display:"block",marginTop:"2px",fontSize:"10px",color:"#8b735e"}}>바탕화면에 설치하면 VIP 라운지를 바로 열 수 있습니다.</span></div>\n              <button type="button" onClick={installVipApp} style={{border:"1px solid #c9943d",background:"#fff",color:"#6b4619",borderRadius:"10px",padding:"7px 10px",fontSize:"10px",fontWeight:900,cursor:"pointer",whiteSpace:"nowrap"}}>앱 설치</button>\n              <button type="button" onClick={dismissInstallGuideForever} style={{border:0,background:"transparent",color:"#9c8773",fontSize:"10px",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>다시 안 보기</button>\n            </div>\n          )}\n\n          {showAvatarPicker && (`;
    s = mustReplace(s, navAnchor, installBanner, 'install banner');

    const guideAnchor = '                    <button type="button" onClick={() => setShowInstallGuide(false)} style={styles.installGuideOk}>확인</button>\n                  </>\n                )}\n              </div>';
    const guideReplacement = '                    <button type="button" onClick={() => setShowInstallGuide(false)} style={styles.installGuideOk}>확인</button>\n                  </>\n                )}\n                <button type="button" onClick={dismissInstallGuideForever} style={{marginTop:"12px",border:0,background:"transparent",color:"#9a836d",fontSize:"11px",fontWeight:800,cursor:"pointer"}}>이 설치 안내 다시 보지 않기</button>\n              </div>';
    s = mustReplace(s, guideAnchor, guideReplacement, 'install guide dismiss');

    const eventAnchor = '            {chatTab === "event" && (\n              <div style={styles.refEventScreen}>\n';
    const eventAdminPanel = `            {chatTab === "event" && (\n              <div style={styles.refEventScreen}>\n                {profile?.role === "admin" && (\n                  <section style={{margin:"0 0 14px",padding:"14px",border:"1px solid #e1cfb4",borderRadius:"16px",background:"#fffaf2"}}>\n                    <div style={{display:"flex",justifyContent:"space-between",gap:"10px",alignItems:"flex-start",marginBottom:"10px"}}>\n                      <div><span style={{display:"block",fontSize:"9px",fontWeight:900,letterSpacing:"1.2px",color:"#a77a3f"}}>EVENT PRIZE</span><strong style={{display:"block",marginTop:"3px",fontSize:"15px",color:"#34251d"}}>기프티콘 상품 관리</strong><small style={{display:"block",marginTop:"3px",fontSize:"10px",color:"#8d7867"}}>선택한 상품명이 이후 예약 이벤트와 당첨 안내에 자동 반영됩니다.</small></div>\n                      <span style={{padding:"5px 8px",borderRadius:"999px",background:"#f4e6ca",fontSize:"9px",fontWeight:900,color:"#7c5724"}}>{eventPrizes.length} ITEMS</span>\n                    </div>\n                    <div style={{display:"flex",gap:"7px",marginBottom:"10px"}}>\n                      <input value={newEventPrize} onChange={(e)=>setNewEventPrize(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();addEventPrize();}}} placeholder="예: 스타벅스 아메리카노" style={{flex:1,minWidth:0,border:"1px solid #dccbb6",borderRadius:"10px",padding:"9px 10px",background:"#fff",fontSize:"11px"}}/>\n                      <button type="button" disabled={prizeWorking || newEventPrize.trim().length<2} onClick={addEventPrize} style={{border:"1px solid #c7903b",borderRadius:"10px",padding:"8px 11px",background:"#fff0cf",color:"#6b4619",fontSize:"10px",fontWeight:900,cursor:"pointer"}}>상품 등록</button>\n                    </div>\n                    <div style={{display:"flex",flexWrap:"wrap",gap:"7px"}}>\n                      {eventPrizes.map((prize)=>(\n                        <div key={prize.id} style={{display:"flex",alignItems:"center",gap:"5px",padding:"5px 6px 5px 9px",border:prize.is_selected?"1px solid #c5903a":"1px solid #ddd0bf",borderRadius:"999px",background:prize.is_selected?"#fff0cf":"#fff"}}>\n                          <button type="button" disabled={prizeWorking || prize.is_selected} onClick={()=>selectEventPrize(prize.id,prize.name)} style={{border:0,background:"transparent",padding:0,color:prize.is_selected?"#7b4c12":"#5f5145",fontSize:"10px",fontWeight:900,cursor:prize.is_selected?"default":"pointer"}}>{prize.is_selected?"✓ 현재 상품 · ":"선택 · "}{prize.name}</button>\n                          {!prize.is_selected && <button type="button" onClick={()=>disableEventPrize(prize.id)} style={{width:"18px",height:"18px",border:0,borderRadius:"50%",background:"#f4eee6",color:"#9a7f67",fontSize:"11px",cursor:"pointer"}} aria-label="상품 비활성화">×</button>}\n                        </div>\n                      ))}\n                    </div>\n                  </section>\n                )}\n`;
    s = mustReplace(s, eventAnchor, eventAdminPanel, 'admin prize panel');

    fs.writeFileSync(path, s);
  }
}

// ------------------------------------------------------------
// 2) Event runtime: atomic one-time announcement + group_message_id
// ------------------------------------------------------------
{
  const path = 'app/api/event-runtime/route.js';
  let s = fs.readFileSync(path, 'utf8');
  s = s.replace(/async function ensureAnnouncement\(db, event, admin\) \{[\s\S]*?\n\}\n\nasync function ensureCommunityEvent/, `async function ensureAnnouncement(db, event, admin) {\n  if (!admin || event.status !== "active" || event.group_message_id) return false;\n  const { data, error } = await db.rpc("ensure_event_start_announcement", { p_event_id: event.id });\n  if (error) throw error;\n  return Boolean(data);\n}\n\nasync function ensureCommunityEvent`);
  s = mustReplace(
    s,
    '.select("id,room_id,title,description,prize,event_type,status,starts_at,ends_at,auto_event,schedule_date")',
    '.select("id,room_id,title,description,prize,event_type,status,starts_at,ends_at,auto_event,schedule_date,group_message_id")',
    'event select group_message_id'
  );
  fs.writeFileSync(path, s);
}

// ------------------------------------------------------------
// 3) AI community: queue kinds normalized + human-like variable turn timing
// ------------------------------------------------------------
{
  const path = 'app/lib/ai-community.js';
  let s = fs.readFileSync(path, 'utf8');
  s = s.replace('const FIXED_AI_TURN_DELAY_SECONDS = 60;\n', '');
  const randAnchor = `function randInt(min, max) {\n  const low = Math.ceil(Number(min || 0));\n  const high = Math.floor(Number(max || low));\n  if (high <= low) return low;\n  return Math.floor(Math.random() * (high - low + 1)) + low;\n}\n`;
  if (s.includes(randAnchor) && !s.includes('function nextAiTurnDelaySeconds()')) {
    s = s.replace(randAnchor, `${randAnchor}\nfunction nextAiTurnDelaySeconds() {\n  // 같은 간격으로 기계적으로 말하지 않도록 일반 대화 턴 간격을 흔듭니다.\n  return randInt(25, 110);\n}\n`);
  }
  s = s.replaceAll('FIXED_AI_TURN_DELAY_SECONDS', 'nextAiTurnDelaySeconds()');
  s = s.replaceAll(
    'turnKind: thread.thread_type,',
    'turnKind: ["human_reply","welcome","celebration","loss","event_start","event_winner"].includes(thread.thread_type) ? thread.thread_type : "continue",'
  );
  fs.writeFileSync(path, s);
}

console.log('V37 complete feature patch applied');
