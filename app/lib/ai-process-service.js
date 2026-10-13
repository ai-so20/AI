export async function startAiProcess(supabase, { targetUserId, amount, durationHours }) {
  return supabase.rpc("admin_start_ai_process", {
    target_user_id: targetUserId,
    starting_amount: amount,
    process_duration_hours: durationHours,
  });
}

export async function stopAiProcess(supabase, targetUserId) {
  return supabase.rpc("admin_stop_ai_process", {
    target_user_id: targetUserId,
  });
}

export async function adjustAiProcess(supabase, { targetUserId, adjustmentType, amount }) {
  return supabase.rpc("admin_adjust_ai_process", {
    target_user_id: targetUserId,
    adjustment_type: adjustmentType,
    adjustment_amount: amount,
  });
}

export async function restartAiProcess(supabase, targetUserId) {
  return supabase.rpc("admin_restart_ai_process", {
    target_user_id: targetUserId,
  });
}

export async function fetchAiProcessLogs(supabase, processId, limit = 120) {
  if (!processId) return { data: [], error: null };

  return supabase
    .from("ai_process_logs")
    .select("process_id,market_at,asset_symbol,asset_name,asset_type,market_pct,amount_before,delta,amount_after,result_type")
    .eq("process_id", processId)
    .order("market_at", { ascending: false })
    .limit(limit);
}

export async function fetchAiSimulationSources({ supabase, processId, marketFetch = fetch }) {
  const marketPromise = marketFetch("/api/market-sim", { cache: "no-store" });
  const logsPromise = fetchAiProcessLogs(supabase, processId);
  const [marketResponse, logsResult] = await Promise.all([marketPromise, logsPromise]);
  const rawMarketPayload = await marketResponse.text();

  return {
    marketResponse,
    rawMarketPayload,
    logsResult,
  };
}
