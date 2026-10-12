"use client";

import { aiKrw, aiTime, aiSignedKrw, aiSignedPct } from "../../lib/ai-process-utils";

export default function AiProcessChartPanel({
  hidden,
  session,
  displayAmount,
  startMoney,
  lastResult,
  chart,
  chartHover,
  setChartHover,
}) {
  return (
    <div className="ai-v2-workspace" style={hidden ? { display: "none" } : undefined}>
      <section className="ai-v2-panel ai-v2-chart-panel">
        <div className="ai-v2-panel-head">
          <div>
            <span>내 PROCESS 변화</span>
            <strong>평가금액 변화</strong>
          </div>
          <span className="ai-v50-auto-badge">PROCESS 자동 반영</span>
        </div>

        <div className="ai-v2-chart-kpis">
          <div><span>현재</span><b>{session ? aiKrw(displayAmount) : "-"}</b></div>
          <div><span>시작</span><b>{session ? aiKrw(startMoney) : "-"}</b></div>
          <div><span>3분 연동</span><b>{lastResult ? `${lastResult.name} ${aiSignedPct(lastResult.intervalPct)}` : "대기 중"}</b></div>
        </div>

        <div className="ai-v2-chart-wrap">
          {chart.nodes.length > 1 ? (
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="AI PROCESS 누적 자산 그래프">
              <defs>
                <linearGradient id="aiV2Area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5fd1a0" stopOpacity=".34" />
                  <stop offset="100%" stopColor="#5fd1a0" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[60, 120, 180, 240].map((y) => <line key={y} x1="52" y1={y} x2="866" y2={y} className="ai-v2-grid-line" />)}
              <line x1="52" y1={chart.baselineY} x2="866" y2={chart.baselineY} className="ai-v2-baseline" />
              {chart.areaPath && <path d={chart.areaPath} fill="url(#aiV2Area)" />}
              <polyline points={chart.points} className="ai-v2-performance-line" />
              {chart.nodes.slice(-24).map((node, index) => (
                <circle
                  key={`${node.at || index}-${index}`}
                  cx={node.x}
                  cy={node.y}
                  r={node.delta ? 5.2 : 3.2}
                  className={Number(node.delta || 0) < 0 ? "ai-v2-point is-loss" : Number(node.delta || 0) > 0 ? "ai-v2-point is-profit" : "ai-v2-point"}
                  onMouseEnter={() => setChartHover(node)}
                  onMouseLeave={() => setChartHover(null)}
                  onClick={() => {
                    setChartHover((current) => current?.at === node.at ? null : node);
                    window.setTimeout(() => document.querySelector(`[data-ai-at="${node.at}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
                  }}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </svg>
          ) : (
            <div className="ai-v2-chart-empty">첫 3분 시장 구간을 기록하고 있습니다.</div>
          )}

          {chartHover && (
            <div
              className="ai-v2-custom-tooltip"
              style={{
                position: "absolute",
                left: `${Math.min(88, Math.max(12, (Number(chartHover.x || 0) / chart.width) * 100))}%`,
                top: `${Math.min(82, Math.max(12, (Number(chartHover.y || 0) / chart.height) * 100))}%`,
                transform: "translate(-50%,-118%)",
                zIndex: 5,
                minWidth: "150px",
                padding: "9px 10px",
                borderRadius: "10px",
                background: "rgba(39,31,25,.95)",
                border: "1px solid rgba(224,188,128,.34)",
                boxShadow: "0 8px 22px rgba(43,28,18,.24)",
                color: "#fff8ef",
                pointerEvents: "none",
                fontSize: "10px",
                lineHeight: 1.45,
                whiteSpace: "nowrap",
              }}
            >
              <b style={{ display: "block", marginBottom: "3px" }}>{chartHover.name || "AI PROCESS"}</b>
              <span>{aiTime(chartHover.at)} · {aiSignedKrw(chartHover.delta || 0)}</span><br />
              <span>평가금액 {aiKrw(chartHover.value)}</span>
            </div>
          )}

          <div className="ai-v2-chart-scale ai-v2-chart-scale-top">현재 · {aiKrw(displayAmount)}</div>
          <div className="ai-v2-chart-scale ai-v2-chart-scale-bottom">시작 · {aiKrw(startMoney)}</div>
          <div className="ai-v2-start-line-label">시작금액 기준</div>
        </div>
      </section>
    </div>
  );
}
