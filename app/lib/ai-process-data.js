export async function fetchAiProcessStateData({
  supabase,
  userId,
  needPublicSessions,
  selectedProcessId,
}) {
  const minePromise = supabase
    .from("ai_process_sessions")
    .select("id,user_id,status,start_amount,current_amount,total_profit,total_return,duration_hours,started_at,ends_at,completed_at,last_market_at,last_asset_symbol,last_asset_name,last_asset_type,last_market_pct,last_delta,last_tick_at,updated_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(50);

  const publicPromise = needPublicSessions
    ? supabase.rpc("get_ai_process_public_sessions")
    : Promise.resolve({ data: null, error: null });

  const [
    { data: mineRows, error: mineError },
    { data: publicRows, error: publicError },
  ] = await Promise.all([minePromise, publicPromise]);

  const directRows = Array.isArray(mineRows) ? mineRows : [];
  const publicList = Array.isArray(publicRows) ? publicRows : [];
  const publicMine = publicList
    .filter((row) => row.user_id === userId)
    .map((row) => ({ ...row, id: row.id || row.process_id }));

  const rows = directRows.length ? directRows : publicMine;
  const preferredId = selectedProcessId && rows.some((row) => row.id === selectedProcessId)
    ? selectedProcessId
    : (rows.find((row) => row.status === "running")?.id || rows[0]?.id || "");

  const selected = rows.find((row) => row.id === preferredId)
    || publicMine.find((row) => row.status === "running")
    || null;

  return {
    mineError,
    publicError,
    rows,
    publicList,
    preferredId,
    selected,
  };
}
