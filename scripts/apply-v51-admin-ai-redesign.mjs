import fs from 'node:fs';

let page = fs.readFileSync('app/page.js','utf8');
let css = fs.readFileSync('app/globals.css','utf8');

function replaceOnce(from,to,label){
  if(!page.includes(from)) throw new Error('anchor not found: '+label);
  page = page.replace(from,to);
}

const oldHero = `<section className="ai-v2-hero">
                  <div className="ai-v2-hero-copy">
                    <div className="ai-v2-eyebrow"><span className="ai-v2-live-dot"></span> AI PROCESS · 진행 중</div>
                    <h2>내 AI PROCESS</h2>
                    <p>진행 상태, 평가금액, 수익·손실 기록을 한눈에 확인하세요.</p>
                    <div className="ai-v2-status-row">
                      <span className={\`ai-v2-status \${aiSession?.status === "running" ? "is-running" : "is-done"}\`}>{aiSession?.status === "running" ? "진행 중" : "대기"}</span>
                      <span>다음 PROCESS 갱신 <b>{aiCountdown}</b></span>
                      <span>최근 반영 <b>{aiTime(aiSim?.updatedAt)}</b></span>
                    </div>
                  </div>
                  <div className="ai-v2-hero-result">
                    <span>현재 평가금액</span>
                    <strong>{aiSession?.status === "running" ? aiKrw(aiDisplayAmount) : "대기 중"}</strong>
                    <em className={aiDisplayProfit >= 0 ? "is-profit" : "is-loss"}>
                      {aiSession?.status === "running" ? \`\${aiSignedKrw(aiDisplayProfit)} · \${aiSignedPct(aiDisplayReturn)}\` : ""}
                    </em>
                    {aiLastResult && (
                      <small>최근 연동 · {aiLastResult.name} {aiSignedPct(aiLastResult.intervalPct)}</small>
                    )}
                  </div>
                </section>`;

const newHero = `{profile?.role === "admin" ? (
                  <section className="ai-v51-admin-hero">
                    <div className="ai-v51-admin-hero-copy">
                      <span className="ai-v51-kicker">AI PROCESS ADMIN</span>
                      <h2>AI PROCESS 운영</h2>
                      <p>회원별 운용 상태와 금액을 한 화면에서 관리합니다.</p>
                    </div>
                    <div className="ai-v51-admin-overview">
                      <div><span>진행 중</span><strong>{aiPublicSessions.filter((x)=>x.status === "running").length}</strong><small>명</small></div>
                      <div><span>총 운용금액</span><strong>{aiKrw(aiPublicSessions.filter((x)=>x.status === "running").reduce((sum,x)=>sum+Number(x.current_amount||0),0))}</strong></div>
                      <div><span>누적 손익</span><strong className={aiPublicSessions.reduce((sum,x)=>sum+Number(x.total_profit||0),0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(aiPublicSessions.reduce((sum,x)=>sum+Number(x.total_profit||0),0))}</strong></div>
                    </div>
                  </section>
                ) : (
                  <section className="ai-v2-hero">
                    <div className="ai-v2-hero-copy">
                      <div className="ai-v2-eyebrow"><span className="ai-v2-live-dot"></span> AI PROCESS · 진행 중</div>
                      <h2>내 AI PROCESS</h2>
                      <p>진행 상태, 평가금액, 수익·손실 기록을 한눈에 확인하세요.</p>
                      <div className="ai-v2-status-row">
                        <span className={\`ai-v2-status \${aiSession?.status === "running" ? "is-running" : "is-done"}\`}>{aiSession?.status === "running" ? "진행 중" : "대기"}</span>
                        <span>다음 PROCESS 갱신 <b>{aiCountdown}</b></span>
                        <span>최근 반영 <b>{aiTime(aiSim?.updatedAt)}</b></span>
                      </div>
                    </div>
                    <div className="ai-v2-hero-result">
                      <span>현재 평가금액</span>
                      <strong>{aiSession?.status === "running" ? aiKrw(aiDisplayAmount) : "대기 중"}</strong>
                      <em className={aiDisplayProfit >= 0 ? "is-profit" : "is-loss"}>{aiSession?.status === "running" ? \`\${aiSignedKrw(aiDisplayProfit)} · \${aiSignedPct(aiDisplayReturn)}\` : ""}</em>
                      {aiLastResult && <small>최근 연동 · {aiLastResult.name} {aiSignedPct(aiLastResult.intervalPct)}</small>}
                    </div>
                  </section>
                )}`;
replaceOnce(oldHero,newHero,'hero');

replaceOnce(
  '<section className="ai-v2-admin-console">',
  '<section className="ai-v2-admin-console ai-v51-admin-console">',
  'admin console class'
);
replaceOnce(
  '<div className="ai-v2-admin-head"><div><span>ADMIN CONTROL</span><strong>회원 AI PROCESS 추가</strong></div><small>동일 회원 다중 진행 가능</small></div>',
  '<div className="ai-v2-admin-head"><div><span>NEW PROCESS</span><strong>새 AI PROCESS 시작</strong><p>회원과 운용금액, 진행기간을 지정하면 즉시 시작됩니다.</p></div><small>최소 1시간 · 최대 30일</small></div>',
  'admin console head'
);

