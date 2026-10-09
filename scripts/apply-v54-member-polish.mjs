import fs from 'node:fs';

const cssPath = 'app/globals.css';
let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* V54 member color typography header polish */';
if (!css.includes(marker)) {
  css += `

${marker}
/* Final member palette overrides old beige/gold layers without changing chat structure. */
.vip-app-shell.is-member{font-family:Inter,Pretendard,"Noto Sans KR",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;color:#142033!important;background:#fff!important;border-color:#dce4ed!important}
.vip-app-shell.is-member .vip-app-body{background:#f5f7fa!important}

/* Shared member header — quieter, financial-service tone */
.vip-app-shell.is-member .vip-app-header{background:rgba(255,255,255,.985)!important;border-bottom:1px solid #dfe6ee!important;box-shadow:none!important;color:#14233a!important}
.vip-app-shell.is-member .vip-brand-title{color:#10233f!important;font-size:15px!important;font-weight:900!important;letter-spacing:-.22px!important}
.vip-app-shell.is-member .vip-brand-title span{color:#315be8!important}
.vip-app-shell.is-member .vip-brand-sub{color:#8996a8!important;font-size:7.5px!important;letter-spacing:.75px!important;font-weight:700!important}
.vip-app-shell.is-member .vip-app-header button{background:#fff!important;color:#33445e!important;border:1px solid #d8e1ec!important;box-shadow:none!important}
.vip-app-shell.is-member .vip-app-header button:hover{background:#f5f8ff!important;border-color:#bfcdec!important}
.vip-app-shell.is-member .vip-myinfo-button img{border:1px solid #c8d4e5!important;box-shadow:none!important}
.vip-app-shell.is-member .vip-logout-button{color:#64748b!important}

/* Member navigation — blue active state, remove inherited gold */
.vip-app-shell.is-member .vip-app-nav{background:#f8fafc!important;border-color:#e0e7ef!important}
.vip-app-shell.is-member .vip-app-nav>button{background:transparent!important;color:#7a8798!important;border-color:transparent!important;box-shadow:none!important}
.vip-app-shell.is-member .vip-app-nav>button.is-active{background:#eef3ff!important;color:#315be8!important;border-color:#d7e2ff!important;box-shadow:none!important}
@media(min-width:1000px){
  .vip-app-shell.is-member .vip-app-nav:before{color:#122744!important}
  .vip-app-shell.is-member .vip-app-nav:after{color:#8a98aa!important}
}

/* AI PROCESS hero — explicit readable hierarchy */
.vip-app-shell.is-member .ai-v2-hero{background:linear-gradient(125deg,#071b34 0%,#0c2d57 62%,#15467e 100%)!important;color:#fff!important}
.vip-app-shell.is-member .ai-v2-eyebrow{color:#9dbdff!important;font-size:10px!important;font-weight:850!important;letter-spacing:1.35px!important}
.vip-app-shell.is-member .ai-v2-live-dot{background:#55d6aa!important;box-shadow:0 0 0 4px rgba(85,214,170,.12)!important}
.vip-app-shell.is-member .ai-v2-hero h2,.vip-app-shell.is-member .ai-v2-hero-copy h2{color:#f8fbff!important;font-weight:900!important;text-shadow:none!important}
.vip-app-shell.is-member .ai-v2-hero p,.vip-app-shell.is-member .ai-v2-hero-copy p{color:#c4d3e5!important}
.vip-app-shell.is-member .ai-v2-status-row{color:#a9b9cc!important}.vip-app-shell.is-member .ai-v2-status-row b{color:#edf4ff!important}
.vip-app-shell.is-member .ai-v2-status{font-weight:800!important}
.vip-app-shell.is-member .ai-v2-status.is-running{background:rgba(74,202,159,.12)!important;border-color:rgba(102,225,184,.28)!important;color:#9af0d0!important}
.vip-app-shell.is-member .ai-v2-status.is-done{background:rgba(255,255,255,.10)!important;border-color:rgba(255,255,255,.16)!important;color:#d6e0ec!important}
.vip-app-shell.is-member .ai-v2-hero-result>span{color:#b8c8db!important;font-weight:700!important}
.vip-app-shell.is-member .ai-v2-hero-result>strong{color:#ffffff!important;font-weight:900!important}
.vip-app-shell.is-member .ai-v2-hero-result>em{color:#8ce6c3!important}
.vip-app-shell.is-member .ai-v2-hero-result>small{color:#9fb1c6!important}

/* Remove remaining gold/brown accents inside the member AI workspace */
.vip-app-shell.is-member .ai-v2-market-count,.vip-app-shell.is-member .ai-v2-history-count{color:#315be8!important;background:#eef3ff!important;border-color:#dce5ff!important}
.vip-app-shell.is-member .ai-v2-asset-icon.stock,.vip-app-shell.is-member .ai-v2-asset-icon.crypto{background:#edf3ff!important;color:#315be8!important}
.vip-app-shell.is-member .ai-v2-panel-head span{color:#315be8!important}
.vip-app-shell.is-member .ai-v2-start-line-label{color:#5f7088!important;background:#edf2f7!important}

/* 1:1 inquiry — keep layout, only align palette/type with the new system */
.vip-app-shell.is-member .vip-private-intro{background:#fff!important;border:1px solid #dfe6ef!important;color:#18283d!important;box-shadow:none!important;border-radius:10px!important}
.vip-app-shell.is-member .vip-private-chip{background:#eef3ff!important;color:#315be8!important;border-radius:5px!important}
.vip-app-shell.is-member .vip-private-intro h3{color:#172b46!important;font-size:18px!important;font-weight:900!important;letter-spacing:-.45px!important}
.vip-app-shell.is-member .vip-private-intro h3 span{color:#315be8!important}
.vip-app-shell.is-member .vip-private-intro>p{color:#69778a!important;font-size:11px!important}
.vip-app-shell.is-member .vip-private-event{background:#f4f7fb!important;border-color:#dfe7f1!important;border-radius:7px!important}.vip-app-shell.is-member .vip-private-event b{color:#22344c!important}.vip-app-shell.is-member .vip-private-event span{color:#6e7d90!important}
.vip-app-shell.is-member .vip-private-shortcuts button{background:#fff!important;border-color:#dce4ee!important;color:#34445c!important;border-radius:6px!important;box-shadow:none!important}
.vip-app-shell.is-member .vip-private-alert{background:#edf3ff!important;border-color:#d6e2ff!important;color:#274676!important;border-radius:7px!important;box-shadow:none!important}.vip-app-shell.is-member .vip-private-alert small{color:#667892!important}

@media(max-width:999px){
  .vip-app-shell.is-member .vip-app-header{height:64px!important;min-height:64px!important;padding:0 12px!important}
  .vip-app-shell.is-member .vip-brand-title{font-size:14px!important}
  .vip-app-shell.is-member .vip-brand-sub{font-size:7px!important}
  .vip-app-shell.is-member .vip-app-nav{background:#fff!important}
  .vip-app-shell.is-member .vip-app-nav>button.is-active{background:#eef3ff!important;color:#315be8!important;border-color:#d8e3ff!important}
  .vip-app-shell.is-member .ai-v2-hero h2{font-size:29px!important}
}
`;
  fs.writeFileSync(cssPath, css);
}
