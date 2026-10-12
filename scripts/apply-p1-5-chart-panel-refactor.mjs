import fs from "node:fs";

const pagePath = "app/page.js";
let page = fs.readFileSync(pagePath, "utf8");

const importNeedle = 'import AiProcessImpactCard from "./components/ai-process/AiProcessImpactCard";';
const importLine = 'import AiProcessChartPanel from "./components/ai-process/AiProcessChartPanel";';

if (!page.includes(importNeedle)) {
  throw new Error("P1-5 import anchor not found");
}
if (!page.includes(importLine)) {
  page = page.replace(importNeedle, `${importNeedle}\n${importLine}`);
}

const startMarker = '                <div className="ai-v2-workspace" style={profile?.role === "admin" ? {display:"none"} : undefined}>';
const endMarker = '\n\n                <section className="ai-v2-panel ai-v2-log-panel" style={profile?.role === "admin" ? {display:"none"} : undefined}>';
const start = page.indexOf(startMarker);
const end = page.indexOf(endMarker, start);

if (start === -1 || end === -1 || end <= start) {
  throw new Error("P1-5 chart block anchors not found");
}

const replacement = `                <AiProcessChartPanel\n                  hidden={profile?.role === "admin"}\n                  session={aiSession}\n                  displayAmount={aiDisplayAmount}\n                  startMoney={aiCurrentStartMoney}\n                  lastResult={aiLastResult}\n                  chart={aiChart}\n                  chartHover={aiChartHover}\n                  setChartHover={setAiChartHover}\n                />`;

page = page.slice(0, start) + replacement + page.slice(end);

if (!page.includes("<AiProcessChartPanel") || page.includes(startMarker)) {
  throw new Error("P1-5 replacement validation failed");
}

fs.writeFileSync(pagePath, page);
console.log("P1-5 chart panel refactor applied");
