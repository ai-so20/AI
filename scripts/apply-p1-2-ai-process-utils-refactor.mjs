import fs from "node:fs";

const pagePath = "app/page.js";
let source = fs.readFileSync(pagePath, "utf8");

const helperImport = 'import { AVATAR_CATALOG, avatarSrc, normalizePasswordInput } from "./lib/ui-helpers";';
const aiImport = 'import { aiKrw, aiTime, aiSignedKrw, aiSignedPct, aiFormatMarketPrice, aiRemainingText, buildAiChartModel } from "./lib/ai-process-utils";';

if (!source.includes(aiImport)) {
  if (!source.includes(helperImport)) throw new Error("P1-2 import anchor not found");
  source = source.replace(helperImport, `${helperImport}\n${aiImport}`);
}

const functionNames = [
  "aiKrw",
  "aiTime",
  "aiSignedKrw",
  "aiSignedPct",
  "aiFormatMarketPrice",
  "aiRemainingText",
  "buildAiChartModel",
];

for (const name of functionNames) {
  const signature = `  function ${name}(`;
  const start = source.indexOf(signature);
  if (start === -1) {
    if (source.includes(aiImport)) continue;
    throw new Error(`P1-2 function not found: ${name}`);
  }

  let index = source.indexOf("{", start);
  if (index === -1) throw new Error(`P1-2 opening brace not found: ${name}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let templateExprDepth = 0;
  let end = -1;

  for (; index < source.length; index += 1) {
    const ch = source[index];
    const next = source[index + 1];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote && ch === "\\") {
      escaped = true;
      continue;
    }

    if (quote === "'") {
      if (ch === "'") quote = null;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') quote = null;
      continue;
    }
    if (quote === "`") {
      if (ch === "`" && templateExprDepth === 0) {
        quote = null;
        continue;
      }
      if (ch === "$" && next === "{") {
        templateExprDepth += 1;
        depth += 1;
        index += 1;
        continue;
      }
      if (ch === "}" && templateExprDepth > 0) {
        templateExprDepth -= 1;
        depth -= 1;
      }
      continue;
    }

    if (ch === "'") { quote = "'"; continue; }
    if (ch === '"') { quote = '"'; continue; }
    if (ch === "`") { quote = "`"; continue; }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  if (end === -1) throw new Error(`P1-2 function end not found: ${name}`);
  while (source[end] === "\r" || source[end] === "\n") end += 1;
  source = source.slice(0, start) + source.slice(end);
}

for (const name of functionNames) {
  if (source.includes(`  function ${name}(`)) throw new Error(`P1-2 duplicate function remains: ${name}`);
}
if (!source.includes(aiImport)) throw new Error("P1-2 AI PROCESS import missing");

fs.writeFileSync(pagePath, source);
console.log("P1-2 extracted AI PROCESS pure utilities from app/page.js");
