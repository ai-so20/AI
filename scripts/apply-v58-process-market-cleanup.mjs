import fs from 'node:fs';

const pagePath = 'app/page.js';
const cssPath = 'app/globals.css';
let page = fs.readFileSync(pagePath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');

// Remove the old whole-market panel. User value now comes from PROCESS impact data above.
const marketStart = '                  <section className="ai-v2-panel ai-v2-market-panel" style={{alignSelf:"start"}}>';
const marketEndMarker = '                  </section>\n                </div>\n\n                <section className="ai-v2-panel ai-v2-log-panel"';
const start = page.indexOf(marketStart);
if (start !== -1) {
  const end = page.indexOf(marketEndMarker, start);
  if (end === -1) throw new Error('V58 market end anchor not found');
  page = page.slice(0, start) + '                </div>\n\n                <section className="ai-v2-panel ai-v2-log-panel"' + page.slice(end + marketEndMarker.length);
}

// Reframe the chart around the member's PROCESS, not the market itself.
page = page.replace('ai-v50-auto-badge">시장 자동 반영', 'ai-v50-auto-badge">PROCESS 자동 반영');
page = page.replace('<span>평가금액 변화</span>\n                        <strong>AI PROCESS 자산 변화</strong>', '<span>내 PROCESS 변화</span>\n                        <strong>평가금액 변화</strong>');

const marker = '/* V58 PROCESS-FIRST MARKET CLEANUP */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.vip-app-shell.is-member .ai-v2-workspace{grid-template-columns:minmax(0,1fr)!important;gap:0!important}.vip-app-shell.is-member .ai-v2-chart-panel{width:100%!important;min-width:0!important}.vip-app-shell.is-member .ai-v2-chart-panel .ai-v2-panel-head{align-items:center!important}.vip-app-shell.is-member .ai-v50-auto-badge{background:#eef3ff!important;color:#315be8!important;border:1px solid #dbe5ff!important}.vip-app-shell.is-member .ai-v2-chart-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}.vip-app-shell.is-member .ai-v2-chart-kpis>div{min-width:0!important}@media(max-width:760px){.vip-app-shell.is-member .ai-v2-chart-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}.vip-app-shell.is-member .ai-v2-chart-kpis b{font-size:12px!important}.vip-app-shell.is-member .ai-v50-auto-badge{font-size:9px!important}}\n`;
}

fs.writeFileSync(pagePath, page);
fs.writeFileSync(cssPath, css);
