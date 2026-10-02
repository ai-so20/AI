import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ASSETS = [
  { symbol: "AAPL", name: "Apple", type: "stock" },
  { symbol: "NVDA", name: "NVIDIA", type: "stock" },
  { symbol: "MSFT", name: "Microsoft", type: "stock" },
  { symbol: "TSLA", name: "Tesla", type: "stock" },
  { symbol: "BTC/USD", name: "Bitcoin", type: "crypto" },
  { symbol: "ETH/USD", name: "Ethereum", type: "crypto" },
  { symbol: "SOL/USD", name: "Solana", type: "crypto" },
  { symbol: "XRP/USD", name: "XRP", type: "crypto" },
];

const CACHE_KEY = "main";
const FRESH_MS = 5 * 60 * 1000;

function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeQuotes(data) {
  return ASSETS.map((asset) => {
    const row = data?.[asset.symbol];
    const price = Number(typeof row === "object" && row !== null ? row.price : row);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { ...asset, price };
  }).filter(Boolean);
}

async function readCache(db) {
  if (!db) return null;
  const { data, error } = await db
    .from("market_sim_cache")
    .select("payload,fetched_at")
    .eq("cache_key", CACHE_KEY)
    .maybeSingle();
  if (error || !data?.payload) return null;
  return { payload: data.payload, fetchedAt: data.fetched_at };
}

async function saveCache(db, payload) {
  if (!db) return;
  await db.from("market_sim_cache").upsert({
    cache_key: CACHE_KEY,
    payload,
    fetched_at: new Date().toISOString(),
  });
}

function cacheResponse(cache, extra = {}) {
  return Response.json({ ...cache.payload, success: true, cached: true, ...extra });
}

export async function GET() {
  const db = serverSupabase();
  const cache = await readCache(db);

  if (cache) {
    const age = Date.now() - new Date(cache.fetchedAt).getTime();
    if (Number.isFinite(age) && age < FRESH_MS) {
      return cacheResponse(cache, {
        stale: false,
        cacheAgeSeconds: Math.max(0, Math.floor(age / 1000)),
      });
    }
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    if (cache) return cacheResponse(cache, { stale: true, fallback: true });
    return Response.json(
      { success: false, error: "시장데이터 초기 연결이 필요합니다." },
      { status: 503 }
    );
  }

  try {
    const url = new URL("https://api.twelvedata.com/price");
    url.searchParams.set("symbol", ASSETS.map((asset) => asset.symbol).join(","));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let response;
    try {
      response = await fetch(url.toString(), {
        headers: { Authorization: `apikey ${apiKey}` },
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.status === "error") {
      if (cache) {
        return cacheResponse(cache, {
          stale: true, fallback: true, providerStatus: response.status,
        });
      }
      return Response.json(
        { success: false, error: data?.message || "시장데이터 공급자가 일시적으로 응답하지 않습니다." },
        { status: 503 }
      );
    }

    const quotes = normalizeQuotes(data);
    if (quotes.length !== ASSETS.length) {
      if (cache) {
        return cacheResponse(cache, {
          stale: true, fallback: true, partialProviderResult: true,
        });
      }
      return Response.json(
        { success: false, error: "초기 시장가격 일부가 누락되었습니다. 잠시 후 다시 시도해주세요." },
        { status: 503 }
      );
    }

    const payload = {
      success: true,
      updatedAt: new Date().toISOString(),
      quotes,
      refreshSeconds: 300,
    };

    await saveCache(db, payload);
    return Response.json({ ...payload, cached: false, stale: false });
  } catch (error) {
    if (cache) return cacheResponse(cache, { stale: true, fallback: true });
    return Response.json(
      {
        success: false,
        error:
          error?.name === "AbortError"
            ? "시장데이터 초기 연결 시간이 초과되었습니다."
            : "시장데이터 초기 연결에 실패했습니다.",
      },
      { status: 503 }
    );
  }
}
