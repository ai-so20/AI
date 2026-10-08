import fs from 'node:fs';

let page = fs.readFileSync('app/page.js','utf8');
let css = fs.readFileSync('app/globals.css','utf8');

function replaceOnce(from,to,label){
  const next = typeof from === 'string' ? page.replace(from,to) : page.replace(from,to);
  if(next === page) throw new Error('anchor not found: '+label);
  page = next;
}

replaceOnce(
  '  const [showWelcomeModal, setShowWelcomeModal] = useState(false);',
  '  const [showWelcomeModal, setShowWelcomeModal] = useState(false);\n  const [showAiDemoInfo, setShowAiDemoInfo] = useState(false);',
  'ai demo info state'
);

replaceOnce(
  '<button type="button" onClick={()=>changeTab("ai")} style={{textAlign:"left",border:"1px solid #cbdcd7",borderRadius:"16px",padding:"14px",background:"linear-gradient(145deg,#f1f7f5,#e8f1ee)",color:"#23443a",cursor:"pointer"}}>',
  '<button type="button" onClick={()=>setShowAiDemoInfo(true)} style={{textAlign:"left",border:"1px solid #cbdcd7",borderRadius:"16px",padding:"14px",background:"linear-gradient(145deg,#f1f7f5,#e8f1ee)",color:"#23443a",cursor:"pointer"}}>',
  'home ai demo card action'
);

page = page.replace(
  '{aiDemo?.status === "running" ? "체험 화면 보기 ›" : "선정 시 AI PROCESS에서 시작"}',
  '{aiDemo?.status === "running" ? "진행 안내 보기 ›" : "안내 보기 ›"}'
);

const communicationBlock = /\n\s*<section className="vip-home-v20-section">\s*<div className="vip-home-v20-section-head"><div><span>COMMUNICATION<\/span><h3>대화<\/h3><\/div><small>자주 쓰는 공간<\/small><\/div>[\s\S]*?<\/section>\n\s*(?=<section className="vip-home-v20-process")/;
if (!communicationBlock.test(page)) throw new Error('communication block not found');
page = page.replace(communicationBlock,'\n                ');

replaceOnce(
  'profile?.role !== "admin" && (activeEvent || memberUnreadCount > 0 || aiSession?.status === "running")',
  'profile?.role !== "admin" && (activeEvent || memberUnreadCount > 0)',
  'group chip condition'
);

const aiChip = /\n\s*\{aiSession\?\.status === "running" && \(\s*<button type="button" onClick=\{\(\) => setChatTab\("ai"\)\}[\s\S]*?<\/button>\s*\)\}/;
if (!aiChip.test(page)) throw new Error('group AI PROCESS chip not found');
page = page.replace(aiChip,'');

