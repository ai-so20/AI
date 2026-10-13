import fs from "node:fs";

const file = "app/page.js";
let source = fs.readFileSync(file, "utf8");

const importNeedle = 'import AiProcessStartPanel from "./components/ai-process/AiProcessStartPanel";\n';
const importReplacement = importNeedle + 'import AiProcessSummaryPanel from "./components/ai-process/AiProcessSummaryPanel";\n';
if (!source.includes(importNeedle)) throw new Error("P1-9 import anchor not found");
source = source.replace(importNeedle, importReplacement);

const start = '                <div className="ai-v2-summary-grid" style={profile?.role === "admin" ? {display:"none"} : undefined}>';
const endMarker = '                <AiProcessMembersPanel\n';
const startIndex = source.indexOf(start);
const endIndex = source.indexOf(endMarker, startIndex);
if (startIndex < 0 || endIndex < 0) throw new Error("P1-9 summary block anchors not found");

const replacement = `                <AiProcessSummaryPanel\n                  hidden={profile?.role === "admin"}\n                  session={aiSession}\n                  currentStartMoney={aiCurrentStartMoney}\n                  displayAmount={aiDisplayAmount}\n                  displayProfit={aiDisplayProfit}\n                  displayReturn={aiDisplayReturn}\n                  simLoading={aiSimLoading}\n                  lastResult={aiLastResult}\n                />\n\n`;

source = source.slice(0, startIndex) + replacement + source.slice(endIndex);
fs.writeFileSync(file, source);
console.log("P1-9 summary panel refactor applied");
