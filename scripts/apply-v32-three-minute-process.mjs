import fs from 'node:fs';

const routePath = 'app/api/market-sim/route.js';
const pagePath = 'app/page.js';

let route = fs.readFileSync(routePath, 'utf8');
let page = fs.readFileSync(pagePath, 'utf8');

const replacements = [
  ['const MARKET_FRESH_MS = 5 * 60 * 1000;', 'const MARKET_FRESH_MS = 3 * 60 * 1000;'],
  ['const ENGINE_MAX_STALE_MS = 6 * 60 * 1000;', 'const ENGINE_MAX_STALE_MS = 4 * 60 * 1000;\nconst ENGINE_REUSE_MS = 45 * 1000;'],
  ['processRefreshSeconds: 60,', 'processRefreshSeconds: 180,'],
  ['marketRefreshSeconds: 300,', 'marketRefreshSeconds: 180,'],
  ['?interval=5m&range=2d&includePrePost=${includePrePost}', '?interval=1m&range=2d&includePrePost=${includePrePost}'],
  ['// Cron 엔진 호출은 5분 이내 캐시를 재사용하면서 PROCESS만 1분 단위로 진행합니다.', '// 3분 Cron은 직전 호출이 45초 이내인 경우에만 같은 캐시를 재사용합니다.'],
  ['if (engineMode && cache && Number.isFinite(cacheAge) && cacheAge < MARKET_FRESH_MS) {', 'if (engineMode && cache && Number.isFinite(cacheAge) && cacheAge < ENGINE_REUSE_MS) {'],
];

for (const [from, to] of replacements) {
  route = route.split(from).join(to);
}

const pageReplacements = [
  ['useState("05:00")', 'useState("03:00")'],
  ['const AI_REFRESH_MS = 60 * 1000;', 'const AI_REFRESH_MS = 3 * 60 * 1000;'],
  ['1분 단위 현재금액 갱신', '3분 단위 현재금액 갱신'],
  ['<span>5분 시장</span>', '<span>3분 시장</span>'],
  ['주식·코인 8종 · 5분', '주식·코인 8종 · 3분'],
  ['<span>5분 연동</span>', '<span>3분 연동</span>'],
  ['첫 5분 시장 구간을 기록하고 있습니다.', '첫 3분 시장 구간을 기록하고 있습니다.'],
  ['<strong>5분 시장 현황</strong>', '<strong>3분 시장 현황</strong>'],
  ['<span>실제 5분</span>', '<span>실제 3분</span>'],
  ['시장 연결 후 5분 스냅샷마다 연동 종목과 누적 손익이 기록됩니다.', '시장 연결 후 3분 스냅샷마다 연동 종목과 누적 손익이 기록됩니다.'],
  ['실제 5분 시장 움직임을 기준으로 연동 종목을 선택하고, 현재금액은 서버에서 1분 단위로 갱신합니다. 연동기록은 5분 스냅샷 1건으로 압축 저장되며 실제 주문·체결 내역을 의미하지 않습니다.', '실제 3분 시장 움직임을 기준으로 연동 종목을 선택하고, 현재금액과 자산 그래프는 서버에서 3분 단위로 갱신합니다. 지급 결과는 3분 스냅샷 1건으로 기록되며 실제 주문·체결 내역을 의미하지 않습니다.'],
];

for (const [from, to] of pageReplacements) {
  page = page.split(from).join(to);
}

if (!route.includes('const MARKET_FRESH_MS = 3 * 60 * 1000;')) throw new Error('route 3m freshness patch failed');
if (!route.includes('interval=1m&range=2d')) throw new Error('Yahoo 1m source patch failed');
if (!page.includes('const AI_REFRESH_MS = 3 * 60 * 1000;')) throw new Error('page 3m refresh patch failed');
if (!page.includes('3분 시장 현황')) throw new Error('page 3m labels patch failed');

fs.writeFileSync(routePath, route);
fs.writeFileSync(pagePath, page);
console.log('Applied V32 three-minute market/process/chart patch');
