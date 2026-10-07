import fs from "node:fs";

const pagePath = "app/page.js";
const cssPath = "app/globals.css";
let page = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

const oldState = `      const rows = Array.isArray(mineRows) ? mineRows : [];
      setAiSessions(rows);
      const preferredId = aiSelectedProcessId && rows.some((row) => row.id === aiSelectedProcessId)
        ? aiSelectedProcessId
        : (rows.find((row) => row.status === "running")?.id || rows[0]?.id || "");
      if (preferredId !== aiSelectedProcessId) setAiSelectedProcessId(preferredId);
      setAiSession(rows.find((row) => row.id === preferredId) || null);
      if (needPublicSessions) setAiPublicSessions(publicRows || []);`;

const newState = `      const directRows = Array.isArray(mineRows) ? mineRows : [];
      const publicList = Array.isArray(publicRows) ? publicRows : [];
      const publicMine = publicList
        .filter((row) => row.user_id === user.id)
        .map((row) => ({ ...row, id: row.id || row.process_id }));
      const rows = directRows.length ? directRows : publicMine;
      setAiSessions(rows);
      const preferredId = aiSelectedProcessId && rows.some((row) => row.id === aiSelectedProcessId)
        ? aiSelectedProcessId
        : (rows.find((row) => row.status === "running")?.id || rows[0]?.id || "");
      if (preferredId !== aiSelectedProcessId) setAiSelectedProcessId(preferredId);
      const selected = rows.find((row) => row.id === preferredId)
        || publicMine.find((row) => row.status === "running")
        || null;
      setAiSession(selected);
      if (needPublicSessions) setAiPublicSessions(publicList);`;

if (!page.includes(oldState)) throw new Error("AI PROCESS state block not found");
page = page.replace(oldState, newState);

page = page
  .replace("내 AI PROCESS 운용 현황", "내 AI PROCESS")
  .replace("내 자산 변화와 실제 시장 연동 기록, 현재 진행 PROCESS를 한 화면에서 확인하세요.", "현재 평가금액과 자산 흐름, 시장 연동 상태를 확인하세요.")
  .replace("<span>PERFORMANCE</span>", "<span>자산 흐름</span>")
  .replace("<span>LIVE MARKET</span>", "<span>실시간 시장</span>")
  .replace("<span>PROCESS HISTORY</span>", "<span>운용 기록</span>");

