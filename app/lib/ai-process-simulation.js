export function parseAiMarketPayload(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("시장 데이터 응답 형식을 확인해주세요.");
  }
}

export function buildAiSimulationSnapshot({
  marketResult,
  logRows,
  session,
  defaultStartMoney,
}) {
  const quotes = (marketResult?.quotes || []).map((item) => ({
    ...item,
    price: Number(item.price),
    beforePrice: Number(item.beforePrice ?? item.price),
    changePct: Number(item.changePct || 0),
  }));

  const results = (Array.isArray(logRows) ? logRows : []).map((row) => ({
    at: row.market_at,
    symbol: row.asset_symbol,
    name: row.asset_name,
    type: row.asset_type,
    intervalPct: Number(row.market_pct || 0),
    intervalProfit: Number(row.delta || 0),
    allocatedKrw: Number(row.amount_before || 0),
    portfolioValue: Number(row.amount_after || 0),
    resultType: row.result_type || "wait",
  }));

  const history = [...results].reverse().map((row) => ({
    at: row.at,
    value: row.portfolioValue,
    delta: row.intervalProfit,
    resultType: row.resultType,
    symbol: row.symbol,
    name: row.name,
    marketPct: row.intervalPct,
  }));

  if (session?.started_at && (!history.length || history[0]?.at !== session.started_at)) {
    history.unshift({
      at: session.started_at,
      value: Number(session.start_amount || defaultStartMoney),
      delta: 0,
      resultType: "start",
      name: "AI PROCESS 시작",
    });
  }

  const startMoney = Number(session?.start_amount || defaultStartMoney);
  const portfolioValue = Number(session?.current_amount || startMoney);
  const totalProfit = portfolioValue - startMoney;
  const totalReturn = startMoney > 0 ? (totalProfit / startMoney) * 100 : 0;

  return {
    startedAt: session?.started_at || marketResult?.updatedAt,
    durationHours: Number(session?.duration_hours || 24),
    portfolioValue,
    totalProfit,
    totalReturn,
    marketRows: quotes,
    resultHistory: results,
    history,
    lastMarketAt: session?.last_market_at || marketResult?.updatedAt,
    updatedAt: session?.updated_at || marketResult?.updatedAt,
  };
}
