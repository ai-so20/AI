import { createClient } from "@supabase/supabase-js";
import { runAiCommunityTick } from "../../lib/ai-community";

export const dynamic = "force-dynamic";

const ASSETS = [
  { symbol: "AAPL", yahoo: "AAPL", name: "Apple", type: "stock" },
  { symbol: "NVDA", yahoo: "NVDA", name: "NVIDIA", type: "stock" },
  { symbol: "MSFT", yahoo: "MSFT", name: "Microsoft", type: "stock" },
  { symbol: "TSLA", yahoo: "TSLA", name: "Tesla", type: "stock" },
  { symbol: "BTC/USD", yahoo: "BTC-USD", name: "Bitcoin", type: "crypto" },
  { symbol: "ETH/USD", yahoo: "ETH-USD", name: "Ethereum", type: "crypto" },
  { symbol: "SOL/USD", yahoo: "SOL-USD", name: "Solana", type: "crypto" },
  { symbol: "XRP/USD", yahoo: "XRP-USD", name: "XRP", type: "crypto" },
];

const CACHE_KEY = "main";
const MARKET_FRESH_MS = 3 * 60 * 1000;
const ENGINE_MAX_STALE_MS = 4 * 60 * 1000;
const ENGINE_REUSE_MS = 45 * 1000;

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
    return { symbol: asset.symbol, name: asset.name, type: asset.type, price };
  }).filter(Boolean);
}

function withMarketChanges(quotes, previousPayload, previousAgeMs) {
  const usePrevious = Number.isFinite(previousAgeMs) && previousAgeMs <= 15 * 60 * 1000;
  const previousMap = new Map(
    usePrevious && Array.isArray(previousPayload?.quotes)
      ? previousPayload.quotes.map((item) => [item.symbol, Number(item.price)])
      : []
  );

  return quotes.map((item) => {
    const beforePrice = Number(previousMap.get(item.symbol));
    const changePct = Number.isFinite(beforePrice) && beforePrice > 0
      ? ((Number(item.price) - beforePrice) / beforePrice) * 100
      : 0;
    return {
      ...item,
      beforePrice: Number.isFinite(beforePrice) ? beforePrice : Number(item.price),
      changePct,
    };
  });
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

function currentMinuteIso() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString();
}

async function runProcessEngine(db, payload, cacheAgeMs = 0) {
  if (!db || !payload?.updatedAt || !Array.isArray(payload?.quotes) || !payload.quotes.length) return;
  if (Number.isFinite(cacheAgeMs) && cacheAgeMs > ENGINE_MAX_STALE_MS) return;

  const { error } = await db.rpc("run_ai_process_market_tick", {
    tick_at: currentMinuteIso(),
    market_at: payload.updatedAt,
    market_quotes: payload.quotes,
  });

  if (error && error.code !== "PGRST202" && error.code !== "42883") {
    console.error("AI PROCESS server engine error:", error);
  }
}

function jsonFromCache(cache, age, extra = {}) {
  return Response.json({
    ...cache.payload,
    success: true,
    cached: true,
    processRefreshSeconds: 180,
    marketRefreshSeconds: 180,
    cacheAgeSeconds: Number.isFinite(age) ? Math.max(0, Math.floor(age / 1000)) : null,
    ...extra,
  });
}

