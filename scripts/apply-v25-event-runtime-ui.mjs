import fs from "node:fs";

const path = "app/page.js";
let src = fs.readFileSync(path, "utf8");
const marker = "/* V25 EVENT RUNTIME */";
if (src.includes(marker)) {
  console.log("V25 event runtime patch already applied");
  process.exit(0);
}

const needle = `  async function loadAutoEvents() {\n    const { data, error } = await supabase.rpc("get_auto_events");`;
const replacement = `  async function loadAutoEvents() {\n    ${marker}\n    try {\n      await fetch("/api/event-runtime", { method: "POST", cache: "no-store" });\n    } catch (runtimeError) {\n      console.warn("이벤트 런타임 동기화 오류:", runtimeError);\n    }\n\n    const { data, error } = await supabase.rpc("get_auto_events");`;

if (!src.includes(needle)) throw new Error("loadAutoEvents anchor not found");
src = src.replace(needle, replacement);
fs.writeFileSync(path, src);
console.log("V25 event runtime page patch applied");
