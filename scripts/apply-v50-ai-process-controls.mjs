import fs from 'node:fs';

let page = fs.readFileSync('app/page.js','utf8');
let css = fs.readFileSync('app/globals.css','utf8');

function replaceOnce(from,to,label){
  const next = page.replace(from,to);
  if(next === page) throw new Error('anchor not found: '+label);
  page = next;
}

replaceOnce(
  '  const [aiAccountsWorking, setAiAccountsWorking] = useState(false);',
  '  const [aiAccountsWorking, setAiAccountsWorking] = useState(false);\n  const [aiAdminControlAmounts, setAiAdminControlAmounts] = useState({});',
  'admin control state'
);

page = page.replace(
  /  async function adminStopAiProcess\(targetProcessId\) \{[\s\S]*?\n  \}\n\n  async function updateAiSimulation\(\) \{/,
String.raw`  async function adminStopAiProcess(targetUserId, nickname, currentAmount) {
    if (profile?.role !== "admin" || !targetUserId || aiAdminWorking) return;
    const label = nickname || "회원";
    const amountText = Number.isFinite(Number(currentAmount)) ? aiKrw(currentAmount) : "현재 평가금액";
    if (typeof window !== "undefined" && !window.confirm(label + "님의 AI PROCESS를 종료하시겠습니까?\n최종 평가금액: " + amountText)) return;
    setAiAdminWorking(true);
    try {
      const { error } = await supabase.rpc("admin_stop_ai_process", { target_user_id: targetUserId });
      if (error) throw error;
      setNotice(label + "님의 AI PROCESS를 종료했습니다.");
      await loadAiProcessState();
    } catch (error) {
      console.error(error);
      setNotice(\`AI PROCESS 종료 실패: \${error.message || "오류"}\`);
    } finally { setAiAdminWorking(false); }
  }

  async function adminAdjustAiProcess(targetUserId, adjustmentType, nickname) {
    if (profile?.role !== "admin" || !targetUserId || aiAdminWorking) return;
    const raw = String(aiAdminControlAmounts[targetUserId] || "").replace(/,/g, "");
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) { setNotice("조정할 금액을 입력해주세요."); return; }
    setAiAdminWorking(true);
    try {
      const { error } = await supabase.rpc("admin_adjust_ai_process", {
        target_user_id: targetUserId,
        adjustment_type: adjustmentType,
        adjustment_amount: amount,
      });
      if (error) throw error;
      const actionLabel = adjustmentType === "deposit" ? "투자금을 추가" : adjustmentType === "profit" ? "수익금을 추가" : "손실을 반영";
      setNotice((nickname || "회원") + "님의 AI PROCESS에 " + aiKrw(amount) + " " + actionLabel + "했습니다.");
      setAiAdminControlAmounts((prev) => ({...prev,[targetUserId]:""}));
      await loadAiProcessState();
    } catch (error) {
      console.error(error);
      setNotice(\`AI PROCESS 금액 조정 실패: \${error.message || "오류"}\`);
    } finally { setAiAdminWorking(false); }
  }

  async function adminRestartAiProcess(targetUserId, nickname) {
    if (profile?.role !== "admin" || !targetUserId || aiAdminWorking) return;
    const label = nickname || "회원";
    if (typeof window !== "undefined" && !window.confirm(label + "님의 AI PROCESS를 현재 평가금액 기준으로 재시작하시겠습니까?")) return;
    setAiAdminWorking(true);
    try {
      const { error } = await supabase.rpc("admin_restart_ai_process", { target_user_id: targetUserId });
      if (error) throw error;
      setNotice(label + "님의 AI PROCESS를 재시작했습니다.");
      await loadAiProcessState();
    } catch (error) {
      console.error(error);
      setNotice(\`AI PROCESS 재시작 실패: \${error.message || "오류"}\`);
    } finally { setAiAdminWorking(false); }
  }

  async function updateAiSimulation() {`);
if (!page.includes('adminAdjustAiProcess(targetUserId')) throw new Error('stop/control function patch failed');

replaceOnce(
  '<div><span>진행 중 회원</span><strong>지금 함께 진행 중인 회원</strong><small>다른 회원은 요약 수익만 표시됩니다.</small></div>\n                    <div className="ai-v2-live-count"><i></i>{aiPublicSessions.length}건 진행 중</div>',
  '<div><span>{profile?.role === "admin" ? "PROCESS CONTROL" : "진행 중 회원"}</span><strong>{profile?.role === "admin" ? "회원 AI PROCESS 관리" : "지금 함께 진행 중인 회원"}</strong><small>{profile?.role === "admin" ? "투자금·손익·종료·재시작을 회원별 카드에서 관리합니다." : "다른 회원은 요약 수익만 표시됩니다."}</small></div>\n                    <div className="ai-v2-live-count"><i></i>{profile?.role === "admin" ? `진행 ${aiPublicSessions.filter((x)=>x.status === "running").length} · 종료 ${aiPublicSessions.filter((x)=>x.status === "stopped").length}` : `${aiPublicSessions.length}건 진행 중`}</div>',
  'live member header'
);

const memberCardRegex = /\s*<article className=\{`ai-v2-live-member-card \$\{item\.user_id === user\.id \? "is-me" : ""\}`\} key=\{item\.process_id \|\| `\$\{item\.user_id\}-\$\{item\.started_at\}`\}>[\s\S]*?<\/article>/;
if (!memberCardRegex.test(page)) throw new Error('member card anchor not found');
page = page.replace(memberCardRegex, String.raw`
                        {profile?.role === "admin" ? (
                          <article className={\`ai-v50-control-card \${item.status === "stopped" ? "is-stopped" : ""}\`} key={item.user_id}>
                            <div className="ai-v50-control-head">
                              <div className="ai-v50-control-member"><img src={avatarSrc(item.avatar)} alt=""/><div><strong>{item.nickname}</strong><small>{item.status === "running" ? "AI PROCESS 진행 중" : "AI PROCESS 종료"}</small></div></div>
                              <span className={item.status === "running" ? "is-running" : "is-stopped"}>{item.status === "running" ? "● 진행 중" : "종료됨"}</span>
                            </div>
                            <div className="ai-v50-control-stats">
                              <div><span>투자금</span><b>{aiKrw(item.start_amount || 0)}</b></div>
                              <div><span>현재 평가금액</span><b>{aiKrw(item.current_amount || 0)}</b></div>
                              <div><span>누적 손익</span><b className={Number(item.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(item.total_profit || 0)}</b></div>
                              <div><span>수익률</span><b className={Number(item.total_return || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedPct(item.total_return || 0)}</b></div>
                            </div>
                            <div className="ai-v50-control-meta"><span>{item.ends_at ? aiRemainingText({startedAt:item.started_at,durationHours:item.duration_hours}) : "기간 미정"}</span><span>{item.last_asset_name || (item.status === "running" ? "시장 자동 반영 중" : "최종 결과 확정")}</span></div>
                            {item.status === "running" ? <>
                              <div className="ai-v50-control-input"><input value={aiAdminControlAmounts[item.user_id] || ""} onChange={(e)=>setAiAdminControlAmounts((prev)=>({...prev,[item.user_id]:e.target.value.replace(/[^0-9]/g,"")}))} inputMode="numeric" placeholder="조정 금액 입력"/><span>원</span></div>
                              <div className="ai-v50-control-actions">
                                <button type="button" disabled={aiAdminWorking} onClick={()=>adminAdjustAiProcess(item.user_id,"deposit",item.nickname)}>투자금 추가</button>
                                <button type="button" disabled={aiAdminWorking} onClick={()=>adminAdjustAiProcess(item.user_id,"profit",item.nickname)}>+ 수익금</button>
                                <button type="button" disabled={aiAdminWorking} onClick={()=>adminAdjustAiProcess(item.user_id,"loss",item.nickname)}>- 손실</button>
                                <button type="button" className="is-danger" disabled={aiAdminWorking} onClick={()=>adminStopAiProcess(item.user_id,item.nickname,item.current_amount)}>{aiAdminWorking ? "처리 중..." : "PROCESS 종료"}</button>
                              </div>
                            </> : <button type="button" className="ai-v50-restart" disabled={aiAdminWorking} onClick={()=>adminRestartAiProcess(item.user_id,item.nickname)}>{aiAdminWorking ? "처리 중..." : "PROCESS 재시작"}</button>}
                          </article>
                        ) : (
                          <article className={\`ai-v2-live-member-card \${item.user_id === user.id ? "is-me" : ""}\`} key={item.user_id}>
                            <img src={avatarSrc(item.avatar)} alt=""/>
                            <div className="ai-v2-live-member-main">
                              <div className="ai-v2-live-member-name"><strong>{item.nickname}</strong>{item.user_id === user.id && <em>ME</em>}<span>● 진행 중</span></div>
                              <div className="ai-v2-live-member-profit"><b className={Number(item.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(item.total_profit || 0)}</b><small className={Number(item.total_return || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedPct(item.total_return || 0)}</small></div>
                              <div className="ai-v2-live-member-meta"><span>{item.last_asset_name || "시장 분석 중"}{item.last_market_pct != null ? \` \${aiSignedPct(item.last_market_pct)}\` : ""}</span><time>{aiTime(item.updated_at)}</time></div>
                            </div>
                          </article>
                        )}`);

replaceOnce(
  '<div className="ai-v2-summary-card"><span>시작 운용금액</span><strong>{aiSession?.status === "running" ? aiKrw(aiCurrentStartMoney) : "대기"}</strong><small>프로세스 시작 기준</small></div>\n                  <div className="ai-v2-summary-card"><span>현재 평가금액</span><strong>{aiSession?.status === "running" ? aiKrw(aiDisplayAmount) : "-"}</strong><small>3분 단위 현재금액 갱신</small></div>\n                  <div className="ai-v2-summary-card"><span>누적 손익</span><strong className={aiDisplayProfit >= 0 ? "is-profit" : "is-loss"}>{aiSession?.status === "running" ? aiSignedKrw(aiDisplayProfit) : "-"}</strong><small>{aiSession?.status === "running" ? aiSignedPct(aiDisplayReturn) : "PROCESS WAIT"}</small></div>\n                  <div className="ai-v2-summary-card"><span>진행 기간</span><strong>{aiSession?.status === "running" ? (aiSession?.ends_at ? aiRemainingText({startedAt:aiSession.started_at,durationHours:aiSession.duration_hours}) : "기간 미정") : "대기"}</strong><small>{aiSession?.status === "running" && !aiSession?.ends_at ? "관리자 종료 시까지 진행" : "최대 30일 진행"}</small></div>',
  '<div className="ai-v2-summary-card"><span>시작 운용금액</span><strong>{aiSession ? aiKrw(aiCurrentStartMoney) : "대기"}</strong><small>프로세스 시작 기준</small></div>\n                  <div className="ai-v2-summary-card"><span>{aiSession?.status === "stopped" ? "최종 평가금액" : "현재 평가금액"}</span><strong>{aiSession ? aiKrw(aiDisplayAmount) : "-"}</strong><small>{aiSession?.status === "stopped" ? "종료 시점 최종 금액" : "시장 상황 자동 반영"}</small></div>\n                  <div className="ai-v2-summary-card"><span>누적 손익</span><strong className={aiDisplayProfit >= 0 ? "is-profit" : "is-loss"}>{aiSession ? aiSignedKrw(aiDisplayProfit) : "-"}</strong><small>{aiSession ? aiSignedPct(aiDisplayReturn) : "PROCESS WAIT"}</small></div>\n                  <div className="ai-v2-summary-card"><span>진행 상태</span><strong>{aiSession?.status === "running" ? (aiSession?.ends_at ? aiRemainingText({startedAt:aiSession.started_at,durationHours:aiSession.duration_hours}) : "기간 미정") : aiSession?.status === "stopped" ? "PROCESS 종료" : "대기"}</strong><small>{aiSession?.status === "stopped" ? "최종 결과가 확정되었습니다" : aiSession?.status === "running" && !aiSession?.ends_at ? "관리자 종료 시까지 진행" : "최대 30일 진행"}</small></div>',
  'summary cards'
);

replaceOnce(
  '<div><span style={{display:"block",fontSize:"9px",fontWeight:900,color:"#6b7c76"}}>현재 단계</span><strong style={{display:"block",marginTop:"4px",fontSize:"15px",color:"#263833"}}>{aiSimLoading ? "AI 분석 중" : aiSession?.status === "running" ? "결과 반영 · 재분석" : "대기"}</strong></div>\n                    <span style={{padding:"6px 9px",borderRadius:"999px",background:aiSession?.status === "running"?"#e7f5f0":"#f0f2f1",color:aiSession?.status === "running"?"#32705e":"#7a8581",fontSize:"9px",fontWeight:900}}>{aiSession?.status === "running" ? "자동 진행 중" : "대기"}</span>',
  '<div><span style={{display:"block",fontSize:"9px",fontWeight:900,color:"#6b7c76"}}>현재 단계</span><strong style={{display:"block",marginTop:"4px",fontSize:"15px",color:"#263833"}}>{aiSession?.status === "stopped" ? "PROCESS 종료" : aiSimLoading ? "AI 분석 중" : aiSession?.status === "running" ? "결과 반영 · 재분석" : "대기"}</strong></div>\n                    <span style={{padding:"6px 9px",borderRadius:"999px",background:aiSession?.status === "running"?"#e7f5f0":"#f0f2f1",color:aiSession?.status === "running"?"#32705e":"#7a8581",fontSize:"9px",fontWeight:900}}>{aiSession?.status === "running" ? "자동 진행 중" : aiSession?.status === "stopped" ? "종료됨" : "대기"}</span>',
  'current stage status'
);

replaceOnce(
  '<button type="button" onClick={updateAiSimulation} disabled={aiSimLoading}>{aiSimLoading ? "분석 중" : "지금 갱신"}</button>',
  '<span className="ai-v50-auto-badge">시장 자동 반영</span>',
  'manual refresh button'
);

page = page.replaceAll('aiSession?.status === "running" ? aiKrw(aiDisplayAmount) : "-"','aiSession ? aiKrw(aiDisplayAmount) : "-"');
page = page.replaceAll('aiSession?.status === "running" ? aiKrw(aiCurrentStartMoney) : "-"','aiSession ? aiKrw(aiCurrentStartMoney) : "-"');
page = page.replace('className="ai-v2-panel ai-v2-log-panel"','className="ai-v2-panel ai-v2-log-panel" style={profile?.role === "admin" ? {display:"none"} : undefined}');
page = page.replaceAll('최근 AI PROCESS 연동 기록','최근 운용 기록');

const cssBlock = String.raw`

/* V50 AI PROCESS admin control */
.ai-v50-control-card{border:1px solid #d8e1de;border-radius:18px;background:#fff;padding:16px;box-shadow:0 8px 24px rgba(31,54,47,.06);display:grid;gap:13px}
.ai-v50-control-card.is-stopped{background:#f7f8f7;border-color:#e0e4e2}
.ai-v50-control-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ai-v50-control-member{display:flex;align-items:center;gap:10px;min-width:0}.ai-v50-control-member img{width:42px;height:42px;border-radius:50%;object-fit:cover}.ai-v50-control-member strong{display:block;font-size:14px;color:#24352f}.ai-v50-control-member small{display:block;margin-top:3px;font-size:9px;color:#7a8883}
.ai-v50-control-head>span{padding:7px 10px;border-radius:999px;font-size:9px;font-weight:900;white-space:nowrap}.ai-v50-control-head>span.is-running{background:#e7f5f0;color:#2f6a59}.ai-v50-control-head>span.is-stopped{background:#ecefee;color:#6f7a76}
.ai-v50-control-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.ai-v50-control-stats>div{padding:11px 10px;border-radius:12px;background:#f7faf9;border:1px solid #e3e9e7}.ai-v50-control-stats span{display:block;font-size:8px;color:#82908b}.ai-v50-control-stats b{display:block;margin-top:5px;font-size:12px;color:#293b35}.ai-v50-control-stats b.is-profit{color:#197354}.ai-v50-control-stats b.is-loss{color:#b34949}
.ai-v50-control-meta{display:flex;justify-content:space-between;gap:10px;font-size:9px;color:#74837e}
.ai-v50-control-input{display:flex;align-items:center;border:1px solid #d3ddda;border-radius:12px;background:#fff;padding:0 12px}.ai-v50-control-input input{width:100%;border:0;outline:0;padding:12px 0;font-size:12px;background:transparent}.ai-v50-control-input span{font-size:10px;font-weight:900;color:#6d7c77}
.ai-v50-control-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.ai-v50-control-actions button,.ai-v50-restart{border:1px solid #cad8d4;border-radius:11px;padding:11px 8px;background:#eef6f3;color:#315e52;font-size:10px;font-weight:900;cursor:pointer}.ai-v50-control-actions button:nth-child(2){background:#e8f6ef;color:#21704e}.ai-v50-control-actions button:nth-child(3){background:#fff3f1;color:#a54b45;border-color:#efd8d5}.ai-v50-control-actions button.is-danger{background:#a84949;border-color:#a84949;color:#fff}.ai-v50-restart{width:100%;background:#244d41;color:#fff;border-color:#244d41}.ai-v50-control-actions button:disabled,.ai-v50-restart:disabled{opacity:.55;cursor:default}
.ai-v50-auto-badge{padding:6px 9px;border-radius:999px;background:#eef4f2;color:#5c716a;font-size:9px;font-weight:900}
@media(max-width:720px){.ai-v50-control-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ai-v50-control-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.ai-v50-control-meta{flex-direction:column;gap:4px}}
`;
if(!css.includes('/* V50 AI PROCESS admin control */')) css += cssBlock;

fs.writeFileSync('app/page.js',page);
fs.writeFileSync('app/globals.css',css);
console.log('V50 AI PROCESS controls applied');
