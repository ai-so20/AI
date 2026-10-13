import fs from "node:fs";

const path = "app/page.js";
let source = fs.readFileSync(path, "utf8");

const legacyMarketBlock = `    const aiMarketRows = Array.isArray(aiSim?.marketRows) ? aiSim.marketRows : [];
    const aiRecentResults = Array.isArray(aiSim?.resultHistory) ? aiSim.resultHistory.slice(0, 14) : [];
    const aiCurrentStartMoney = aiStartMoney();`;

if (!source.includes(legacyMarketBlock)) {
  throw new Error("P1-13 market block anchor not found");
}

source = source.replace(
  legacyMarketBlock,
  `    const aiRecentResults = Array.isArray(aiSim?.resultHistory) ? aiSim.resultHistory.slice(0, 14) : [];
    const aiCurrentStartMoney = aiStartMoney();`
);

const deadMarketCalculations = `    const aiPositiveMarkets = aiMarketRows.filter((item) => Number(item.changePct) > 0).length;
    const aiNegativeMarkets = aiMarketRows.filter((item) => Number(item.changePct) < 0).length;
    const aiStockRows = aiMarketRows.filter((item) => item.type !== "crypto");
    const aiCryptoRows = aiMarketRows.filter((item) => item.type === "crypto");
    const aiAvgPct = (rows) => rows.length ? rows.reduce((sum, item) => sum + Number(item.changePct || 0), 0) / rows.length : 0;
    const aiStockAvgPct = aiAvgPct(aiStockRows);
    const aiCryptoAvgPct = aiAvgPct(aiCryptoRows);
    const aiTopGainers = [...aiMarketRows].filter((item) => Number(item.changePct || 0) > 0).sort((a,b)=>Number(b.changePct||0)-Number(a.changePct||0)).slice(0,3);
    const aiTopLosers = [...aiMarketRows].filter((item) => Number(item.changePct || 0) < 0).sort((a,b)=>Number(a.changePct||0)-Number(b.changePct||0)).slice(0,3);
    const aiMarketMood = aiPositiveMarkets > aiNegativeMarkets ? "상승 우위" : aiNegativeMarkets > aiPositiveMarkets ? "하락 우위" : "혼조";
    const aiLastMarketTime = aiLastResult?.at ? aiTime(aiLastResult.at) : "대기 중";
`;

if (!source.includes(deadMarketCalculations)) {
  throw new Error("P1-13 legacy market calculations not found");
}

const candidateNames = [
  "aiMarketRows",
  "aiPositiveMarkets",
  "aiNegativeMarkets",
  "aiStockRows",
  "aiCryptoRows",
  "aiAvgPct",
  "aiStockAvgPct",
  "aiCryptoAvgPct",
  "aiTopGainers",
  "aiTopLosers",
  "aiMarketMood",
  "aiLastMarketTime",
];

const withoutLegacyMarket = source.replace(deadMarketCalculations, "");
for (const name of candidateNames) {
  if (withoutLegacyMarket.includes(name)) {
    throw new Error(`P1-13 safety check failed: ${name} is still used outside the legacy block`);
  }
}
source = withoutLegacyMarket;

source = source.replace("      byAsset: aiImpactByAsset,\n", "");
if (source.includes("aiImpactByAsset")) {
  throw new Error("P1-13 safety check failed: aiImpactByAsset still used");
}

const deadSessionSummaryBlock = `    const aiCompletedCount = ["completed", "stopped"].includes(aiSession?.status) ? 1 : 0;
    const aiTodayLabel = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
    const aiTodayProfit = (Array.isArray(aiSim?.resultHistory) ? aiSim.resultHistory : []).reduce((sum, item) => {
      if (!item?.at) return sum;
      const itemLabel = new Date(item.at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
      return itemLabel === aiTodayLabel ? sum + Number(item.intervalProfit || 0) : sum;
    }, 0);
    const aiProgressPct = aiSession?.status === "running" && aiSession?.ends_at
      ? Math.max(4, Math.min(100, ((Date.now() - new Date(aiSession.started_at).getTime()) / (Math.max(1, Number(aiSession.duration_hours)) * 3600000)) * 100))
      : 0;
`;

if (!source.includes(deadSessionSummaryBlock)) {
  throw new Error("P1-13 dead session summary block not found");
}

const sessionCandidateNames = ["aiCompletedCount", "aiTodayLabel", "aiTodayProfit", "aiProgressPct"];
const withoutSessionSummary = source.replace(deadSessionSummaryBlock, "");
for (const name of sessionCandidateNames) {
  if (withoutSessionSummary.includes(name)) {
    throw new Error(`P1-13 safety check failed: ${name} is still used outside the dead summary block`);
  }
}
source = withoutSessionSummary;

fs.writeFileSync(path, source);
console.log("P1-13 removed unused AI PROCESS legacy market/session derivations");