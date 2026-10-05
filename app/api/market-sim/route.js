import { createClient } from "@supabase/supabase-js";
import { runAiCommunityTick } from "../../lib/ai-community";

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
const MARKET_FRESH_MS = 5 * 60 * 1000;
const ENGINE_MAX_STALE_MS = 6 * 60 * 1000;

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
    processRefreshSeconds: 60,
    marketRefreshSeconds: 300,
    cacheAgeSeconds: Number.isFinite(age) ? Math.max(0, Math.floor(age / 1000)) : null,
    ...extra,
  });
}

async function fetchFreshMarket(cache, cacheAge, apiKey) {
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
      const error = new Error(data?.message || "시장데이터 공급자가 일시적으로 응답하지 않습니다.");
      error.status = response.status;
      throw error;
    }

    const normalized = normalizeQuotes(data);
    if (normalized.length !== ASSETS.length) {
      throw new Error("초기 시장가격 일부가 누락되었습니다. 잠시 후 다시 시도해주세요.");
    }

    const updatedAt = new Date().toISOString();
    return {
      success: true,
      updatedAt,
      quotes: withMarketChanges(normalized, cache?.payload, cacheAge),
      processRefreshSeconds: 60,
      marketRefreshSeconds: 300,
    };
  } finally {
    clearTimeout(timeout);
  }
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
  // 캐시가 있으면 그대로 반환하여 수십 명이 동시에 접속해도 1분 엔진/RPC가 중복 호출되지 않습니다.
  if (!engineMode && cache) {
    return jsonFromCache(cache, cacheAge, {
      stale: cacheAge >= MARKET_FRESH_MS,
      viewerMode: true,
    });
  }

  // Cron 엔진 호출은 5분 이내 캐시를 재사용하면서 PROCESS만 1분 단위로 진행합니다.
  if (engineMode && cache && Number.isFinite(cacheAge) && cacheAge < MARKET_FRESH_MS) {
    await runProcessEngine(db, cache.payload, cacheAge);
    await runAiCommunityTick({ source: "market_cron" });
    return jsonFromCache(cache, cacheAge, { stale: false, engineMode: true });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    if (cache) {
      if (engineMode) {
        await runProcessEngine(db, cache.payload, cacheAge);
        await runAiCommunityTick({ source: "market_cron" });
      }
      return jsonFromCache(cache, cacheAge, {
        stale: true,
        fallback: true,
        marketSetupRequired: true,
        engineMode,
        error: "Vercel에 TWELVE_DATA_API_KEY를 추가해주세요.",
      });
    }
    if (engineMode) await runAiCommunityTick({ source: "market_cron" });
    return Response.json(
      {
        success: false,
        marketSetupRequired: true,
        error: "시장데이터 키가 없습니다. Vercel 환경변수에 TWELVE_DATA_API_KEY를 추가해주세요.",
      },
      { status: 503 }
    );
  }

  try {
    // 캐시가 전혀 없는 최초 접속은 일반 사용자 요청에서도 1회 초기화할 수 있습니다.
    // 이후 정상 운용 중 시장 갱신과 PROCESS 계산은 Cron(engine=1)이 담당합니다.
    const payload = await fetchFreshMarket(cache, cacheAge, apiKey);
    await saveCache(db, payload);
    if (engineMode) {
      await runProcessEngine(db, payload, 0);
      await runAiCommunityTick({ source: "market_cron" });
    }
    return Response.json({ ...payload, cached: false, stale: false, engineMode });
  } catch (error) {
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
        error:
          error?.name === "AbortError"
            ? "시장데이터 연결 시간이 초과되었습니다."
            : (error?.message || "시장데이터 연결에 실패했습니다."),
      },
      { status: 503 }
    );
  }
}
