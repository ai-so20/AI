import fs from "node:fs";

const pagePath = "app/page.js";
let source = fs.readFileSync(pagePath, "utf8");

const importLine = 'import AiProcessHistoryPanel from "./components/ai-process/AiProcessHistoryPanel";';
if (!source.includes(importLine)) {
  const anchor = 'import AiProcessChartPanel from "./components/ai-process/AiProcessChartPanel";';
  if (!source.includes(anchor)) throw new Error("P1-6 import anchor not found");
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

const historyPattern = /\n\s*<section className="ai-v2-panel ai-v2-log-panel"[\s\S]*?<\/section>/;
const match = source.match(historyPattern);
if (!match) throw new Error("P1-6 history panel block not found");

const replacement = `\n\n                <AiProcessHistoryPanel\n                  hidden={profile?.role === "admin"}\n                  recentResults={aiRecentResults}\n                  selectedAt={aiChartHover?.at || null}\n                />`;

source = source.replace(historyPattern, replacement);
fs.writeFileSync(pagePath, source);
console.log("P1-6 history panel refactor applied");
