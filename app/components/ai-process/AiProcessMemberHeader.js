"use client";

import { aiKrw, aiTime, aiSignedKrw, aiSignedPct, aiRemainingText } from "../../lib/ai-process-utils";

export default function AiProcessMemberHeader({ hidden=false, session, sessions=[], countdown, simUpdatedAt, displayAmount, displayProfit, displayReturn, lastResult, onSelectProcess }) {
  if (hidden) return null;
  const running = session?.status === "running";
  const runningCount = sessions.filter((item) => item.status === "running").length;

  return (
    <>
      <section className="fin-process-head">
        <div className="fin-process-headline">
          <div>
            <span className="fin-kicker">AI PROCESS</span>
            <h2>{running ? "운용 현황" : "PROCESS 현황"}</h2>
          </div>
          <span className={`fin-state ${running ? "is-running" : ""}`}><i />{running ? "RUNNING" : "READY"}</span>
        </div>

        <div className="fin-valuation">
          <span>현재 평가금액</span>
          <strong>{running ? aiKrw(displayAmount) : "대기 중"}</strong>
          {running && <div className={`fin-return ${displayProfit >= 0 ? "is-profit" : "is-loss"}`}><b>{aiSignedKrw(displayProfit)}</b><span>{aiSignedPct(displayReturn)}</span></div>}
        </div>

        <div className="fin-live-meta">
          <div><span>다음 반영</span><b>{countdown}</b></div>
          <div><span>최근 반영</span><b>{aiTime(simUpdatedAt)}</b></div>
          <div><span>진행 PROCESS</span><b>{runningCount}건</b></div>
        </div>
        {lastResult && <p className="fin-last-signal">최근 반영 · {lastResult.name} <b>{aiSignedPct(lastResult.intervalPct)}</b></p>}
      </section>

      {sessions.length > 1 && (
        <section className="fin-process-list">
          <div className="fin-section-title"><div><span>MY PROCESS</span><h3>운용 내역</h3></div><small>전체 {sessions.length}건</small></div>
          <div className="fin-process-scroll">
            {sessions.map((item,index)=><button type="button" key={item.id || `${item.started_at}-${index}`} className={item.id===session?.id?"is-active":""} onClick={()=>onSelectProcess?.(item)}>
              <span>{item.status === "running" ? "진행 중" : item.status === "completed" ? "완료" : "종료"}</span>
              <strong>{aiKrw(item.current_amount || item.start_amount)}</strong>
              <em className={Number(item.total_profit||0)>=0?"is-profit":"is-loss"}>{aiSignedKrw(item.total_profit||0)}</em>
              <small>{item.status === "running" ? (item.ends_at ? aiRemainingText({startedAt:item.started_at,durationHours:item.duration_hours}) : "기간 미정") : `PROCESS #${String(item.id||"").slice(0,6).toUpperCase()}`}</small>
            </button>)}
          </div>
        </section>
      )}
    </>
  );
}