replaceOnce(
  '<div className="ai-v2-summary-grid">',
  '<div className="ai-v2-summary-grid" style={profile?.role === "admin" ? {display:"none"} : undefined}>',
  'hide admin summary'
);
replaceOnce(
  '<section className="ai-v2-panel" style={{marginBottom:"14px",padding:"15px 16px"}}>',
  '<section className="ai-v2-panel" style={profile?.role === "admin" ? {display:"none"} : {marginBottom:"14px",padding:"15px 16px"}}>',
  'hide admin stage'
);
replaceOnce(
  '<section className="ai-v2-live-members">',
  '<section className={profile?.role === "admin" ? "ai-v2-live-members ai-v51-member-section" : "ai-v2-live-members"}>',
  'member section class'
);
replaceOnce(
  '<div className="ai-v2-live-member-grid">',
  '<div className={profile?.role === "admin" ? "ai-v2-live-member-grid ai-v51-member-list" : "ai-v2-live-member-grid"}>',
  'member grid class'
);
replaceOnce(
  '<article className={\`ai-v50-control-card \${item.status === "stopped" ? "is-stopped" : ""}\`} key={item.user_id}>',
  '<article className={\`ai-v50-control-card ai-v51-control-row \${item.status === "stopped" ? "is-stopped" : ""}\`} key={item.user_id}>',
  'control row class'
);
replaceOnce(
  '<div className="ai-v2-workspace">',
  '<div className="ai-v2-workspace" style={profile?.role === "admin" ? {display:"none"} : undefined}>',
  'hide admin workspace'
);

