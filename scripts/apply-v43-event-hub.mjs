import fs from 'node:fs';

function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`anchor not found: ${label}`);
  return source.replace(from, to);
}

let page = fs.readFileSync('app/page.js', 'utf8');

page = mustReplace(
  page,
  '  const [eventPrizes, setEventPrizes] = useState([]);\n  const [newEventPrize, setNewEventPrize] = useState("");',
  '  const [eventPrizes, setEventPrizes] = useState([]);\n  const [showAllEvents, setShowAllEvents] = useState(false);\n  const [newEventPrize, setNewEventPrize] = useState("");',
  'event state'
);

page = mustReplace(
  page,
  '  async function checkSession() {',
  `  function getVisibleAutoEvents() {\n    const sorted = getSortedAutoEvents();\n    if (showAllEvents) return sorted;\n    const active = sorted.filter((item) => item.status === "active");\n    const scheduled = sorted.filter((item) => item.status === "scheduled").slice(0, 3);\n    const completed = sorted.filter((item) => item.status === "completed").slice(0, 1);\n    return [...active, ...scheduled, ...completed];\n  }\n\n  async function checkSession() {`,
  'visible events helper'
);

const heroAnchor = `                {featuredEvent && (\n                  <div style={{...styles.refHeroEvent, backgroundImage:eventHeroBackground(featuredEvent.event_type)}}>`;
const dashboard = `                <section style={{margin:"0 0 12px",padding:"16px",borderRadius:"18px",background:"linear-gradient(145deg,#fffaf2,#f6ead9)",border:"1px solid #e4d2ba",boxShadow:"0 8px 20px rgba(86,57,35,.08)"}}>\n                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px"}}>\n                    <div>\n                      <span style={{display:"block",fontSize:"9px",fontWeight:900,letterSpacing:"1.4px",color:"#a77839"}}>VIP EVENT CENTER</span>\n                      <strong style={{display:"block",marginTop:"4px",fontSize:"18px",color:"#2f251f"}}>오늘의 VIP 이벤트</strong>\n                      <p style={{margin:"6px 0 0",fontSize:"11px",lineHeight:1.55,color:"#756558"}}>매일 진행되는 LIVE 이벤트에 참여하고 결과와 혜택을 한곳에서 확인하세요. 당첨 결과는 이벤트 종료 후 자동 안내됩니다.</p>\n                    </div>\n                    <span style={{padding:"6px 9px",borderRadius:"999px",background:activeEvent?"#173f35":"#efe1c7",color:activeEvent?"#d9f8ea":"#76552a",fontSize:"9px",fontWeight:900,whiteSpace:"nowrap"}}>{activeEvent ? "LIVE" : "TODAY"}</span>\n                  </div>\n                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:"7px",marginTop:"14px"}}>\n                    {[\n                      ["오늘 회차", autoEvents.length + "회"],\n                      ["내 참여", autoEvents.filter((item)=>item.participated).length + "회"],\n                      ["진행 중", autoEvents.filter((item)=>item.status === "active").length + "회"],\n                      ["완료", autoEvents.filter((item)=>item.status === "completed").length + "회"],\n                    ].map(([label,value]) => (\n                      <div key={label} style={{padding:"10px 6px",borderRadius:"12px",background:"rgba(255,255,255,.72)",border:"1px solid #eadac6",textAlign:"center"}}>\n                        <small style={{display:"block",fontSize:"8px",color:"#9b8979"}}>{label}</small>\n                        <strong style={{display:"block",marginTop:"4px",fontSize:"13px",color:"#33271f"}}>{value}</strong>\n                      </div>\n                    ))}\n                  </div>\n                </section>\n\n${heroAnchor}`;
page = mustReplace(page, heroAnchor, dashboard, 'event dashboard');

page = mustReplace(
  page,
  '<div><strong>오늘의 이벤트</strong><span>자동 진행 일정</span></div>\n                  <small>{autoEvents.length}개 회차</small>',
  '<div><strong>오늘의 이벤트</strong><span>진행 중 · 예정 회차</span></div>\n                  <button type="button" onClick={() => setShowAllEvents((value) => !value)} style={{border:"1px solid #dfc8a8",background:"#fffaf2",color:"#7d5a2e",borderRadius:"999px",padding:"5px 8px",fontSize:"9px",fontWeight:900,cursor:"pointer"}}>{showAllEvents ? "간단히" : `전체 ${autoEvents.length}회`}</button>',
  'event section title'
);

page = mustReplace(
  page,
  '{getSortedAutoEvents().map((item) => {',
  '{getVisibleAutoEvents().map((item) => {',
  'event list compaction'
);

fs.writeFileSync('app/page.js', page);

let community = fs.readFileSync('app/lib/ai-community.js', 'utf8');

