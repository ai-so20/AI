import fs from "node:fs";

const pagePath = "app/page.js";
let source = fs.readFileSync(pagePath, "utf8");

const importAnchor = 'import { fetchAiProcessStateData } from "./lib/ai-process-data";\n';
const simulationImport = 'import { parseAiMarketPayload, buildAiSimulationSnapshot } from "./lib/ai-process-simulation";\n';
if (!source.includes(simulationImport)) {
  if (!source.includes(importAnchor)) throw new Error("P1 import anchor not found");
  source = source.replace(importAnchor, importAnchor + simulationImport);
}

const legacyNames = ["aiStorageKey", "hydrateAiSimulationFromStorage", "makeAiDurationHours", "aiSeedRoll"];
const legacyOnly = legacyNames.every((name) => (source.match(new RegExp(`\\b${name}\\b`, "g")) || []).length === 1);
if (legacyOnly) {
  const start = source.indexOf("  function aiStorageKey() {");
  const end = source.indexOf("  async function loadAiProcessState() {", start);
  if (start < 0 || end < 0) throw new Error("P1 legacy helper block not found");
  source = source.slice(0, start) + source.slice(end);
}

const profitChanceCount = (source.match(/\bAI_PROFIT_CHANCE\b/g) || []).length;
if (profitChanceCount === 1) {
  source = source.replace("  const AI_PROFIT_CHANCE = 0.85;\n", "");
}

const oldStart = source.indexOf("  async function updateAiSimulation() {");
const oldEnd = source.indexOf("\n  useEffect(() => {\n    if (!user || !profile) return;\n    if (![\"ai\", \"home\", \"admin\", \"members\"].includes(chatTab)) return;", oldStart);
if (oldStart < 0 || oldEnd < 0) throw new Error("P1 updateAiSimulation block not found");

const replacement = `  async function updateAiSimulation() {
    if (!user) return;

    const requestId = ++aiSimRequestSeq.current;
    setAiSimLoading(true);
    setAiSimError("");

    try {
      const marketPromise = fetch("/api/market-sim", { cache: "no-store" });
      const logsPromise = aiSession?.id
        ? supabase
            .from("ai_process_logs")
            .select("process_id,market_at,asset_symbol,asset_name,asset_type,market_pct,amount_before,delta,amount_after,result_type")
            .eq("process_id", aiSession.id)
            .order("market_at", { ascending: false })
            .limit(120)
        : Promise.resolve({ data: [], error: null });

      const [marketResponse, logsResult] = await Promise.all([marketPromise, logsPromise]);
      const raw = await marketResponse.text();
      const marketResult = parseAiMarketPayload(raw);

      if (!marketResponse.ok || !marketResult?.success || !marketResult?.quotes?.length) {
        throw new Error(marketResult?.error || "시장 데이터를 불러오지 못했습니다.");
      }
      if (logsResult?.error) console.error("AI PROCESS 연동기록 조회 오류:", logsResult.error);

      const nextSimulation = buildAiSimulationSnapshot({
        marketResult,
        logRows: logsResult?.data,
        session: aiSession,
        defaultStartMoney: AI_START_MONEY,
      });

      if (requestId !== aiSimRequestSeq.current) return;

      setAiSim(nextSimulation);
      setAiNextUpdate(new Date(Date.now() + AI_REFRESH_MS).toISOString());

      // market route가 서버 엔진을 실행했을 수 있으므로 최신 세션 값을 다시 읽습니다.
      await loadAiProcessState();
    } catch (error) {
      console.error(error);
      setAiSimError(error.message || "시장 결과 분석 중 오류가 발생했습니다.");
    } finally {
      if (requestId === aiSimRequestSeq.current) setAiSimLoading(false);
    }
  }
`;

source = source.slice(0, oldStart) + replacement + source.slice(oldEnd);

if ((source.match(/buildAiSimulationSnapshot/g) || []).length !== 2) {
  throw new Error("P1 simulation helper wiring verification failed");
}
if ((source.match(/parseAiMarketPayload/g) || []).length !== 2) {
  throw new Error("P1 market parser wiring verification failed");
}
if (source.includes("const quotes = marketResult.quotes.map")) {
  throw new Error("P1 old inline simulation normalization still present");
}

fs.writeFileSync(pagePath, source);
console.log("P1 remaining AI PROCESS structure cleanup applied");
