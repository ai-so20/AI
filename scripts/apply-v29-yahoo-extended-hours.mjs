import fs from 'node:fs';

const routePath = 'app/api/market-sim/route.js';
const pagePath = 'app/page.js';

let route = fs.readFileSync(routePath, 'utf8');
let page = fs.readFileSync(pagePath, 'utf8');

const oldYahoo = `async function fetchYahooQuote(asset) {
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

const newYahoo = `async function fetchYahooQuote(asset) {
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

if (route.includes(oldYahoo)) {
  route = route.replace(oldYahoo, newYahoo);
} else if (!route.includes('includePrePost=${includePrePost}')) {
  throw new Error('Yahoo target block not found');
}

if (!page.includes('const aiSimRequestSeq = useRef(0);')) {
  page = page.replace(
    '  const privateEmojiRef = useRef(null);',
    '  const privateEmojiRef = useRef(null);\n  const aiSimRequestSeq = useRef(0);'
  );
}

if (!page.includes('const [aiChartHover, setAiChartHover] = useState(null);')) {
  page = page.replace(
    '  const [aiCountdown, setAiCountdown] = useState("05:00");',
    '  const [aiCountdown, setAiCountdown] = useState("05:00");\n  const [aiChartHover, setAiChartHover] = useState(null);'
  );
}

const updateStart = '  async function updateAiSimulation() {\n    if (!user || aiSimLoading) return;\n\n    setAiSimLoading(true);';
const updateNew = '  async function updateAiSimulation() {\n    if (!user) return;\n\n    const requestId = ++aiSimRequestSeq.current;\n    setAiSimLoading(true);';
if (page.includes(updateStart)) {
  page = page.replace(updateStart, updateNew);
} else if (!page.includes('const requestId = ++aiSimRequestSeq.current;')) {
  throw new Error('AI simulation start block not found');
}

const beforeSetAiSim = '      setAiSim({\n        startedAt: aiSession?.started_at || marketResult.updatedAt,';
if (page.includes(beforeSetAiSim)) {
  page = page.replace(
    beforeSetAiSim,
    '      if (requestId !== aiSimRequestSeq.current) return;\n\n      setAiSim({\n        startedAt: aiSession?.started_at || marketResult.updatedAt,'
  );
}

const oldFinally = '    } finally {\n      setAiSimLoading(false);\n    }\n  }';
const newFinally = '    } finally {\n      if (requestId === aiSimRequestSeq.current) setAiSimLoading(false);\n    }\n  }';
const simStart = page.indexOf('  async function updateAiSimulation()');
const simEnd = page.indexOf('\n  useEffect(() => {', simStart);
if (simStart < 0 || simEnd < 0) throw new Error('AI simulation function boundaries not found');
let simBlock = page.slice(simStart, simEnd);
if (simBlock.includes(oldFinally)) {
  simBlock = simBlock.replace(oldFinally, newFinally);
  page = page.slice(0, simStart) + simBlock + page.slice(simEnd);
} else if (!simBlock.includes('requestId === aiSimRequestSeq.current')) {
  throw new Error('AI simulation finally block not found');
}

const oldCircle = `                          {aiChart.nodes.slice(-24).map((node, index) => (
                            <circle
                              key={\`${'${'}node.at || index}-${'${'}index}\`}
                              cx={node.x}
                              cy={node.y}
                              r={node.delta ? 5.2 : 3.2}
                              className={Number(node.delta || 0) < 0 ? "ai-v2-point is-loss" : Number(node.delta || 0) > 0 ? "ai-v2-point is-profit" : "ai-v2-point"}
                            >
                              <title>{\`${'${'}aiTime(node.at)} · ${'${'}node.name || "AI PROCESS"} · ${'${'}aiSignedKrw(node.delta || 0)} · ${'${'}aiKrw(node.value)}\`}</title>
                            </circle>
                          ))}`;

const newCircle = `                          {aiChart.nodes.slice(-24).map((node, index) => (
                            <circle
                              key={\`${'${'}node.at || index}-${'${'}index}\`}
                              cx={node.x}
                              cy={node.y}
                              r={node.delta ? 5.2 : 3.2}
                              className={Number(node.delta || 0) < 0 ? "ai-v2-point is-loss" : Number(node.delta || 0) > 0 ? "ai-v2-point is-profit" : "ai-v2-point"}
                              onMouseEnter={() => setAiChartHover(node)}
                              onMouseLeave={() => setAiChartHover(null)}
                              onClick={() => setAiChartHover((current) => current?.at === node.at ? null : node)}
                              style={{cursor:"pointer"}}
                            />
                          ))}`;

if (page.includes(oldCircle)) {
  page = page.replace(oldCircle, newCircle);
} else if (page.includes('<title>{`${aiTime(node.at)}')) {
  throw new Error('Chart point block changed unexpectedly');
}

const tooltipAnchor = `                        </svg>
                      ) : (`;
const tooltipBlock = `                        </svg>
                      ) : (`;

const scaleAnchor = '                      <div className="ai-v2-chart-scale ai-v2-chart-scale-top">{aiKrw(aiChart.max)}</div>';
if (!page.includes('ai-v2-custom-tooltip') && page.includes(scaleAnchor)) {
  page = page.replace(
    scaleAnchor,
    `                      {aiChartHover && (
                        <div
                          className="ai-v2-custom-tooltip"
                          style={{
                            position:"absolute",
                            left:\`${'${'}Math.min(88, Math.max(12, (Number(aiChartHover.x || 0) / aiChart.width) * 100))}%\`,
                            top:\`${'${'}Math.min(82, Math.max(12, (Number(aiChartHover.y || 0) / aiChart.height) * 100))}%\`,
                            transform:"translate(-50%,-118%)",
                            zIndex:5,
                            minWidth:"150px",
                            padding:"9px 10px",
                            borderRadius:"10px",
                            background:"rgba(39,31,25,.95)",
                            border:"1px solid rgba(224,188,128,.34)",
                            boxShadow:"0 8px 22px rgba(43,28,18,.24)",
                            color:"#fff8ef",
                            pointerEvents:"none",
                            fontSize:"10px",
                            lineHeight:1.45,
                            whiteSpace:"nowrap"
                          }}
                        >
                          <b style={{display:"block",marginBottom:"3px"}}>{aiChartHover.name || "AI PROCESS"}</b>
                          <span>{aiTime(aiChartHover.at)} · {aiSignedKrw(aiChartHover.delta || 0)}</span><br/>
                          <span>평가금액 {aiKrw(aiChartHover.value)}</span>
                        </div>
                      )}
` + scaleAnchor
  );
}

fs.writeFileSync(routePath, route);
fs.writeFileSync(pagePath, page);
console.log('Applied bundled market/chart fixes');
