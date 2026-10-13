"use client";

import { avatarSrc } from "../../lib/ui-helpers";
import { aiKrw, aiSignedKrw, aiSignedPct, aiTime, aiRemainingText } from "../../lib/ai-process-utils";

export default function AiProcessMembersPanel({
  isAdmin,
  sessions,
  loading,
  currentUserId,
  adminControlAmounts,
  setAdminControlAmounts,
  adminWorking,
  onAdjust,
  onStop,
  onRestart,
}) {
  const rows = Array.isArray(sessions) ? sessions : [];
  const runningCount = rows.filter((item) => item.status === "running").length;
  const stoppedCount = rows.filter((item) => item.status === "stopped").length;

  return (
    <section className={isAdmin ? "ai-v2-live-members ai-v51-member-section" : "ai-v2-live-members"}>
      <div className="ai-v2-live-members-head">
        <div>
          <span>{isAdmin ? "PROCESS CONTROL" : "진행 중 회원"}</span>
          <strong>{isAdmin ? "회원 AI PROCESS 관리" : "지금 함께 진행 중인 회원"}</strong>
          <small>{isAdmin ? "투자금·손익·종료·재시작을 회원별 카드에서 관리합니다." : "다른 회원은 요약 수익만 표시됩니다."}</small>
        </div>
        <div className="ai-v2-live-count">
          <i></i>
          {isAdmin ? `진행 ${runningCount} · 종료 ${stoppedCount}` : `${rows.length}건 진행 중`}
        </div>
      </div>

      {loading && !rows.length ? (
        <div className="ai-v2-live-empty">진행 현황을 불러오는 중입니다.</div>
      ) : rows.length ? (
        <div className={isAdmin ? "ai-v2-live-member-grid ai-v51-member-list" : "ai-v2-live-member-grid"}>
          {rows.map((item) => (
            isAdmin ? (
              <article className={`ai-v50-control-card ai-v51-control-row ${item.status === "stopped" ? "is-stopped" : ""}`} key={item.user_id}>
                <div className="ai-v50-control-head">
                  <div className="ai-v50-control-member">
                    <img src={avatarSrc(item.avatar)} alt=""/>
                    <div>
                      <strong>{item.nickname}</strong>
                      <small>{item.status === "running" ? "AI PROCESS 진행 중" : "AI PROCESS 종료"}</small>
                    </div>
                  </div>
                  <span className={item.status === "running" ? "is-running" : "is-stopped"}>{item.status === "running" ? "● 진행 중" : "종료됨"}</span>
                </div>
                <div className="ai-v50-control-stats">
                  <div><span>투자금</span><b>{aiKrw(item.start_amount || 0)}</b></div>
                  <div><span>현재 평가금액</span><b>{aiKrw(item.current_amount || 0)}</b></div>
                  <div><span>누적 손익</span><b className={Number(item.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(item.total_profit || 0)}</b></div>
                  <div><span>수익률</span><b className={Number(item.total_return || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedPct(item.total_return || 0)}</b></div>
                </div>
                <div className="ai-v50-control-meta">
                  <span>{item.ends_at ? aiRemainingText({startedAt:item.started_at,durationHours:item.duration_hours}) : "기간 미정"}</span>
                  <span>{item.last_asset_name || (item.status === "running" ? "시장 자동 반영 중" : "최종 결과 확정")}</span>
                </div>
                {item.status === "running" ? <>
                  <div className="ai-v50-control-input">
                    <input
                      value={adminControlAmounts[item.user_id] || ""}
                      onChange={(e)=>setAdminControlAmounts((prev)=>({...prev,[item.user_id]:e.target.value.replace(/[^0-9]/g,"")}))}
                      inputMode="numeric"
                      placeholder="조정 금액 입력"
                    />
                    <span>원</span>
                  </div>
                  <div className="ai-v50-control-actions">
                    <button type="button" className="ai-control-profit" disabled={adminWorking} onClick={()=>onAdjust(item.user_id,"profit",item.nickname)}>+ 수익금</button>
                    <button type="button" className="ai-control-deposit" disabled={adminWorking} onClick={()=>onAdjust(item.user_id,"deposit",item.nickname)}>투자금 추가</button>
                    <button type="button" className="ai-control-loss" disabled={adminWorking} onClick={()=>onAdjust(item.user_id,"loss",item.nickname)}>- 손실</button>
                    <button type="button" className="ai-control-stop is-danger" disabled={adminWorking} onClick={()=>onStop(item.user_id,item.nickname,item.current_amount)}>{adminWorking ? "처리 중..." : "PROCESS 종료"}</button>
                  </div>
                </> : (
                  <button type="button" className="ai-v50-restart" disabled={adminWorking} onClick={()=>onRestart(item.user_id,item.nickname)}>{adminWorking ? "처리 중..." : "PROCESS 재시작"}</button>
                )}
              </article>
            ) : (
              <article className={`ai-v2-live-member-card ${item.user_id === currentUserId ? "is-me" : ""}`} key={item.user_id}>
                <img src={avatarSrc(item.avatar)} alt=""/>
                <div className="ai-v2-live-member-main">
                  <div className="ai-v2-live-member-name">
                    <strong>{item.nickname}</strong>
                    {item.user_id === currentUserId && <em>ME</em>}
                    <span>● 진행 중</span>
                  </div>
                  <div className="ai-v2-live-member-profit">
                    <b className={Number(item.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(item.total_profit || 0)}</b>
                    <small className={Number(item.total_return || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedPct(item.total_return || 0)}</small>
                  </div>
                  <div className="ai-v2-live-member-meta">
                    <span>{item.last_asset_name || "시장 분석 중"}{item.last_market_pct != null ? ` ${aiSignedPct(item.last_market_pct)}` : ""}</span>
                    <time>{aiTime(item.updated_at)}</time>
                  </div>
                </div>
              </article>
            )
          ))}
        </div>
      ) : (
        <div className="ai-v2-live-empty">현재 진행 중인 AI PROCESS 회원이 없습니다.</div>
      )}
    </section>
  );
}
