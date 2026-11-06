// AI PROCESS display model preserved from ai-so20/26, V2LiveClientStage2.js.
// Member-only presentation calculations. No database writes.
const AI_PROCESS_STEP_MINUTES = 3;

function aiProcessHash(text) {
  let h = 2166136261;
  for (let i = 0; i < String(text || '').length; i += 1) {
    h ^= String(text).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function aiProcessRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function aiProcessStatusLabel(status, availableCount = 0) {
  if (status === 'waiting') return '시작 준비';
  if (status === 'running') return '진행중';
  if (status === 'completed') return '진행완료';
  return Number(availableCount || 0) > 0 ? '진행 가능' : '상담 가능';
}

function aiProcessDurationLabel(hours) {
  const value = Math.max(1, Math.min(2400, Number(hours || 24)));
  if (value % 24 === 0) return `${value / 24}일`;
  if (value > 24) return `${Math.floor(value / 24)}일 ${value % 24}시간`;
  return `${value}시간`;
}

function aiProcessDurationMs(row) {
  return Math.max(1, Math.min(2400, Number(row?.duration_hours || 24))) * 60 * 60 * 1000;
}

function aiProcessOpportunityDday(row) {
  if (Number(row?.available_count || 0) <= 0 || !row?.available_granted_at) return null;
  const grantedAt = new Date(row.available_granted_at).getTime();
  if (!Number.isFinite(grantedAt)) return null;
  const expiresAt = grantedAt + (10 * 24 * 60 * 60 * 1000);
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

function aiProcessFinalReturn(row, userId) {
  const minReturn = Math.max(0, Number(row?.min_return || 0));
  const maxReturn = Math.max(minReturn, Number(row?.max_return || minReturn));
  const seed = aiProcessHash(`${row?.user_id || userId || 'member'}-${row?.started_at || 'not-started'}-${minReturn}-${maxReturn}`);
  const rand = aiProcessRandom(seed);
  return minReturn + (maxReturn - minReturn) * rand();
}

function getMemberProcessSnapshot(row, userId) {
  const investment = Math.max(0, Number(row?.investment_amount || 0));
  const targetReturn = aiProcessFinalReturn(row, userId);
  const targetProfit = investment * (targetReturn / 100);
  const durationMs = aiProcessDurationMs(row);
  const stepMs = AI_PROCESS_STEP_MINUTES * 60 * 1000;
  const totalSteps = Math.max(1, Math.round(durationMs / stepMs));
  const startedMs = row?.started_at ? new Date(row.started_at).getTime() : Date.now();
  const completedMs = row?.completed_at ? new Date(row.completed_at).getTime() : NaN;
  const snapshotNowMs = row?.status === 'completed' && Number.isFinite(completedMs) ? completedMs : Date.now();
  const rawElapsed = Math.max(0, snapshotNowMs - startedMs);
  const elapsedMs = Math.min(durationMs, rawElapsed);
  const elapsedSteps = Math.min(totalSteps, Math.floor(elapsedMs / stepMs));

  const seed = aiProcessHash(`${row?.user_id || userId || 'member'}-${row?.started_at || 'not-started'}-${investment}-${targetReturn}-${row?.duration_hours || 24}`);
  const rand = aiProcessRandom(seed);
  const rawWeights = [];
  for (let start = 0; start < totalSteps; start += 10) {
    const count = Math.min(10, totalSteps - start);
    const lossCount = count >= 5 ? (rand() < 0.5 ? 1 : 2) : (count >= 2 ? 1 : 0);
    const lossOffsets = new Set();
    while (lossOffsets.size < lossCount) lossOffsets.add(Math.floor(rand() * count));
    for (let offset = 0; offset < count; offset += 1) {
      const index = start + offset;
      const centerWave = 0.72 + 0.28 * Math.sin((index / Math.max(1, totalSteps - 1)) * Math.PI);
      const burst = rand() > 0.87 ? 1.65 + rand() * 1.5 : 1;
      const gain = (0.28 + rand() * 1.55) * centerWave * burst;
      rawWeights.push(lossOffsets.has(offset) ? -gain * (0.12 + rand() * 0.18) : gain);
    }
  }
  const weightTotal = rawWeights.reduce((sum, value) => sum + value, 0) || 1;
  const increments = rawWeights.map((value) => targetProfit * (value / weightTotal));
  const cumulative = [];
  let runningProfit = 0;
  for (const amount of increments) {
    runningProfit += amount;
    cumulative.push(runningProfit);
  }
  const cumulativeAt = (step) => step > 0 ? cumulative[Math.min(totalSteps, step) - 1] : 0;

  const legacyProfit = cumulativeAt(elapsedSteps);
  const anchorAt = row?.profit_anchor_at ? new Date(row.profit_anchor_at).getTime() : NaN;
  const hasAnchor = Number.isFinite(anchorAt) && row?.profit_anchor != null;
  const anchorElapsedSteps = hasAnchor ? Math.max(0, Math.floor((anchorAt - startedMs) / stepMs)) : 0;
  const remainingSteps = Math.max(1, totalSteps - anchorElapsedSteps);
  const stepsAfterAnchor = hasAnchor ? Math.max(0, elapsedSteps - anchorElapsedSteps) : 0;
  const anchorCurveTotal = cumulativeAt(totalSteps) - cumulativeAt(anchorElapsedSteps);
  const anchoredProfit = hasAnchor
    ? Number(row.profit_anchor) + Math.max(0, targetProfit - Number(row.profit_anchor)) * (anchorCurveTotal > 0
      ? (cumulativeAt(elapsedSteps) - cumulativeAt(anchorElapsedSteps)) / anchorCurveTotal
      : Math.min(1, stepsAfterAnchor / remainingSteps))
    : legacyProfit;
  const earnedProfit = Math.max(0, anchoredProfit + Number(row?.profit_adjustment || 0));
  const totalAmount = investment + earnedProfit;
  const currentReturn = investment > 0 ? (earnedProfit / investment) * 100 : 0;
  const progress = targetProfit > 0 ? Math.min(100, (earnedProfit / targetProfit) * 100) : 0;

  const nextBoundary = stepMs - (Math.max(0, Date.now() - startedMs) % stepMs);
  const nextMinutes = Math.floor(nextBoundary / 60000);
  const nextSeconds = Math.floor((nextBoundary % 60000) / 1000);
  const nextText = row?.status === 'running'
    ? `${String(nextMinutes).padStart(2, '0')}:${String(nextSeconds).padStart(2, '0')}`
    : '--:--';

  const profitForStep = (step) => {
    const base = hasAnchor
      ? (step <= anchorElapsedSteps
        ? Number(row.profit_anchor) * step / Math.max(1, anchorElapsedSteps)
        : Number(row.profit_anchor) + Math.max(0, targetProfit - Number(row.profit_anchor)) * (anchorCurveTotal > 0
          ? (cumulativeAt(step) - cumulativeAt(anchorElapsedSteps)) / anchorCurveTotal
          : (step - anchorElapsedSteps) / remainingSteps))
      : cumulativeAt(step);
    return Math.max(0, base + Number(row?.profit_adjustment || 0));
  };

  const firstVisibleStep = Math.max(0, elapsedSteps - 48);
  const history = [];
  for (let step = firstVisibleStep; step <= elapsedSteps; step += 1) {
    history.push({ step, amount: investment + (step === 0 ? 0 : profitForStep(step)) });
  }

  const width = 760;
  const height = 220;
  const padX = 18;
  const padY = 20;
  const amounts = history.map((item) => item.amount);
  const minAmount = Math.min(investment, ...amounts);
  const visibleGain = Math.max(...amounts) - minAmount;
  const visualRange = Math.max(1, visibleGain * 1.28);
  const maxAmount = minAmount + visualRange;
  const range = Math.max(1, maxAmount - minAmount);
  const chartPoints = history.map((item, index) => {
    const x = history.length <= 1 ? padX : padX + (index / (history.length - 1)) * (width - padX * 2);
    const normalized = Math.max(0, Math.min(1, (item.amount - minAmount) / range));
    const y = (height - padY) - normalized * (height - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const remainingHours = Math.floor(remainingMs / 3600000);
  const remainingMinutes = Math.floor((remainingMs % 3600000) / 60000);

  return {
    investment,
    targetReturn,
    targetProfit,
    earnedProfit,
    totalAmount,
    currentReturn,
    progress,
    elapsedSteps,
    totalSteps,
    nextText,
    chartPoints,
    history,
    recentIncrement: elapsedSteps > 0 ? increments[elapsedSteps - 1] : 0,
    averagePerStep: elapsedSteps > 0 ? earnedProfit / elapsedSteps : 0,
    remainingText: row?.status === 'completed' ? '진행 완료' : `${remainingHours}시간 ${remainingMinutes}분`,
  };
}


const aiTradingAssets = [
  { symbol: 'BTC/USD', name: 'Bitcoin', market: 'COIN' },
  { symbol: 'ETH/USD', name: 'Ethereum', market: 'COIN' },
  { symbol: 'SOL/USD', name: 'Solana', market: 'COIN' },
  { symbol: 'XRP/USD', name: 'XRP', market: 'COIN' },
  { symbol: 'AAPL', name: 'Apple', market: 'STOCK' },
  { symbol: 'NVDA', name: 'NVIDIA', market: 'STOCK' },
  { symbol: 'MSFT', name: 'Microsoft', market: 'STOCK' },
  { symbol: 'TSLA', name: 'Tesla', market: 'STOCK' },
];

function aiMarketUnit(seed) {
  return (aiProcessHash(seed) % 10000) / 9999;
}

function aiMarketDirection(seed, bullishBias = false) {
  const value = aiMarketUnit(seed);
  if (bullishBias) {
    if (value < .16) return { key: 'down', label: '하락 흐름', tone: 'down' };
    if (value < .36) return { key: 'flat', label: '횡보', tone: 'flat' };
    if (value < .78) return { key: 'up', label: '상승 흐름', tone: 'up' };
    return { key: 'strong-up', label: '강한 상승', tone: 'up' };
  }
  if (value < .16) return { key: 'strong-down', label: '강한 하락', tone: 'down' };
  if (value < .38) return { key: 'down', label: '하락 흐름', tone: 'down' };
  if (value < .62) return { key: 'flat', label: '횡보', tone: 'flat' };
  if (value < .86) return { key: 'up', label: '상승 흐름', tone: 'up' };
  return { key: 'strong-up', label: '강한 상승', tone: 'up' };
}

function aiMarketStateAt(asset, stepSeed) {
  const step = Math.max(0, Math.floor(Number(stepSeed || 0)));
  const base = aiProcessHash(asset.symbol);
  const cycleLength = 20 + (base % 9);
  const offset = base % cycleLength;
  const shifted = step + offset;
  const cycle = Math.floor(shifted / cycleLength);
  const pos = shifted % cycleLength;
  const cycleBias = aiMarketUnit(`${asset.symbol}-${cycle}-bias`);
  const tradeCycle = cycleBias >= .38;
  const bullishCycle = cycleBias >= .56;
  const exitRisk = aiMarketUnit(`${asset.symbol}-${cycle}-exit`) < .24;
  let phase = 'scan';
  let label = '탐색 중';
  let action = '시장 구조 · 변동성 동시 분석';
  let direction = aiMarketDirection(`${asset.symbol}-${cycle}-scan`);

  if (pos < 3) {
    phase = 'scan';
    label = '탐색 중';
    direction = aiMarketDirection(`${asset.symbol}-${cycle}-scan`);
    action = direction.tone === 'down' ? '하락 구간 감지 · 위험도 분석' : '시장 구조 · 변동성 동시 분석';
  } else if (pos < 7) {
    phase = 'watch';
    label = '진입 관찰';
    direction = tradeCycle
      ? aiMarketDirection(`${asset.symbol}-${cycle}-watch`, bullishCycle)
      : { key: cycleBias < .18 ? 'strong-down' : 'down', label: cycleBias < .18 ? '강한 하락' : '하락 흐름', tone: 'down' };
    action = direction.tone === 'down' ? '하락세 감지 · 진입 보류' : direction.tone === 'up' ? '진입 조건 확인 중' : '방향성 확인 중';
  } else if (!tradeCycle) {
    if (pos < cycleLength - 3) {
      phase = 'watch';
      label = '진입 보류';
      direction = { key: cycleBias < .18 ? 'strong-down' : 'down', label: cycleBias < .18 ? '강한 하락' : '하락 흐름', tone: 'down' };
      action = '하락세 지속 · 신규 진입 제외';
    } else {
      phase = 'cooldown';
      label = '재탐색 대기';
      direction = aiMarketDirection(`${asset.symbol}-${cycle}-cooldown`);
      action = '조건 미충족 · 다음 탐색 주기 준비';
    }
  } else if (pos < 9) {
    phase = 'buy';
    label = '매수 진행';
    direction = bullishCycle
      ? { key: 'strong-up', label: '강한 상승', tone: 'up' }
      : { key: 'up', label: '상승 전환', tone: 'up' };
    action = '진입 조건 충족 · 매수 처리 중';
  } else if (pos < cycleLength - 4) {
    phase = 'hold';
    label = '보유 관리';
    const holdSegment = Math.floor((pos - 9) / 3);
    direction = aiMarketDirection(`${asset.symbol}-${cycle}-hold-${holdSegment}`, true);
    action = direction.tone === 'down'
      ? '하락 전환 감지 · 리스크 재평가'
      : direction.tone === 'up'
        ? '수익 구간 추적 · 보유 유지'
        : '변동성 관리 · 보유 유지';
  } else if (pos < cycleLength - 2) {
    phase = 'sell';
    label = '매도 진행';
    direction = exitRisk
      ? { key: 'down', label: '하락 전환', tone: 'down' }
      : { key: 'up', label: '목표 구간', tone: 'up' };
    action = exitRisk ? '하락 전환 대응 · 매도 처리 중' : '목표 구간 도달 · 매도 처리 중';
  } else {
    phase = 'cooldown';
    label = '재탐색 대기';
    direction = aiMarketDirection(`${asset.symbol}-${cycle}-cooldown`);
    action = '처리 결과 반영 · 다음 탐색 준비';
  }

  return { ...asset, phase, label, action, direction, cycle, cycleLength, pos };
}

function buildAiMarketStates(stepSeed) {
  return aiTradingAssets.map((asset) => aiMarketStateAt(asset, stepSeed));
}

function buildAiMarketHistory(stepSeed, startedAt, count = 100) {
  const latestStep = Math.max(1, Math.floor(Number(stepSeed || 1)));
  const targetCount = Math.min(100, Math.max(1, Math.floor(Number(count || 100))));
  const startedMs = startedAt ? new Date(startedAt).getTime() : NaN;
  const rows = [];
  const maxLookback = Math.min(latestStep, 720);
  for (let step = latestStep; step >= Math.max(1, latestStep - maxLookback) && rows.length < targetCount; step -= 1) {
    for (const asset of aiTradingAssets) {
      if (rows.length >= targetCount) break;
      const current = aiMarketStateAt(asset, step);
      const previous = aiMarketStateAt(asset, step - 1);
      const changed = current.phase !== previous.phase || current.direction.key !== previous.direction.key;
      if (!changed) continue;
      rows.push({
        id: `${asset.symbol}-${step}-${current.phase}-${current.direction.key}`,
        step,
        at: Number.isFinite(startedMs) ? new Date(startedMs + step * AI_PROCESS_STEP_MINUTES * 60 * 1000).toISOString() : null,
        ...current,
        previousLabel: previous.label,
      });
    }
  }
  return rows;
}

function formatAiMarketPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return '—';
  if (price < 1) return `$${price.toFixed(4)}`;
  if (price < 100) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


export { getMemberProcessSnapshot, aiProcessStatusLabel, aiProcessDurationLabel, aiProcessOpportunityDday, buildAiMarketStates, buildAiMarketHistory };
