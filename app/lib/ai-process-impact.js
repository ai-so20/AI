export function buildAiImpactSummary(resultHistory, options = {}) {
  const contributorLimit = Number.isFinite(Number(options.contributorLimit))
    ? Math.max(1, Math.floor(Number(options.contributorLimit)))
    : 3;
  const recentLimit = Number.isFinite(Number(options.recentLimit))
    ? Math.max(1, Math.floor(Number(options.recentLimit)))
    : 5;

  const history = Array.isArray(resultHistory) ? resultHistory : [];

  const byAsset = Object.values(
    history.reduce((acc, item) => {
      const key = String(item?.symbol || item?.name || "UNKNOWN");

      if (!acc[key]) {
        acc[key] = {
          symbol: key,
          name: item?.name || key,
          type: item?.type || "stock",
          totalProfit: 0,
          count: 0,
          latestPct: 0,
          latestAt: null,
        };
      }

      acc[key].totalProfit += Number(item?.intervalProfit || 0);
      acc[key].count += 1;

      if (
        !acc[key].latestAt ||
        new Date(item?.at || 0).getTime() > new Date(acc[key].latestAt || 0).getTime()
      ) {
        acc[key].latestAt = item?.at || null;
        acc[key].latestPct = Number(item?.intervalPct || 0);
      }

      return acc;
    }, {})
  );

  const profitContributors = [...byAsset]
    .filter((item) => item.totalProfit > 0)
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, contributorLimit);

  const lossContributors = [...byAsset]
    .filter((item) => item.totalProfit < 0)
    .sort((a, b) => a.totalProfit - b.totalProfit)
    .slice(0, contributorLimit);

  const profitTotal = history.reduce(
    (sum, item) => sum + Math.max(0, Number(item?.intervalProfit || 0)),
    0
  );
  const lossTotal = history.reduce(
    (sum, item) => sum + Math.min(0, Number(item?.intervalProfit || 0)),
    0
  );
  const net = history.reduce(
    (sum, item) => sum + Number(item?.intervalProfit || 0),
    0
  );

  return {
    history,
    byAsset,
    profitContributors,
    lossContributors,
    profitTotal,
    lossTotal,
    net,
    latest: history[0] || null,
    recentRows: history.slice(0, recentLimit),
  };
}
