"use client";

import { aiKrw, aiTime, aiSignedKrw, aiSignedPct, aiRemainingText } from "../../lib/ai-process-utils";

export default function AiProcessMemberHeader({
  hidden = false,
  session,
  sessions = [],
  countdown,
  simUpdatedAt,
  displayAmount,
  displayProfit,
  displayReturn,
  lastResult,
  onSelectProcess,
}) {
  if (hidden) return null;

  const hasProcess = Boolean(session);
  const isRunning = session?.status === "running";
  const isCompleted = session?.status === "completed";
  const stateLabel = isRunning ? "RUNNING" : isCompleted ? "COMPLETE" : session?.status === "stopped" ? "ENDED" : "WAITING";

  return (
    <>
      <section className="ai-v2-hero ai-editorial-hero">
        <div className="ai-v2-hero-copy">
          <div className="ai-v2-eyebrow"><span className={`ai-v2-live-dot ${isRunning ? "is-running" : ""}`}></span> PRIVATE / AI PROCESS <b>{stateLabel}</b></div>
          <h2>내 AI PROCESS</h2>
          <p>진행 상태, 평가금액, 수익·손실 기록을 한눈에 확인하세요.</p>
          <div className="ai-v2-status-row">
            <span className={`ai-v2-status ${isRunning ? "is-running" : "is-done"}`}>{isRunning ? "진행 중" : isCompleted ? "진행 완료" : "대기"}</span>
            {isRunning && <span>다음 PROCESS 갱신 <b>{countdown}</b></span>}
            <span>최근 반영 <b>{aiTime(simUpdatedAt)}</b></span>
          </div>
        </div>
        <div className="ai-v2-hero-result">
          <span>{isCompleted ? "최종 평가금액" : "현재 평가금액"}</span>
          <strong>{hasProcess ? aiKrw(displayAmount) : "대기 중"}</strong>
          <em className={displayProfit >= 0 ? "is-profit" : "is-loss"}>{hasProcess ? `${aiSignedKrw(displayProfit)} · ${aiSignedPct(displayReturn)}` : ""}</em>
          {lastResult && <small>최근 연동 · {lastResult.name} {aiSignedPct(lastResult.intervalPct)}</small>}
        </div>
      </section>

      {sessions.length > 1 && (
        <section className="ai-v2-process-switcher">
          <div className="ai-v2-process-switcher-head">
            <span>MY PROCESS</span>
            <strong>AI PROCESS 선택</strong>
            <small>{sessions.filter((item) => item.status === "running").length}개 진행 중 · 완료 기록 포함 {sessions.length}개</small>
          </div>
          <div className="ai-v2-process-switcher-list">
            {sessions.map((item, index) => (
              <button
                type="button"
                key={item.id || `${item.started_at}-${index}`}
                className={item.id === session?.id ? "is-active" : ""}
                onClick={() => onSelectProcess?.(item)}
              >
                <span>PROCESS #{String(item.id || "").slice(0, 6).toUpperCase()}</span>
                <b>{aiKrw(item.current_amount || item.start_amount)}</b>
                <em className={Number(item.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(item.total_profit || 0)}</em>
                <small>{item.status === "running" ? (item.ends_at ? aiRemainingText({startedAt:item.started_at,durationHours:item.duration_hours}) : "기간 미정") : item.status === "completed" ? "완료" : "종료"}</small>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