const installAndProfile = /\n\s*\{showInstallGuide && \([\s\S]*?\n\s*\)\}\n\n\s*\{showProfileInfo && \(/;
if (!installAndProfile.test(page)) throw new Error('install guide block not found');

const newModalBlocks = String.raw`
          {showAiDemoInfo && profile?.role !== "admin" && (()=>{
            const offer = myEventRewards.find((reward)=>reward.reward_type === "ai_process" && reward.status !== "delivered");
            const running = aiDemo?.status === "running";
            return (
              <div className="vip-v47-modal-backdrop" onClick={()=>setShowAiDemoInfo(false)}>
                <section className="vip-v47-info-modal" onClick={(e)=>e.stopPropagation()}>
                  <button type="button" className="vip-v47-modal-close" onClick={()=>setShowAiDemoInfo(false)}>×</button>
                  <div className="vip-v47-modal-kicker">AI PROCESS · 돌발 체험</div>
                  <h3>AI PROCESS 돌발 체험 안내</h3>
                  <p className="vip-v47-modal-lead">선정된 회원에게 1회 제공되는 모의 체험 이벤트입니다.</p>
                  <div className="vip-v47-info-list">
                    <div><b>01</b><span><strong>참여 방법</strong><small>랜덤 선정된 회원에게 체험 혜택이 표시되며, 선정된 회원만 시작할 수 있습니다.</small></span></div>
                    <div><b>02</b><span><strong>진행 확인</strong><small>체험 시작 후 AI PROCESS 화면에서 평가금액과 수익·손실 기록을 실시간으로 확인합니다.</small></span></div>
                    <div><b>03</b><span><strong>완료 안내</strong><small>목표 수익률에 도달하면 자동 종료되며, 체험권은 1회 사용 후 다시 표시되지 않습니다.</small></span></div>
                  </div>
                  <div className="vip-v47-sim-note">실제 잔액 및 실제 정산과 분리된 모의체험입니다.</div>
                  {running ? (
                    <button type="button" className="vip-v47-modal-primary" onClick={()=>{setShowAiDemoInfo(false);changeTab("ai");}}>AI PROCESS에서 확인</button>
                  ) : offer ? (
                    <button type="button" className="vip-v47-modal-primary" disabled={eventRewardWorking} onClick={async()=>{await claimAiDemoReward(offer.id);setShowAiDemoInfo(false);changeTab("ai");}}>{eventRewardWorking?"시작 중...":"체험 시작하기"}</button>
                  ) : (
                    <button type="button" className="vip-v47-modal-primary" onClick={()=>setShowAiDemoInfo(false)}>확인</button>
                  )}
                </section>
              </div>
            );
          })()}

          {showInstallGuide && (
            <div className="vip-v47-modal-backdrop" onClick={() => setShowInstallGuide(false)}>
              <section className="vip-v47-install-card" onClick={(e)=>e.stopPropagation()}>
                <button type="button" className="vip-v47-modal-close" onClick={() => setShowInstallGuide(false)}>×</button>
                <div className="vip-v47-install-icon">📲</div>
                <div className="vip-v47-modal-kicker">AI PROCESS VIP</div>
                <h3>홈 화면에 VIP 앱 추가</h3>
                <p className="vip-v47-install-device">{isIOSDevice() ? "iPhone · Safari" : "Android · Chrome / Samsung Internet"}</p>
                <div className="vip-v47-install-steps">
                  {(isIOSDevice() ? [
                    ["01","공유 버튼 열기","Safari 하단의 공유 버튼을 눌러주세요."],
                    ["02","홈 화면에 추가","메뉴에서 ‘홈 화면에 추가’를 선택합니다."],
                    ["03","추가 확인","오른쪽 위 ‘추가’를 눌러주세요."],
                    ["04","VIP 앱 실행","홈 화면에 생성된 AI PROCESS VIP 아이콘을 실행합니다."],
                  ] : [
                    ["01","브라우저 메뉴 열기","오른쪽 위 ⋮ 메뉴를 눌러주세요."],
                    ["02","홈 화면에 추가","‘홈 화면에 추가’ 또는 ‘앱 설치’를 선택합니다."],
                    ["03","추가 확인","표시되는 창에서 ‘추가’를 눌러주세요."],
                    ["04","VIP 앱 실행","홈 화면에 생성된 AI PROCESS VIP 아이콘을 실행합니다."],
                  ]).map(([num,title,text])=><div key={num}><b>{num}</b><span><strong>{title}</strong><small>{text}</small></span></div>)}
                </div>
                <button type="button" className="vip-v47-modal-primary" onClick={()=>setShowInstallGuide(false)}>확인</button>
                <button type="button" className="vip-v47-modal-secondary" onClick={dismissInstallGuideForever}>이 설치 안내 다시 보지 않기</button>
              </section>
            </div>
          )}

          {showProfileInfo && (`;
page = page.replace(installAndProfile,newModalBlocks);

// Simplify English leftovers in user-facing home and chat areas.
page = page.replaceAll('MEMBERS','회원');
page = page.replaceAll('LIVE','진행 중');
page = page.replaceAll('OFF','운영 종료');

const cssMarker = '/* V47 DESIGN SYSTEM CLEANUP */';
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n` + String.raw`
:root{--vip47-bg:#f4f6f5;--vip47-card:#ffffff;--vip47-line:#dfe6e3;--vip47-text:#24332e;--vip47-sub:#74817d;--vip47-green:#29594b;--vip47-green-soft:#edf5f2;--vip47-navy:#263b4b}
.vip-v47-modal-backdrop{position:fixed;inset:0;z-index:2147483200;background:rgba(17,25,22,.58);backdrop-filter:blur(9px);display:grid;place-items:center;padding:18px}
.vip-v47-info-modal,.vip-v47-install-card{position:relative;width:min(480px,100%);max-height:90vh;overflow:auto;border-radius:26px;background:#fff;border:1px solid #e1e7e4;box-shadow:0 28px 80px rgba(18,34,28,.26);padding:26px;color:var(--vip47-text)}
.vip-v47-modal-close{position:absolute;right:16px;top:16px;width:36px;height:36px;border:0;border-radius:50%;background:#eef1ef;color:#5f6c67;font-size:22px;cursor:pointer}
.vip-v47-modal-kicker{font-size:10px;font-weight:900;letter-spacing:1.15px;color:#4d7468;margin-bottom:8px}
.vip-v47-info-modal h3,.vip-v47-install-card h3{margin:0;padding-right:44px;font-size:23px;line-height:1.3;letter-spacing:-.7px;color:#24332e}
.vip-v47-modal-lead{margin:10px 0 18px;font-size:12px;line-height:1.65;color:#6d7a76}
.vip-v47-info-list,.vip-v47-install-steps{display:grid;gap:10px;margin:18px 0}
.vip-v47-info-list>div,.vip-v47-install-steps>div{display:grid;grid-template-columns:42px 1fr;gap:11px;align-items:start;padding:12px;border-radius:14px;background:#f7f9f8;border:1px solid #e4e9e7}
.vip-v47-info-list>div>b,.vip-v47-install-steps>div>b{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#e8f1ee;color:#315f52;font-size:10px;font-weight:950}
.vip-v47-info-list span strong,.vip-v47-install-steps span strong{display:block;font-size:12px;color:#2b3b36}
.vip-v47-info-list span small,.vip-v47-install-steps span small{display:block;margin-top:4px;font-size:10px;line-height:1.55;color:#74817d}
.vip-v47-sim-note{margin:12px 0 14px;padding:10px 12px;border-radius:12px;background:#f1f5f3;color:#63726d;font-size:10px;line-height:1.55}
.vip-v47-modal-primary{width:100%;border:0;border-radius:13px;padding:13px 14px;background:var(--vip47-green);color:#fff;font-size:11px;font-weight:900;cursor:pointer}
.vip-v47-modal-primary:disabled{opacity:.55;cursor:default}
.vip-v47-modal-secondary{display:block;margin:10px auto 0;border:0;background:transparent;color:#89948f;font-size:9px;font-weight:800;cursor:pointer}
.vip-v47-install-icon{width:54px;height:54px;display:grid;place-items:center;margin:0 0 14px;border-radius:16px;background:#edf4f1;font-size:26px}
.vip-v47-install-device{display:inline-flex;margin:10px 0 0;padding:6px 9px;border-radius:999px;background:#edf2f0;color:#52665f;font-size:9px;font-weight:900}
.vip-home-v20-alerts{margin-top:10px}
.vip-home-v20-process{border-color:#dde5e2!important;box-shadow:0 8px 24px rgba(31,54,47,.06)!important}
.vip-home-v20-event{border-color:#dde5e2!important;box-shadow:0 8px 24px rgba(31,54,47,.05)!important}
@media(max-width:620px){.vip-v47-info-modal,.vip-v47-install-card{padding:22px 18px;border-radius:22px}.vip-v47-info-modal h3,.vip-v47-install-card h3{font-size:20px}.vip-v47-info-list>div,.vip-v47-install-steps>div{grid-template-columns:38px 1fr;padding:10px}.vip-v47-info-list>div>b,.vip-v47-install-steps>div>b{width:30px;height:30px}.vip-home-v20{padding-bottom:84px!important}}
`;
}

fs.writeFileSync('app/page.js',page);
fs.writeFileSync('app/globals.css',css);
console.log('V47 design/UX patch applied');
