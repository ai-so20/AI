import { aiKrw, aiTime, aiSignedKrw, aiSignedPct } from "../../lib/ai-process-utils";

export default function AiProcessImpactCard({
  hidden = false,
  countdown = "03:00",
  profitTotal = 0,
  lossTotal = 0,
  net = 0,
  history = [],
  latest = null,
  profitContributors = [],
  lossContributors = [],
  recentRows = [],
}) {
  return (
    <section className="ai-v57b-impact-overview" style={hidden ? { display: "none" } : undefined}>
      <div className="ai-v57b-impact-head">
        <div>
          <span>PROCESS IMPACT</span>
          <strong>내 수익·손실에 반영된 자산</strong>
          <small>시장 전체가 아니라 실제 AI PROCESS 금액에 반영된 기록만 보여줍니다.</small>
        </div>
        <div className="ai-v57b-impact-status">
          <i></i>
          <span>자동 반영 중</span>
          <b>다음 반영 {countdown}</b>
        </div>
      </div>

      <div className="ai-v57b-impact-kpis">
        <div>
          <span>누적 수익 기여</span>
          <strong className="is-profit">{aiSignedKrw(profitTotal)}</strong>
          <small>수익으로 반영된 금액 합계</small>
        </div>
        <div>
          <span>누적 손실 기여</span>
          <strong className="is-loss">{aiSignedKrw(lossTotal)}</strong>
          <small>손실로 반영된 금액 합계</small>
        </div>
        <div>
          <span>PROCESS 순손익</span>
          <strong className={net >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(net)}</strong>
          <small>현재 기록 기준</small>
        </div>
        <div>
          <span>시장 반영 횟수</span>
          <strong>{history.length}회</strong>
          <small>다음 {countdown}</small>
        </div>
      </div>

      <details className="ai-v57b-impact-details">
        <summary>
          <span>상세 영향 보기</span>
          <small>수익·손실 기여 자산과 최근 반영 내역</small>
          <b className="ai-v57b-open-label">펼치기</b>
          <b className="ai-v57b-close-label">접기</b>
        </summary>

        <div className="ai-v57b-impact-main">
          <div className="ai-v57b-latest">
            <span>최근 PROCESS 반영</span>
            <strong>{latest?.name || "반영 대기 중"}</strong>
            {latest ? (
              <div className="ai-v57b-latest-row">
                <b>{latest.symbol}</b>
                <em className={Number(latest.intervalPct) >= 0 ? "is-profit" : "is-loss"}>
                  {aiSignedPct(latest.intervalPct)}
                </em>
                <strong className={Number(latest.intervalProfit) >= 0 ? "is-profit" : "is-loss"}>
                  {aiSignedKrw(latest.intervalProfit)}
                </strong>
              </div>
            ) : null}
            <small>
              {latest?.at
                ? aiTime(latest.at) + " · 반영 후 " + aiKrw(latest.portfolioValue)
                : "첫 시장 반영을 기다리고 있습니다."}
            </small>
          </div>

          <div className="ai-v57b-contributors">
            <div className="is-gain">
              <span>수익 기여 TOP 3</span>
              {profitContributors.length ? (
                profitContributors.map((item) => (
                  <p key={"gain-" + item.symbol}>
                    <b>{item.name}</b>
                    <small>{item.count}회 반영</small>
                    <em className="is-profit">{aiSignedKrw(item.totalProfit)}</em>
                  </p>
                ))
              ) : (
                <small className="ai-v57b-empty">아직 수익 반영 기록이 없습니다.</small>
              )}
            </div>

            <div className="is-loss">
              <span>손실 기여 TOP 3</span>
              {lossContributors.length ? (
                lossContributors.map((item) => (
                  <p key={"loss-" + item.symbol}>
                    <b>{item.name}</b>
                    <small>{item.count}회 반영</small>
                    <em className="is-loss">{aiSignedKrw(item.totalProfit)}</em>
                  </p>
                ))
              ) : (
                <small className="ai-v57b-empty">아직 손실 반영 기록이 없습니다.</small>
              )}
            </div>
          </div>
        </div>

        <div className="ai-v57b-recent">
          <div className="ai-v57b-recent-title">
            <span>최근 반영 내역</span>
            <small>내 평가금액에 실제 반영된 최근 5건</small>
          </div>
          {recentRows.length ? (
            recentRows.map((item, index) => (
              <div className="ai-v57b-recent-row" key={"impact-" + item.at + "-" + item.symbol + "-" + index}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.symbol} · {item.type === "crypto" ? "CRYPTO" : "STOCK"}</span>
                </div>
                <div>
                  <span>시장 변동</span>
                  <b className={Number(item.intervalPct) >= 0 ? "is-profit" : "is-loss"}>{aiSignedPct(item.intervalPct)}</b>
                </div>
                <div>
                  <span>내 PROCESS 반영</span>
                  <b className={Number(item.intervalProfit) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(item.intervalProfit)}</b>
                </div>
                <time>{aiTime(item.at)}</time>
              </div>
            ))
          ) : (
            <div className="ai-v57b-recent-empty">아직 PROCESS 반영 기록이 없습니다.</div>
          )}
        </div>
      </details>
    </section>
  );
}