async function fetchTwelveData(cache, cacheAge, apiKey) {
  const url = new URL("https://api.twelvedata.com/price");
  url.searchParams.set("symbol", ASSETS.map((asset) => asset.symbol).join(","));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `apikey ${apiKey}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.status === "error") {
      throw new Error(data?.message || "Twelve Data 응답 오류");
    }

    const normalized = normalizeQuotes(data);
    if (normalized.length !== ASSETS.length) {
      throw new Error("Twelve Data 일부 종목 누락");
    }

    return {
      success: true,
      updatedAt: new Date().toISOString(),
      quotes: withMarketChanges(normalized, cache?.payload, cacheAge),
      processRefreshSeconds: 180,
      marketRefreshSeconds: 180,
      provider: "twelvedata",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchYahooQuote(asset) {
  const includePrePost = asset.type === "stock" ? "true" : "false";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.yahoo)}?interval=1m&range=2d&includePrePost=${includePrePost}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json,text/plain,*/*",
      },
    });
    if (!response.ok) throw new Error(`Yahoo ${asset.yahoo} ${response.status}`);
    const data = await response.json().catch(() => null);
    const result = data?.chart?.result?.[0];
    const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
    const closeValues = Array.isArray(result?.indicators?.quote?.[0]?.close)
      ? result.indicators.quote[0].close
      : [];

    let latestClose = null;
    let latestTimestamp = null;
    for (let i = Math.min(timestamps.length, closeValues.length) - 1; i >= 0; i -= 1) {
      const value = Number(closeValues[i]);
      const ts = Number(timestamps[i]);
      if (Number.isFinite(value) && value > 0 && Number.isFinite(ts) && ts > 0) {
        latestClose = value;
        latestTimestamp = ts;
        break;
      }
    }

    const regularMarketPrice = Number(result?.meta?.regularMarketPrice);
    const price = Number.isFinite(latestClose) && latestClose > 0
      ? latestClose
      : regularMarketPrice;
    if (!Number.isFinite(price) || price <= 0) throw new Error(`Yahoo ${asset.yahoo} price missing`);

    return {
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      price,
      sourceTimestamp: latestTimestamp ? new Date(latestTimestamp * 1000).toISOString() : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchKeylessMarket(cache, cacheAge) {
  const settled = await Promise.allSettled(ASSETS.map(fetchYahooQuote));
  const quotes = settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value);

  if (quotes.length !== ASSETS.length) {
    const failed = settled.filter((item) => item.status === "rejected").length;
    throw new Error(`무료 시장데이터 ${failed}개 종목 조회 실패`);
  }

  return {
    success: true,
    updatedAt: new Date().toISOString(),
    quotes: withMarketChanges(quotes, cache?.payload, cacheAge),
    processRefreshSeconds: 180,
    marketRefreshSeconds: 180,
    provider: "yahoo",
  };
}

async function fetchFreshMarket(cache, cacheAge) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (apiKey) {
    try {
      return await fetchTwelveData(cache, cacheAge, apiKey);
    } catch (error) {
      console.warn("Twelve Data failed, falling back to keyless provider:", error?.message || error);
    }
  }

  return fetchKeylessMarket(cache, cacheAge);
}

export async function GET(request) {
  const db = serverSupabase();
  const requestUrl = new URL(request.url);
  const engineMode = requestUrl.searchParams.get("engine") === "1";
  const cache = await readCache(db);
  const cacheAge = cache
    ? Date.now() - new Date(cache.fetchedAt).getTime()
    : Number.POSITIVE_INFINITY;

  // 일반 사용자 조회는 서버 엔진을 실행하지 않습니다.
  if (!engineMode && cache && Number.isFinite(cacheAge) && cacheAge < MARKET_FRESH_MS) {
    return jsonFromCache(cache, cacheAge, {
      stale: false,
      viewerMode: true,
    });
  }

  // 3분 Cron은 직전 호출이 45초 이내인 경우에만 같은 캐시를 재사용합니다.
  if (engineMode && cache && Number.isFinite(cacheAge) && cacheAge < ENGINE_REUSE_MS) {
    await runProcessEngine(db, cache.payload, cacheAge);
    await runAiCommunityTick({ source: "market_cron" });
    return jsonFromCache(cache, cacheAge, { stale: false, engineMode: true });
  }

  try {
    const payload = await fetchFreshMarket(cache, cacheAge);
    await saveCache(db, payload);
    if (engineMode) {
      await runProcessEngine(db, payload, 0);
      await runAiCommunityTick({ source: "market_cron" });
    }
    return Response.json({ ...payload, cached: false, stale: false, engineMode });
  } catch (error) {
    console.error("market provider error:", error);
    if (cache) {
      if (engineMode) {
        await runProcessEngine(db, cache.payload, cacheAge);
        await runAiCommunityTick({ source: "market_cron" });
      }
      return jsonFromCache(cache, cacheAge, {
        stale: true,
        fallback: true,
        engineMode,
      });
    }
    if (engineMode) await runAiCommunityTick({ source: "market_cron" });
    return Response.json(
      {
        success: false,
        error: "시장 데이터를 갱신하는 중입니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 503 }
    );
  }
}