community = mustReplace(
  community,
  `function buildReplyLine() {\n  const a = Math.floor(Math.random() * LOCAL_REPLY_A.length);\n  const b = Math.floor(Math.random() * LOCAL_REPLY_B.length);\n  return { id: \`reply-\${a}-\${b}\`, text: \`\${LOCAL_REPLY_A[a]}\${LOCAL_REPLY_B[b] ? \` \${LOCAL_REPLY_B[b]}\` : ""}\`.trim() };\n}`,
  `function buildReplyLine() {\n  const a = Math.floor(Math.random() * LOCAL_REPLY_A.length);\n  return { id: \`reply-\${a}\`, text: LOCAL_REPLY_A[a] };\n}`,
  'autonomous forced suffix'
);

community = mustReplace(
  community,
  `  const label = event?.title || "이벤트";\n  return selected.map((c, i) => ({\n    member_id: c.member_id,\n    message: styleLocalText(c, i === 0 ? \`\${label} 저도 참여했어요ㅎㅎ\` : pickOne(["오 저도 넣었어요ㅋㅋ", "저도 참여 완료!", "이번엔 좀 기대되네요ㅎㅎ"])),\n    act: "agree",\n  }));`,
  `  const eventType = String(event?.event_type || "").toLowerCase();\n  const title = String(event?.title || "");\n  let pool = [\n    "오 이번 것도 해볼게요ㅋㅋ", "저도 슬쩍 참여했어요ㅎㅎ", "이번엔 운 좀 따라줬으면 좋겠네요ㅋㅋ",\n    "저 방금 넣었어요", "이번엔 뭐 나올지 궁금하네요", "저도 방금 했어요ㅋㅋ"\n  ];\n  if (eventType.includes("gift") || title.includes("선물상자")) pool = [\n    "선물상자 뭐 나올지 궁금하네요ㅋㅋ", "저도 하나 골랐어요ㅎㅎ", "이번엔 좋은 거 나왔으면ㅋㅋ",\n    "저 방금 하나 골랐어요ㅋㅋ", "이번 건 괜히 기대되네요ㅎㅎ", "선물상자 은근 고르는 맛 있네요ㅎㅎ"\n  ];\n  else if (eventType.includes("quiz") || title.includes("퀴즈")) pool = [\n    "이번 문제 은근 헷갈리네요ㅋㅋ", "저 답 넣었어요ㅎㅎ", "이건 좀 고민되는데요ㅋㅋ",\n    "이번 문제는 자신 없네요ㅎㅎ", "오 이건 알 것 같기도 한데ㅋㅋ"\n  ];\n  else if (eventType.includes("roulette") || title.includes("룰렛")) pool = [\n    "저도 돌려봤어요ㅋㅋ", "이번엔 어디 걸리려나ㅎㅎ", "룰렛은 괜히 두근거리네요ㅋㅋ", "저도 한번 가봅니다"\n  ];\n  else if (eventType.includes("number") || title.includes("숫자")) pool = [\n    "저도 숫자 하나 찍었어요ㅋㅋ", "이번엔 감으로 골랐어요ㅎㅎ", "숫자 고르는 게 더 어렵네요ㅋㅋ", "이번엔 제 숫자 맞았으면ㅎㅎ"\n  ];\n  else if (eventType.includes("attendance") || title.includes("출석")) pool = [\n    "저도 출석 완료ㅎㅎ", "출석 체크했어요ㅋㅋ", "오늘 것도 챙겼습니다ㅎㅎ", "출석은 놓치면 아쉽죠ㅋㅋ"\n  ];\n  const used = new Set();\n  return selected.map((c) => {\n    let message = pickOne(pool);\n    for (let i = 0; i < 5 && used.has(message); i += 1) message = pickOne(pool);\n    used.add(message);\n    return { member_id: c.member_id, message: styleLocalText(c, message), act: "agree" };\n  });`,
  'event start variety'
);

community = community.replace(
  'const selected = weightedSample(participantCharacters, Math.min(participantCharacters.length, randInt(1, 2)), (c) => Number(c.general_reply_rate || 10) + 5);',
  `const reactionRoll = Math.random();\n    const reactionCount = reactionRoll < 0.30 ? 0 : reactionRoll < 0.85 ? 1 : 2;\n    if (reactionCount === 0) {\n      await db.from("ai_community_events").update({ status: "done", processed_at: now.toISOString() }).eq("id", communityEvent.id);\n      return { started: 0, type: "event_start", skipped: true, apiCalls: 0 };\n    }\n    const selected = weightedSample(participantCharacters, Math.min(participantCharacters.length, reactionCount), (c) => Number(c.general_reply_rate || 10) + 5);`
);

fs.writeFileSync('app/lib/ai-community.js', community);
console.log('V43 event hub patch applied');
