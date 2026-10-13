import fs from "node:fs";

const path = "app/page.js";
let source = fs.readFileSync(path, "utf8");

const importAnchor = 'import AiProcessSummaryPanel from "./components/ai-process/AiProcessSummaryPanel";';
const importLine = 'import AiProcessMemberHeader from "./components/ai-process/AiProcessMemberHeader";';
if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error("P1-10 import anchor not found");
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const memberHero = `                  <section className="ai-v2-hero">
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
                  </section>`;

const memberHeader = `                  <AiProcessMemberHeader
                    session={aiSession}
                    sessions={aiSessions}
                    countdown={aiCountdown}
                    simUpdatedAt={aiSim?.updatedAt}
                    displayAmount={aiDisplayAmount}
                    displayProfit={aiDisplayProfit}
                    displayReturn={aiDisplayReturn}
                    lastResult={aiLastResult}
                    onSelectProcess={(item) => {
                      setAiSelectedProcessId(item.id);
                      setAiSession(item);
                      setAiSim(null);
                    }}
                  />`;

if (!source.includes(memberHero)) throw new Error("P1-10 member hero block not found");
source = source.replace(memberHero, memberHeader);

const switcher = `                {profile?.role !== "admin" && aiSessions.length > 1 && (
                  <section className="ai-v2-process-switcher">
                    <div className="ai-v2-process-switcher-head">
                      <span>MY PROCESS</span>
                      <strong>진행 중인 AI PROCESS 선택</strong>
                      <small>{aiSessions.filter((item) => item.status === "running").length}개 진행 중 · 완료 기록 포함 {aiSessions.length}개</small>
                    </div>
                    <div className="ai-v2-process-switcher-list">
                      {aiSessions.map((item, index) => (
                        <button
                          type="button"
                          key={item.id || \`\${item.started_at}-\${index}\`}
                          className={item.id === aiSession?.id ? "is-active" : ""}
                          onClick={() => {
                            setAiSelectedProcessId(item.id);
                            setAiSession(item);
                            setAiSim(null);
                          }}
                        >
                          <span>PROCESS #{String(item.id || "").slice(0, 6).toUpperCase()}</span>
                          <b>{aiKrw(item.current_amount || item.start_amount)}</b>
                          <em className={Number(item.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(item.total_profit || 0)}</em>
                          <small>{item.status === "running" ? (item.ends_at ? aiRemainingText({startedAt:item.started_at,durationHours:item.duration_hours}) : "기간 미정") : item.status === "completed" ? "완료" : "종료"}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                )}`;

if (!source.includes(switcher)) throw new Error("P1-10 process switcher block not found");
source = source.replace(switcher, "");

fs.writeFileSync(path, source);
console.log("P1-10 member header refactor applied");
