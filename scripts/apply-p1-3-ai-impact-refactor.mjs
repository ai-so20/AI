import fs from "node:fs";

const pagePath = "app/page.js";
let page = fs.readFileSync(pagePath, "utf8");

const importAnchor = 'import { aiKrw, aiTime, aiSignedKrw, aiSignedPct, aiFormatMarketPrice, aiRemainingText, buildAiChartModel } from "./lib/ai-process-utils";';
const impactImport = 'import { buildAiImpactSummary } from "./lib/ai-process-impact";';

if (!page.includes(impactImport)) {
  if (!page.includes(importAnchor)) {
    throw new Error("P1-3 import anchor not found");
  }
  page = page.replace(importAnchor, `${importAnchor}\n${impactImport}`);
}

const oldBlock = `    const aiImpactHistory = Array.isArray(aiSim?.resultHistory) ? aiSim.resultHistory : [];
    const aiImpactByAsset = Object.values(aiImpactHistory.reduce((acc, item) => {
      const key = String(item?.symbol || item?.name || "UNKNOWN");
      if (!acc[key]) acc[key] = { symbol:key, name:item?.name || key, type:item?.type || "stock", totalProfit:0, count:0, latestPct:0, latestAt:null };
      acc[key].totalProfit += Number(item?.intervalProfit || 0);
      acc[key].count += 1;
      if (!acc[key].latestAt || new Date(item?.at || 0).getTime() > new Date(acc[key].latestAt || 0).getTime()) {
        acc[key].latestAt = item?.at || null;
        acc[key].latestPct = Number(item?.intervalPct || 0);
      }
      return acc;
    }, {}));
    const aiProfitContributors = [...aiImpactByAsset].filter((item)=>item.totalProfit>0).sort((a,b)=>b.totalProfit-a.totalProfit).slice(0,3);
    const aiLossContributors = [...aiImpactByAsset].filter((item)=>item.totalProfit<0).sort((a,b)=>a.totalProfit-b.totalProfit).slice(0,3);
    const aiImpactProfitTotal = aiImpactHistory.reduce((sum,item)=>sum + Math.max(0, Number(item?.intervalProfit || 0)), 0);
    const aiImpactLossTotal = aiImpactHistory.reduce((sum,item)=>sum + Math.min(0, Number(item?.intervalProfit || 0)), 0);
    const aiImpactNet = aiImpactHistory.reduce((sum,item)=>sum + Number(item?.intervalProfit || 0), 0);
    const aiLatestImpact = aiImpactHistory[0] || null;
    const aiRecentImpactRows = aiImpactHistory.slice(0,5);`;

const newBlock = `    const {
      history: aiImpactHistory,
      byAsset: aiImpactByAsset,
      profitContributors: aiProfitContributors,
      lossContributors: aiLossContributors,
      profitTotal: aiImpactProfitTotal,
      lossTotal: aiImpactLossTotal,
      net: aiImpactNet,
      latest: aiLatestImpact,
      recentRows: aiRecentImpactRows,
    } = buildAiImpactSummary(aiSim?.resultHistory, {
      contributorLimit: 3,
      recentLimit: 5,
    });`;

if (!page.includes(oldBlock)) {
  if (!page.includes(newBlock)) {
    throw new Error("P1-3 impact calculation block not found");
  }
} else {
  page = page.replace(oldBlock, newBlock);
}

fs.writeFileSync(pagePath, page);
console.log("P1-3 AI PROCESS impact aggregation extracted successfully.");
