import { aiKrw, aiTime, aiSignedKrw, aiSignedPct } from "../../lib/ai-process-utils";

export default function AiProcessHistoryPanel({
  hidden = false,
  recentResults = [],
  selectedAt = null,
}) {
  return (
    <section className="ai-v2-panel ai-v2-log-panel" style={hidden ? {display:"none"} : undefined}>
      <div className="ai-v2-panel-head">
        <div><span>운용 기록</span><strong>최근 운용 기록</strong></div>
        <div className="ai-v2-history-count">최근 {recentResults.length}건</div>
      </div>
      <div className="ai-v2-history-list">
        {recentResults.length ? recentResults.map((item, index) => (
          <div
            className={`ai-v2-history-row ${selectedAt === item.at ? "is-selected" : ""}`}
            data-ai-at={item.at}
            key={`${item.at}-${item.symbol}-${index}`}
            style={selectedAt === item.at ? {outline:"2px solid #7eb5a5",outlineOffset:"-2px",background:"#f1f8f5"} : undefined}
          >
            <div className={`ai-v2-history-sign ${item.resultType === "loss" || Number(item.intervalProfit) < 0 ? "is-loss" : "is-profit"}`}>
              {item.resultType === "loss" || Number(item.intervalProfit) < 0 ? "−" : "+"}
            </div>
            <div className="ai-v2-history-asset"><strong>{item.name}</strong><span>{item.symbol} · {item.type === "crypto" ? "CRYPTO" : "STOCK"}</span></div>
            <div className="ai-v2-history-market"><span>실제 3분</span><strong className={Number(item.intervalPct) >= 0 ? "is-profit" : "is-loss"}>{aiSignedPct(item.intervalPct)}</strong></div>
            <div className="ai-v2-history-result"><span>AI PROCESS</span><strong className={Number(item.intervalProfit) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(item.intervalProfit)}</strong></div>
            <div className="ai-v2-history-balance"><span>반영 후</span><strong>{aiKrw(item.portfolioValue)}</strong></div>
            <time>{aiTime(item.at)}</time>
          </div>
        )) : (
          <div className="ai-v2-history-empty">시장 연결 후 3분 스냅샷마다 연동 종목과 누적 손익이 기록됩니다.</div>
        )}
      </div>
    </section>
  );
}