const marker = "/* V19 FINANCE PROCESS UI */";
if (!css.includes(marker)) {
  css += `\n\n${marker}
.ai-v2-shell{display:flex!important;flex-direction:column!important;background:#f6f2ec!important;color:#302a25!important}
.ai-v2-shell>.ai-v2-hero{order:10!important}
.ai-v2-shell>.ai-v2-process-switcher,.ai-v2-shell>.ai-v2-admin-console{order:20!important}
.ai-v2-shell>.ai-v2-summary-grid{order:30!important}
.ai-v2-shell>.ai-v2-error{order:35!important}
.ai-v2-shell>.ai-v2-workspace{order:40!important}
.ai-v2-shell>.ai-v2-live-members{order:50!important}
.ai-v2-shell>.ai-v2-log-panel{order:60!important}
.ai-v2-shell>.ai-v2-disclaimer{order:70!important}

.ai-v2-hero{align-items:flex-end!important;background:linear-gradient(145deg,#fffdfa 0%,#fbf5eb 100%)!important;border:1px solid #eadfce!important;box-shadow:0 12px 34px rgba(71,49,30,.065)!important}
.ai-v2-hero-copy{max-width:56%!important}
.ai-v2-hero h2{font-size:19px!important;letter-spacing:-.55px!important;color:#40372f!important}
.ai-v2-hero p{font-size:10px!important;line-height:1.55!important;margin-top:6px!important;color:#998b7f!important}
.ai-v2-status-row{margin-top:12px!important}
.ai-v2-hero-result{min-width:330px!important;align-items:flex-start!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
.ai-v2-hero-result>span{font-size:9px!important;font-weight:850!important;color:#8e8175!important}
.ai-v2-hero-result>strong{font-size:38px!important;line-height:1.05!important;margin-top:5px!important;letter-spacing:-1.5px!important;color:#2f2925!important}
.ai-v2-hero-result>em{font-size:14px!important;margin-top:7px!important}
.ai-v2-hero-result>small{font-size:8px!important;margin-top:7px!important;color:#9c8f83!important}

.ai-v2-summary-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:0!important;margin:10px 0 0!important;padding:0!important;background:#fff!important;border:1px solid #ece2d5!important;border-radius:16px!important;overflow:hidden!important;box-shadow:0 8px 24px rgba(76,54,33,.045)!important}
.ai-v2-summary-card{border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:13px 15px!important;gap:4px!important}
.ai-v2-summary-card+.ai-v2-summary-card{border-left:1px solid #eee5da!important}
.ai-v2-summary-card:nth-child(2){display:none!important}
.ai-v2-summary-card>span{font-size:7.5px!important;color:#a09183!important}
.ai-v2-summary-card>strong{font-size:14px!important;color:#352e28!important}
.ai-v2-summary-card>small{font-size:7px!important;color:#aaa095!important}

.ai-v2-workspace{grid-template-columns:minmax(0,1.65fr) minmax(280px,.72fr)!important;gap:10px!important;padding:10px 0 0!important}
.ai-v2-panel{background:#fff!important;border:1px solid #ece2d5!important;box-shadow:0 10px 28px rgba(76,53,31,.045)!important}
.ai-v2-chart-panel,.ai-v2-market-panel,.ai-v2-log-panel{padding:15px!important}
.ai-v2-chart-kpis{display:none!important}
.ai-v2-panel-head{margin-bottom:10px!important}
.ai-v2-panel-head span{font-size:7px!important;letter-spacing:.65px!important;color:#9e8f82!important}
.ai-v2-panel-head strong{font-size:13px!important;color:#352f29!important}
.ai-v2-panel-head button{background:#fff8ec!important;border-color:#ead5ae!important;color:#916426!important}
.ai-v2-chart-wrap{height:285px!important;background:linear-gradient(180deg,#fffdfa,#fff8ef)!important;border-color:#f0e5d7!important}
.ai-v2-grid-line{stroke:#eee5da!important}.ai-v2-baseline{stroke:#d9c6a6!important}.ai-v2-performance-line{stroke:#1fa16f!important;filter:drop-shadow(0 2px 4px rgba(31,161,111,.12))!important}
.ai-v2-start-line-label{background:#fff7e9!important;color:#9a7541!important;border:1px solid #ead8bc!important}
.ai-v2-chart-scale{color:#b0a499!important}

.ai-v2-market-grid{gap:5px!important}
.ai-v2-market-row{padding:8px 9px!important;border-radius:10px!important;background:#fdfbf8!important;border-color:#f0e7dc!important}
.ai-v2-market-name strong,.ai-v2-market-price strong{color:#423a33!important}.ai-v2-market-name span{color:#aaa096!important}
.ai-v2-market-empty{padding:18px 10px!important;border-radius:10px!important;background:#fdfbf8!important;border:1px dashed #eadfce!important;color:#a09285!important}

.ai-v2-live-members{margin-top:10px!important;background:#fff!important;border:1px solid #ece2d5!important;box-shadow:0 8px 24px rgba(76,54,33,.04)!important}
.ai-v2-live-member-card{box-shadow:none!important}
.ai-v2-log-panel{margin:10px 0 0!important}
.ai-v2-history-row{background:#fdfbf8!important;border-color:#f0e7dc!important}.ai-v2-history-asset strong,.ai-v2-history-market strong,.ai-v2-history-result strong,.ai-v2-history-balance strong{color:#443c35!important}
.ai-v2-disclaimer{margin:10px 0 0!important}

@media(max-width:900px){
  .ai-v2-workspace{grid-template-columns:1fr!important}
  .ai-v2-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .ai-v2-summary-card:nth-child(3){border-left:0!important;border-top:1px solid #eee5da!important}
  .ai-v2-summary-card:nth-child(4),.ai-v2-summary-card:nth-child(5){border-top:1px solid #eee5da!important}
}
@media(max-width:620px){
  .ai-v2-hero{align-items:flex-start!important;padding:18px 16px!important}
  .ai-v2-hero-result{order:-1!important;min-width:0!important;width:100%!important}
  .ai-v2-hero-result>strong{font-size:32px!important}
  .ai-v2-hero-copy{max-width:none!important;width:100%!important;border-top:1px solid #eee3d4!important;padding-top:13px!important}
  .ai-v2-hero h2{font-size:16px!important}
  .ai-v2-hero p{display:none!important}
  .ai-v2-summary-grid{margin-top:8px!important}
  .ai-v2-summary-card{padding:11px 10px!important}
  .ai-v2-summary-card>strong{font-size:12px!important}
  .ai-v2-chart-wrap{height:220px!important}
  .ai-v2-workspace{gap:8px!important}
  .ai-v2-live-members{margin-top:8px!important}
  .ai-v2-log-panel{margin-top:8px!important}
}
`;
}

fs.writeFileSync(pagePath, page);
fs.writeFileSync(cssPath, css);
console.log("V19 finance process UI patch applied");
