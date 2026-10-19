import { aiKrw, aiSignedKrw, aiSignedPct, aiRemainingText } from "../../lib/ai-process-utils";

function processProgress(session) {
  if (!session) return 0;
  if (session.status === "completed") return 100;
  if (session.status !== "running") return 0;
  const started = new Date(session.started_at || 0).getTime();
  const ended = session.ends_at
    ? new Date(session.ends_at).getTime()
    : started + Number(session.duration_hours || 0) * 60 * 60 * 1000;
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return 0;
  return Math.max(0, Math.min(99.9, ((Date.now() - started) / (ended - started)) * 100));
}

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

  const isCompleted = session?.status === "completed";
  const isStopped = session?.status === "stopped";
  const isRunning = session?.status === "running";
  const progress = processProgress(session);
  const statusText = isRunning
    ? (session?.ends_at
      ? aiRemainingText({ startedAt: session.started_at, durationHours: session.duration_hours })
      : "기간 미정")
    : isCompleted
      ? "100% 완료"
      : isStopped
        ? "PROCESS 종료"
        : "대기";

  const stageText = isCompleted
    ? "PROCESS 완료"
    : isStopped
      ? "PROCESS 종료"
      : simLoading
        ? "AI 분석 중"
        : isRunning
          ? "결과 반영 · 재분석"
          : "대기";

  return (
    <>
      <section className="ai-editorial-data-rail" aria-label="AI PROCESS 핵심 지표">
        <div><span>투자금</span><strong>{session ? aiKrw(currentStartMoney) : "대기"}</strong><small>PROCESS 시작 기준</small></div>
        <div><span>누적 손익</span><strong className={displayProfit >= 0 ? "is-profit" : "is-loss"}>{session ? aiSignedKrw(displayProfit) : "-"}</strong><small>{session ? aiSignedPct(displayReturn) : "PROCESS WAIT"}</small></div>
        <div><span>진행률</span><strong>{session ? `${progress.toFixed(progress >= 100 ? 0 : 1)}%` : "-"}</strong><small>{isCompleted ? "완료" : isRunning ? "현재 진행" : "대기"}</small></div>
        <div><span>남은 시간</span><strong>{session ? statusText : "-"}</strong><small>{isCompleted ? "예정 종료 도달" : "PROCESS 일정"}</small></div>
      </section>

      <section className="ai-editorial-process" aria-label="AI PROCESS 현재 단계">
        <div className="ai-editorial-process-copy">
          <span>PROCESS</span>
          <strong>{stageText}</strong>
          <p>{lastResult ? lastResult.name + " 시장 움직임이 최근 결과에 반영되었습니다." : "시장 데이터를 분석하고 조건에 맞는 대상을 선별합니다."}</p>
        </div>
        <div className="ai-editorial-process-rail" aria-hidden="true">
          <i className={session ? "is-done" : ""}>01 <b>분석</b></i>
          <i className={isRunning || isCompleted || isStopped ? "is-done" : ""}>02 <b>탐색</b></i>
          <i className={isRunning ? "is-current" : isCompleted ? "is-done" : ""}>03 <b>{isCompleted ? "완료" : "반영"}</b></i>
        </div>
      </section>
    </>
  );
}
