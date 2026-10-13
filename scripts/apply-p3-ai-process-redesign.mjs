import fs from "node:fs";

const layoutPath = "app/layout.js";
let layout = fs.readFileSync(layoutPath, "utf8");
if (!layout.includes('import "./ai-process-p3.css";')) {
  layout = layout.replace('import "./globals.css";\n', 'import "./globals.css";\nimport "./ai-process-p3.css";\n');
  fs.writeFileSync(layoutPath, layout);
}

const summaryPath = "app/components/ai-process/AiProcessSummaryPanel.js";
const summary = `import { aiKrw, aiSignedKrw, aiSignedPct, aiRemainingText } from "../../lib/ai-process-utils";

export default function AiProcessSummaryPanel({
  hidden = false,
  session,
  currentStartMoney,
  displayAmount,
  displayProfit,
  displayReturn,
  simLoading,
  lastResult,
}) {
  if (hidden) return null;

  const statusText = session?.status === "running"
    ? (session?.ends_at
      ? aiRemainingText({ startedAt: session.started_at, durationHours: session.duration_hours })
      : "기간 미정")
    : session?.status === "stopped"
      ? "PROCESS 종료"
      : "대기";

  const stageText = session?.status === "stopped"
    ? "PROCESS 종료"
    : simLoading
      ? "AI 분석 중"
      : session?.status === "running"
        ? "결과 반영 · 재분석"
        : "대기";

  return (
    <>
      <div className="ai-v2-summary-grid">
        <div className="ai-v2-summary-card">
          <span>시작 운용금액</span>
          <strong>{session ? aiKrw(currentStartMoney) : "대기"}</strong>
          <small>PROCESS 시작 기준</small>
        </div>
        <div className="ai-v2-summary-card">
          <span>{session?.status === "stopped" ? "최종 평가금액" : "현재 평가금액"}</span>
          <strong>{session ? aiKrw(displayAmount) : "-"}</strong>
          <small>{session?.status === "stopped" ? "종료 시점 최종 금액" : "시장 자동 반영"}</small>
        </div>
        <div className="ai-v2-summary-card">
          <span>누적 손익</span>
          <strong className={displayProfit >= 0 ? "is-profit" : "is-loss"}>{session ? aiSignedKrw(displayProfit) : "-"}</strong>
          <small>{session ? aiSignedPct(displayReturn) : "PROCESS WAIT"}</small>
        </div>
      </div>

      <section className="ai-p3-stage-bar">
        <div className="ai-p3-stage-copy">
          <span>현재 단계</span>
          <strong>{stageText}</strong>
          <p>{lastResult ? lastResult.name + " 시장 움직임이 최근 결과에 반영되었습니다." : "시장 데이터를 분석하고 조건에 맞는 대상을 선별합니다."}</p>
        </div>
        <span className={\`ai-p3-stage-status \${session?.status === "running" ? "is-running" : ""}\`}>
          {session?.status === "running" ? statusText : session?.status === "stopped" ? "종료됨" : "대기"}
        </span>
      </section>
    </>
  );
}
`;
fs.writeFileSync(summaryPath, summary);

const checkLayout = fs.readFileSync(layoutPath, "utf8");
const checkSummary = fs.readFileSync(summaryPath, "utf8");
if (!checkLayout.includes('import "./ai-process-p3.css";')) throw new Error("P3 stylesheet import missing");
if (!checkSummary.includes('className="ai-p3-stage-bar"')) throw new Error("P3 stage bar missing");
if ((checkSummary.match(/ai-v2-summary-card/g) || []).length !== 3) throw new Error("P3 summary must contain exactly 3 cards");
console.log("P3 AI PROCESS redesign applied");