css += `\n\n/* V51 admin AI PROCESS redesign */\n.ai-v51-admin-hero{margin:0 0 28px;padding:40px 42px;background:#0b1f3a;color:#fff;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(420px,.75fr);gap:46px;align-items:end;border-radius:4px;box-shadow:none}\n.ai-v51-kicker{display:block;font-size:11px;font-weight:800;letter-spacing:1.8px;color:#7fa8ff;margin-bottom:13px}.ai-v51-admin-hero-copy h2{margin:0;font-size:34px;line-height:1.08;letter-spacing:-1.2px}.ai-v51-admin-hero-copy p{margin:13px 0 0;font-size:14px;line-height:1.65;color:#c3ccda}\n.ai-v51-admin-overview{display:grid;grid-template-columns:.7fr 1.4fr 1.1fr;border-top:1px solid rgba(255,255,255,.22);border-bottom:1px solid rgba(255,255,255,.22)}.ai-v51-admin-overview>div{padding:18px 18px 17px;border-right:1px solid rgba(255,255,255,.16)}.ai-v51-admin-overview>div:first-child{padding-left:0}.ai-v51-admin-overview>div:last-child{border-right:0}.ai-v51-admin-overview span{display:block;font-size:10px;color:#94a6bd}.ai-v51-admin-overview strong{display:inline-block;margin-top:7px;font-size:23px;letter-spacing:-.6px}.ai-v51-admin-overview small{margin-left:4px;color:#9eacbd}.ai-v51-admin-overview .is-profit{color:#77e0b2}.ai-v51-admin-overview .is-loss{color:#ff9b9b}\n.ai-v51-admin-console{margin:0 0 34px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}.ai-v51-admin-console .ai-v2-admin-head{padding:0 0 16px;border-bottom:1px solid #dce2ea;margin-bottom:20px}.ai-v51-admin-console .ai-v2-admin-head span{color:#315be8!important;font-size:10px!important;letter-spacing:1.5px!important}.ai-v51-admin-console .ai-v2-admin-head strong{font-size:22px!important;color:#111827!important;letter-spacing:-.5px}.ai-v51-admin-console .ai-v2-admin-head p{margin:7px 0 0;font-size:12px;color:#6b7280;line-height:1.5}.ai-v51-admin-console .ai-v2-admin-head small{font-size:10px!important;color:#64748b!important}.ai-v51-admin-console .ai-v2-admin-form{display:grid!important;grid-template-columns:1.2fr 1fr 1.1fr auto!important;gap:10px!important;padding:0!important;background:transparent!important}.ai-v51-admin-console select,.ai-v51-admin-console input{height:50px!important;border:1px solid #cfd7e3!important;border-radius:6px!important;background:#fff!important;font-size:13px!important;padding:0 14px!important}.ai-v51-admin-console .ai-v2-duration-control{border:1px solid #cfd7e3!important;border-radius:6px!important;background:#fff!important;padding:5px!important}.ai-v51-admin-console .ai-v2-duration-tabs button{border-radius:4px!important}.ai-v51-admin-console>.ai-v2-admin-form>button{min-width:150px!important;height:50px!important;border-radius:6px!important;background:#315be8!important;color:#fff!important;font-size:12px!important;letter-spacing:.3px!important;box-shadow:none!important}\n.ai-v51-member-section{margin-top:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}.ai-v51-member-section .ai-v2-live-members-head{padding:0 0 15px!important;margin-bottom:0!important;border-bottom:1px solid #dce2ea}.ai-v51-member-section .ai-v2-live-members-head span{color:#315be8!important;font-size:10px!important;letter-spacing:1.4px!important}.ai-v51-member-section .ai-v2-live-members-head strong{font-size:22px!important;color:#111827!important;letter-spacing:-.5px}.ai-v51-member-section .ai-v2-live-members-head small{font-size:11px!important;color:#6b7280!important}.ai-v51-member-section .ai-v2-live-count{background:transparent!important;border:0!important;color:#334155!important;font-size:11px!important;padding:0!important}.ai-v51-member-section .ai-v2-live-count i{background:#315be8!important}\n.ai-v51-member-list{display:block!important}.ai-v51-control-row{display:grid!important;grid-template-columns:220px minmax(390px,1fr) 220px!important;grid-template-areas:'head stats meta' 'head input actions'!important;gap:14px 24px!important;align-items:center!important;padding:22px 0!important;border:0!important;border-bottom:1px solid #e1e6ed!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}.ai-v51-control-row:last-child{border-bottom:0!important}.ai-v51-control-row .ai-v50-control-head{grid-area:head}.ai-v51-control-row .ai-v50-control-member img{width:48px!important;height:48px!important}.ai-v51-control-row .ai-v50-control-member strong{font-size:15px!important;color:#111827!important}.ai-v51-control-row .ai-v50-control-member small{font-size:10px!important;color:#7a8491!important}.ai-v51-control-row .ai-v50-control-head>span{display:none!important}.ai-v51-control-row .ai-v50-control-stats{grid-area:stats;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:0!important}.ai-v51-control-row .ai-v50-control-stats>div{padding:0 16px!important;border:0!important;border-left:1px solid #e3e7ed!important;border-radius:0!important;background:transparent!important}.ai-v51-control-row .ai-v50-control-stats>div:first-child{border-left:0!important;padding-left:0!important}.ai-v51-control-row .ai-v50-control-stats span{font-size:9px!important;color:#8b95a3!important}.ai-v51-control-row .ai-v50-control-stats b{font-size:14px!important;margin-top:6px!important;color:#172033!important}.ai-v51-control-row .ai-v50-control-meta{grid-area:meta;display:block!important;text-align:right;font-size:10px!important;color:#7d8794!important}.ai-v51-control-row .ai-v50-control-meta span{display:block;margin:3px 0}.ai-v51-control-row .ai-v50-control-input{grid-area:input;height:44px;border:1px solid #d4dbe5!important;border-radius:6px!important;background:#fff!important}.ai-v51-control-row .ai-v50-control-actions{grid-area:actions;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important}.ai-v51-control-row .ai-v50-control-actions button,.ai-v51-control-row .ai-v50-restart{min-height:38px!important;border-radius:5px!important;font-size:10px!important;background:#fff!important;border:1px solid #ccd5e1!important;color:#344055!important;box-shadow:none!important}.ai-v51-control-row .ai-v50-control-actions button:nth-child(2){color:#167352!important;background:#f3fbf7!important;border-color:#bfe4d2!important}.ai-v51-control-row .ai-v50-control-actions button:nth-child(3){color:#a44747!important;background:#fff8f7!important;border-color:#edceca!important}.ai-v51-control-row .ai-v50-control-actions button.is-danger{background:#fff!important;color:#bd3838!important;border-color:#dc9d9d!important}.ai-v51-control-row .ai-v50-restart{grid-area:actions!important;background:#315be8!important;color:#fff!important;border-color:#315be8!important}\n@media(max-width:1100px){.ai-v51-admin-hero{grid-template-columns:1fr;padding:32px}.ai-v51-admin-console .ai-v2-admin-form{grid-template-columns:1fr 1fr!important}.ai-v51-control-row{grid-template-columns:1fr!important;grid-template-areas:'head' 'stats' 'meta' 'input' 'actions'!important}.ai-v51-control-row .ai-v50-control-meta{text-align:left!important}}\n@media(max-width:720px){.ai-v51-admin-hero{padding:26px 20px;margin-bottom:22px}.ai-v51-admin-hero-copy h2{font-size:28px}.ai-v51-admin-overview{grid-template-columns:1fr}.ai-v51-admin-overview>div{padding:13px 0!important;border-right:0!important;border-bottom:1px solid rgba(255,255,255,.14)}.ai-v51-admin-overview>div:last-child{border-bottom:0}.ai-v51-admin-console .ai-v2-admin-form{grid-template-columns:1fr!important}.ai-v51-admin-console>.ai-v2-admin-form>button{width:100%!important}.ai-v51-control-row .ai-v50-control-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important;row-gap:14px!important}.ai-v51-control-row .ai-v50-control-stats>div:nth-child(3){border-left:0!important;padding-left:0!important}.ai-v51-control-row .ai-v50-control-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}}\n`;

fs.writeFileSync('app/page.js',page);
fs.writeFileSync('app/globals.css',css);
console.log('V51 admin AI PROCESS redesign applied');
