import fs from 'node:fs';

const pagePath = 'app/page.js';
let page = fs.readFileSync(pagePath, 'utf8');

const oldChartSetup = `    const aiRecentResults = Array.isArray(aiSim?.resultHistory) ? aiSim.resultHistory.slice(0, 14) : [];
    const aiCurrentStartMoney = aiStartMoney();
    const aiChart = buildAiChartModel(aiSession?.status === "running" ? (aiSim?.history || []) : [], aiCurrentStartMoney);`;

const newChartSetup = `    const aiRecentResults = Array.isArray(aiSim?.resultHistory) ? aiSim.resultHistory.slice(0, 14) : [];
    const aiCurrentStartMoney = aiStartMoney();
    const aiDisplayAmount = aiSession?.status === "running"
      ? Number(aiSession?.current_amount || aiCurrentStartMoney)
      : aiCurrentStartMoney;
    const aiDisplayProfit = aiDisplayAmount - aiCurrentStartMoney;
    const aiDisplayReturn = aiCurrentStartMoney > 0 ? (aiDisplayProfit / aiCurrentStartMoney) * 100 : 0;
    const aiChartHistory = aiSession?.status === "running" ? [...(aiSim?.history || [])] : [];
    if (aiSession?.status === "running") {
      const lastPoint = aiChartHistory[aiChartHistory.length - 1];
      const lastValue = Number(lastPoint?.value ?? aiCurrentStartMoney);
      if (!Number.isFinite(lastValue) || Math.abs(lastValue - aiDisplayAmount) >= 0.005) {
        const delta = aiDisplayAmount - (Number.isFinite(lastValue) ? lastValue : aiCurrentStartMoney);
        aiChartHistory.push({
          at: aiSession?.last_tick_at || aiSession?.updated_at || aiSim?.updatedAt || new Date().toISOString(),
          value: aiDisplayAmount,
          delta,
          resultType: delta > 0 ? "profit" : delta < 0 ? "loss" : "wait",
          symbol: aiSession?.last_asset_symbol || null,
          name: aiSession?.last_asset_name || "현재 평가금액",
          marketPct: Number(aiSession?.last_market_pct || 0),
        });
      }
    }
    const aiChart = buildAiChartModel(aiChartHistory, aiCurrentStartMoney);`;

if (page.includes(oldChartSetup)) {
  page = page.replace(oldChartSetup, newChartSetup);
} else if (!page.includes('const aiDisplayAmount =')) {
  throw new Error('V31 chart setup target not found');
}

const replacements = [
  [
    '<strong>{aiSession?.status === "running" ? aiKrw(aiSession?.current_amount || aiCurrentStartMoney) : "대기 중"}</strong>',
    '<strong>{aiSession?.status === "running" ? aiKrw(aiDisplayAmount) : "대기 중"}</strong>'
  ],
  [
    '<em className={(aiSession?.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>\n                      {aiSession?.status === "running" ? `${aiSignedKrw(aiSession?.total_profit || 0)} · ${aiSignedPct(aiSession?.total_return || 0)}` : ""}\n                    </em>',
    '<em className={aiDisplayProfit >= 0 ? "is-profit" : "is-loss"}>\n                      {aiSession?.status === "running" ? `${aiSignedKrw(aiDisplayProfit)} · ${aiSignedPct(aiDisplayReturn)}` : ""}\n                    </em>'
  ],
  [
    '<div className="ai-v2-summary-card"><span>현재 평가금액</span><strong>{aiSession?.status === "running" ? aiKrw(aiSession?.current_amount || aiCurrentStartMoney) : "-"}</strong><small>1분 단위 현재금액 갱신</small></div>',
    '<div className="ai-v2-summary-card"><span>현재 평가금액</span><strong>{aiSession?.status === "running" ? aiKrw(aiDisplayAmount) : "-"}</strong><small>1분 단위 현재금액 갱신</small></div>'
  ],
  [
    '<div className="ai-v2-summary-card"><span>누적 손익</span><strong className={(aiSession?.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSession?.status === "running" ? aiSignedKrw(aiSession?.total_profit || 0) : "-"}</strong><small>{aiSession?.status === "running" ? aiSignedPct(aiSession?.total_return || 0) : "PROCESS WAIT"}</small></div>',
    '<div className="ai-v2-summary-card"><span>누적 손익</span><strong className={aiDisplayProfit >= 0 ? "is-profit" : "is-loss"}>{aiSession?.status === "running" ? aiSignedKrw(aiDisplayProfit) : "-"}</strong><small>{aiSession?.status === "running" ? aiSignedPct(aiDisplayReturn) : "PROCESS WAIT"}</small></div>'
  ],
  [
    '<div><span>현재</span><b>{aiSession?.status === "running" ? aiKrw(aiSession?.current_amount || aiCurrentStartMoney) : "-"}</b></div>',
    '<div><span>현재</span><b>{aiSession?.status === "running" ? aiKrw(aiDisplayAmount) : "-"}</b></div>'
  ],
  [
    '<div className="ai-v2-chart-scale ai-v2-chart-scale-top">{aiKrw(aiChart.max)}</div>\n                      <div className="ai-v2-chart-scale ai-v2-chart-scale-bottom">{aiKrw(aiChart.min)}</div>',
    '<div className="ai-v2-chart-scale ai-v2-chart-scale-top">현재 · {aiKrw(aiDisplayAmount)}</div>\n                      <div className="ai-v2-chart-scale ai-v2-chart-scale-bottom">시작 · {aiKrw(aiCurrentStartMoney)}</div>'
  ]
];

for (const [from, to] of replacements) {
  if (page.includes(from)) page = page.replace(from, to);
}

if (!page.includes('현재 · {aiKrw(aiDisplayAmount)}')) {
  throw new Error('V31 chart labels were not applied');
}

fs.writeFileSync(pagePath, page);
console.log('Applied V31 AI PROCESS amount/chart consistency patch');
