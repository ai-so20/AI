import { aiKrw, aiSignedKrw, aiSignedPct, aiRemainingText } from "../../lib/ai-process-utils";

export default function AiProcessSummaryPanel({ hidden=false, session, currentStartMoney, displayAmount, displayProfit, displayReturn, simLoading, lastResult }) {
  if (hidden) return null;
  const running=session?.status==="running";
  const statusText=running ? (session?.ends_at ? aiRemainingText({startedAt:session.started_at,durationHours:session.duration_hours}) : "기간 미정") : session?.status==="stopped" ? "종료" : "대기";
  const stageText=session?.status==="stopped" ? "PROCESS 종료" : simLoading ? "시장 분석 중" : running ? "분석 · 반영 진행" : "대기";

  return (
    <section className="fin-account-summary">
      <div className="fin-section-title"><div><span>ACCOUNT</span><h3>운용 정보</h3></div><small>{statusText}</small></div>
      <div className="fin-account-rows">
        <div><span>투자금</span><strong>{session ? aiKrw(currentStartMoney) : "-"}</strong></div>
        <div><span>{session?.status==="stopped"?"최종 평가금액":"평가금액"}</span><strong>{session ? aiKrw(displayAmount) : "-"}</strong></div>
        <div><span>누적 손익</span><strong className={displayProfit>=0?"is-profit":"is-loss"}>{session ? aiSignedKrw(displayProfit) : "-"}</strong></div>
        <div><span>수익률</span><strong className={displayProfit>=0?"is-profit":"is-loss"}>{session ? aiSignedPct(displayReturn) : "-"}</strong></div>
      </div>
      <div className="fin-stage-line">
        <span><i className={running?"is-running":""}/>{stageText}</span>
        <p>{lastResult ? `${lastResult.name} 시장 움직임이 최근 결과에 반영되었습니다.` : "시장 데이터를 분석하고 조건에 맞는 대상을 선별합니다."}</p>
      </div>
    </section>
  );
}
