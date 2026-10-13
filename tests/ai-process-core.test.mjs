import test from "node:test";
import assert from "node:assert/strict";

import {
  aiKrw,
  aiSignedKrw,
  aiSignedPct,
  buildAiChartModel,
} from "../app/lib/ai-process-utils.js";
import {
  parseAiMarketPayload,
  buildAiSimulationSnapshot,
} from "../app/lib/ai-process-simulation.js";

test("formats KRW and signed values consistently", () => {
  assert.equal(aiKrw(1234567.4), "1,234,567원");
  assert.equal(aiSignedKrw(1500), "+1,500원");
  assert.equal(aiSignedKrw(-1500), "-1,500원");
  assert.equal(aiSignedPct(1.23456), "+1.235%");
  assert.equal(aiSignedPct(-1.2, 2), "-1.20%");
});

test("chart model preserves chronological nodes and baseline", () => {
  const model = buildAiChartModel([
    { at: "2026-10-13T00:00:00Z", value: 5000000 },
    { at: "2026-10-13T00:03:00Z", value: 5050000 },
    { at: "2026-10-13T00:06:00Z", value: 5025000 },
  ], 5000000);

  assert.equal(model.nodes.length, 3);
  assert.equal(model.nodes[0].value, 5000000);
  assert.equal(model.nodes[1].value, 5050000);
  assert.ok(model.points.length > 0);
  assert.ok(model.areaPath.startsWith("M "));
  assert.ok(Number.isFinite(model.baselineY));
});

test("market payload parser rejects malformed JSON with stable message", () => {
  assert.throws(
    () => parseAiMarketPayload("{broken"),
    /시장 데이터 응답 형식을 확인해주세요\./,
  );
});

test("simulation snapshot normalizes market/log values and computes profit", () => {
  const marketResult = {
    updatedAt: "2026-10-13T03:00:00Z",
    quotes: [
      { symbol: "AAA", name: "AAA", type: "stock", price: "101.5", beforePrice: "100", changePct: "1.5" },
    ],
  };
  const session = {
    started_at: "2026-10-13T02:00:00Z",
    start_amount: 5000000,
    current_amount: 5150000,
    duration_hours: 24,
    last_market_at: "2026-10-13T02:57:00Z",
    updated_at: "2026-10-13T03:00:00Z",
  };
  const logRows = [
    {
      market_at: "2026-10-13T02:57:00Z",
      asset_symbol: "AAA",
      asset_name: "AAA",
      asset_type: "stock",
      market_pct: "1.5",
      amount_before: "5000000",
      delta: "150000",
      amount_after: "5150000",
      result_type: "profit",
    },
  ];

  const snapshot = buildAiSimulationSnapshot({
    marketResult,
    logRows,
    session,
    defaultStartMoney: 5000000,
  });

  assert.equal(snapshot.marketRows[0].price, 101.5);
  assert.equal(snapshot.marketRows[0].beforePrice, 100);
  assert.equal(snapshot.resultHistory[0].intervalPct, 1.5);
  assert.equal(snapshot.resultHistory[0].intervalProfit, 150000);
  assert.equal(snapshot.portfolioValue, 5150000);
  assert.equal(snapshot.totalProfit, 150000);
  assert.equal(snapshot.totalReturn, 3);
  assert.equal(snapshot.history[0].resultType, "start");
  assert.equal(snapshot.history[0].value, 5000000);
  assert.equal(snapshot.history[1].value, 5150000);
});

test("simulation snapshot falls back safely when logs are absent", () => {
  const snapshot = buildAiSimulationSnapshot({
    marketResult: { updatedAt: "2026-10-13T03:00:00Z", quotes: [] },
    logRows: null,
    session: {
      started_at: "2026-10-13T02:00:00Z",
      start_amount: 3000000,
      current_amount: 3000000,
      duration_hours: 0,
    },
    defaultStartMoney: 5000000,
  });

  assert.equal(snapshot.resultHistory.length, 0);
  assert.equal(snapshot.history.length, 1);
  assert.equal(snapshot.totalProfit, 0);
  assert.equal(snapshot.totalReturn, 0);
});
