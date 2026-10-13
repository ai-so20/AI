import fs from "node:fs";

const file = "app/page.js";
let src = fs.readFileSync(file, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = src.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected 1 match, found ${count}`);
  }
  src = src.replace(oldText, newText);
}

replaceOnce(
  'import { parseAiMarketPayload, buildAiSimulationSnapshot } from "./lib/ai-process-simulation";\n',
  'import { parseAiMarketPayload, buildAiSimulationSnapshot } from "./lib/ai-process-simulation";\nimport { startAiProcess, stopAiProcess, adjustAiProcess, restartAiProcess, fetchAiSimulationSources } from "./lib/ai-process-service";\n',
  "service import"
);

replaceOnce(
`      const { error } = await supabase.rpc("admin_start_ai_process", {
        target_user_id: aiAdminMemberId,
        starting_amount: amount,
        process_duration_hours: Math.floor(duration)
      });`,
`      const { error } = await startAiProcess(supabase, {
        targetUserId: aiAdminMemberId,
        amount,
        durationHours: Math.floor(duration),
      });`,
  "start rpc"
);

replaceOnce(
`      const { error } = await supabase.rpc("admin_stop_ai_process", { target_user_id: targetUserId });`,
`      const { error } = await stopAiProcess(supabase, targetUserId);`,
  "stop rpc"
);

replaceOnce(
`      const { error } = await supabase.rpc("admin_adjust_ai_process", {
        target_user_id: targetUserId,
        adjustment_type: adjustmentType,
        adjustment_amount: amount,
      });`,
`      const { error } = await adjustAiProcess(supabase, {
        targetUserId,
        adjustmentType,
        amount,
      });`,
  "adjust rpc"
);

replaceOnce(
`      const { error } = await supabase.rpc("admin_restart_ai_process", { target_user_id: targetUserId });`,
`      const { error } = await restartAiProcess(supabase, targetUserId);`,
  "restart rpc"
);

replaceOnce(
`      const marketPromise = fetch("/api/market-sim", { cache: "no-store" });
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
      const marketResult = parseAiMarketPayload(raw);`,
`      const { marketResponse, rawMarketPayload, logsResult } = await fetchAiSimulationSources({
        supabase,
        processId: aiSession?.id,
      });
      const marketResult = parseAiMarketPayload(rawMarketPayload);`,
  "simulation sources"
);

if (src.includes('supabase.rpc("admin_start_ai_process"') ||
    src.includes('supabase.rpc("admin_stop_ai_process"') ||
    src.includes('supabase.rpc("admin_adjust_ai_process"') ||
    src.includes('supabase.rpc("admin_restart_ai_process"')) {
  throw new Error("P2 validation failed: direct AI PROCESS admin RPC remains in page.js");
}

if (src.includes('.from("ai_process_logs")')) {
  throw new Error("P2 validation failed: direct ai_process_logs query remains in page.js");
}

fs.writeFileSync(file, src);
console.log("P2 AI PROCESS service refactor applied");
