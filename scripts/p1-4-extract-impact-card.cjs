const fs = require('fs');

const file = 'app/page.js';
let src = fs.readFileSync(file, 'utf8');

const importAnchor = 'import { buildAiImpactSummary } from "./lib/ai-process-impact";\n';
const importLine = 'import AiProcessImpactCard from "./components/ai-process/AiProcessImpactCard";\n';
if (!src.includes(importLine)) {
  if (!src.includes(importAnchor)) throw new Error('P1-4 import anchor not found');
  src = src.replace(importAnchor, importAnchor + importLine);
}

const startMarker = '                <section className="ai-v57b-impact-overview" style={profile?.role === "admin" ? {display:"none"} : undefined}>';
const endMarker = '                <div className="ai-v2-workspace" style={profile?.role === "admin" ? {display:"none"} : undefined}>';
const start = src.indexOf(startMarker);
const end = src.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) throw new Error('P1-4 impact card block not found');

const replacement = `                <AiProcessImpactCard\n                  hidden={profile?.role === "admin"}\n                  countdown={aiCountdown}\n                  profitTotal={aiImpactProfitTotal}\n                  lossTotal={aiImpactLossTotal}\n                  net={aiImpactNet}\n                  history={aiImpactHistory}\n                  latest={aiLatestImpact}\n                  profitContributors={aiProfitContributors}\n                  lossContributors={aiLossContributors}\n                  recentRows={aiRecentImpactRows}\n                />\n\n`;

src = src.slice(0, start) + replacement + src.slice(end);
fs.writeFileSync(file, src);
console.log('P1-4 impact card component extraction applied');
