import fs from 'node:fs';

const path = 'app/api/market-sim/route.js';
let src = fs.readFileSync(path, 'utf8');

const oldBlock = `async function fetchYahooQuote(asset) {
  const url = \`https://query1.finance.yahoo.com/v8/finance/chart/\${encodeURIComponent(asset.yahoo)}?interval=5m&range=1d\`;
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
    if (!response.ok) throw new Error(\`Yahoo \${asset.yahoo} \${response.status}\`);
    const data = await response.json().catch(() => null);
    const result = data?.chart?.result?.[0];
    const metaPrice = Number(result?.meta?.regularMarketPrice);
    const closeValues = Array.isArray(result?.indicators?.quote?.[0]?.close)
      ? result.indicators.quote[0].close
      : [];
    const lastClose = [...closeValues].reverse().find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
    const price = Number.isFinite(metaPrice) && metaPrice > 0 ? metaPrice : Number(lastClose);
    if (!Number.isFinite(price) || price <= 0) throw new Error(\`Yahoo \${asset.yahoo} price missing\`);
    return { symbol: asset.symbol, name: asset.name, type: asset.type, price };
  } finally {
    clearTimeout(timeout);
  }
}`;

const newBlock = `async function fetchYahooQuote(asset) {
  const includePrePost = asset.type === "stock" ? "true" : "false";
  const url = \`https://query1.finance.yahoo.com/v8/finance/chart/\${encodeURIComponent(asset.yahoo)}?interval=5m&range=2d&includePrePost=\${includePrePost}\`;
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
    if (!response.ok) throw new Error(\`Yahoo \${asset.yahoo} \${response.status}\`);
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
    if (!Number.isFinite(price) || price <= 0) throw new Error(\`Yahoo \${asset.yahoo} price missing\`);

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
}`;

if (!src.includes(oldBlock)) {
  throw new Error('V29 target block not found; refusing to modify unexpected source');
}

src = src.replace(oldBlock, newBlock);
fs.writeFileSync(path, src);
console.log('Applied V29 Yahoo extended-hours patch');
