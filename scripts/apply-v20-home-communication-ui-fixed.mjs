import fs from "node:fs";
const pagePath="app/page.js", cssPath="app/globals.css";
let page=fs.readFileSync(pagePath,"utf8"), css=fs.readFileSync(cssPath,"utf8");
const marker='            {chatTab === "home" && profile?.role !== "admin" && (';
const start=page.indexOf(marker);
if(start<0) throw new Error("home start not found");
const next=page.indexOf('            {chatTab === "',start+marker.length);
if(next<0) throw new Error("home end not found");
const home=[
'            {chatTab === "home" && profile?.role !== "admin" && (',
'              <div className="vip-home-v20">',
'                <section className="vip-home-v20-welcome">',
'                  <div><span>AI PROCESS VIP</span><h2>{profile.nickname}님, 지금 확인할 내용입니다.</h2><p>대화, 진행 중인 PROCESS, 이벤트를 한 화면에서 빠르게 확인하세요.</p></div>',
'                  <img src={avatarSrc(profile.avatar)} alt="프로필" />',
'                </section>',
'                <section className="vip-home-v20-alerts">',
'                  {unreadPrivate > 0 && <button type="button" onClick={() => changeTab("private")}><i>🎧</i><span><b>1:1 새 답변 {unreadPrivate}</b><small>관리자 답변을 확인하세요</small></span><em>›</em></button>}',
'                  {activeEvent && <button type="button" onClick={() => changeTab("event")}><i>🎁</i><span><b>{activeEvent.participated ? "이벤트 참여 완료" : "이벤트 지금 참여 가능"}</b><small>{activeEvent.title}</small></span><em>›</em></button>}',
'                  {aiSession?.status === "running" && <button type="button" onClick={() => changeTab("ai")}><i>◆</i><span><b>AI PROCESS 진행 중</b><small>{aiKrw(aiSession?.current_amount || aiCurrentStartMoney)} · {aiSignedPct(aiSession?.total_return || 0)}</small></span><em>›</em></button>}',
'                  {unreadPrivate === 0 && !activeEvent && aiSession?.status !== "running" && <div className="vip-home-v20-quiet"><i>✓</i><span><b>새로 확인할 알림이 없습니다.</b><small>필요한 기능은 아래에서 바로 이용할 수 있습니다.</small></span></div>}',
'                </section>',
'                <section className="vip-home-v20-section">',
'                  <div className="vip-home-v20-section-head"><div><span>COMMUNICATION</span><h3>대화</h3></div><small>자주 쓰는 공간</small></div>',
'                  <div className="vip-home-v20-chatlist">',
'                    <button type="button" onClick={() => changeTab("group")}><div className="vip-home-v20-chat-icon is-group">💬</div><div className="vip-home-v20-chat-copy"><b>VIP 그룹채팅</b><span>{memberGroupChatLocked ? "현재 운영시간 외 · 11:00~18:30" : "지금 대화 가능 · VIP 회원 " + approvedMemberCount + "명"}</span></div><div className="vip-home-v20-chat-meta"><small>{memberGroupChatLocked ? "OFF" : "LIVE"}</small><em>›</em></div></button>',
'                    <button type="button" onClick={() => changeTab("private")}><div className="vip-home-v20-chat-icon is-private">🎧</div><div className="vip-home-v20-chat-copy"><b>1:1 문의</b><span>{unreadPrivate > 0 ? "새 답변 " + unreadPrivate + "건이 있습니다." : "관리자와 개인 상담 및 지급 안내"}</span></div><div className="vip-home-v20-chat-meta">{unreadPrivate > 0 && <strong>{unreadPrivate}</strong>}<em>›</em></div></button>',
'                  </div>',
'                </section>',
'                <section className="vip-home-v20-process" onClick={() => changeTab("ai")} role="button" tabIndex={0}>',
'                  <div className="vip-home-v20-process-top"><span>MY AI PROCESS</span><em>{aiSession?.status === "running" ? "진행 중" : "대기"}</em></div>',
'                  <div className="vip-home-v20-process-main"><div><small>현재 평가금액</small><strong>{aiSession?.status === "running" ? aiKrw(aiSession?.current_amount || aiCurrentStartMoney) : "진행 중인 PROCESS가 없습니다"}</strong></div>{aiSession?.status === "running" && <b className={(aiSession?.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(aiSession?.total_profit || 0)} · {aiSignedPct(aiSession?.total_return || 0)}</b>}</div>',
'                  <div className="vip-home-v20-process-foot"><span>{aiSession?.status === "running" ? "다음 반영 " + aiCountdown : "관리자가 PROCESS 시작 시 자동 표시됩니다."}</span><em>자세히 보기 ›</em></div>',
'                </section>',
'                {featuredEvent && <button type="button" className="vip-home-v20-event" onClick={() => changeTab("event")}><div><span>{activeEvent ? "LIVE EVENT" : "NEXT EVENT"}</span><h3>{featuredEvent.title}</h3><p>{activeEvent ? (featuredEvent.participated ? "참여 완료 · 결과를 기다려주세요" : "지금 참여할 수 있습니다") : formatEventTime(featuredEvent.starts_at) + " ~ " + formatEventTime(featuredEvent.ends_at)}</p></div><div className="vip-home-v20-event-icon">{eventIcon(featuredEvent.event_type)}</div></button>}',
'              </div>',
'            )}',
'',
].join("\n");
page=page.slice(0,start)+home+page.slice(next);
const cssMarker="/* V20 COMMUNICATION HOME */";
if(!css.includes(cssMarker)) css+=`\n\n${cssMarker}
.vip-home-v20{padding:18px;max-width:1120px;margin:0 auto;color:#342d27;background:#f7f3ed;min-height:100%}.vip-home-v20 button{font:inherit}
.vip-home-v20-welcome{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 24px;border-radius:22px;background:linear-gradient(135deg,#fffdfa,#fbf4e8);border:1px solid #eadfce;box-shadow:0 12px 32px rgba(74,52,31,.055)}.vip-home-v20-welcome span,.vip-home-v20-section-head span,.vip-home-v20-process-top span,.vip-home-v20-event span{font-size:8px;font-weight:950;letter-spacing:1.2px;color:#aa7a38}.vip-home-v20-welcome h2{margin:6px 0 5px;font-size:24px;letter-spacing:-.7px}.vip-home-v20-welcome p{margin:0;font-size:10px;color:#988b80}.vip-home-v20-welcome img{width:58px;height:58px;border-radius:50%;object-fit:cover;border:2px solid #e5c98e}
.vip-home-v20-alerts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.vip-home-v20-alerts>button,.vip-home-v20-quiet{min-height:72px;display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:10px;text-align:left;padding:12px 13px;border-radius:15px;background:#fff;border:1px solid #ece2d5;color:#3c342d}.vip-home-v20-alerts i{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:#fff6e5;font-style:normal}.vip-home-v20-alerts b{display:block;font-size:10px}.vip-home-v20-alerts small{display:block;margin-top:3px;font-size:8px;color:#9d9186}.vip-home-v20-alerts em{font-style:normal;color:#b7a99a;font-size:18px}.vip-home-v20-quiet{grid-column:1/-1}
.vip-home-v20-section{margin-top:14px}.vip-home-v20-section-head{display:flex;justify-content:space-between;align-items:flex-end;margin:0 2px 8px}.vip-home-v20-section-head h3{margin:3px 0 0;font-size:16px}.vip-home-v20-section-head>small{font-size:8px;color:#aa9d91}.vip-home-v20-chatlist{overflow:hidden;border:1px solid #ece2d5;border-radius:18px;background:#fff}.vip-home-v20-chatlist>button{width:100%;border:0;background:#fff;display:grid;grid-template-columns:46px 1fr auto;align-items:center;gap:11px;padding:14px 15px;text-align:left;color:#38312b}.vip-home-v20-chatlist>button+button{border-top:1px solid #f0e8de}.vip-home-v20-chat-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:18px}.vip-home-v20-chat-icon.is-group{background:#fff3d7}.vip-home-v20-chat-icon.is-private{background:#eef5ff}.vip-home-v20-chat-copy b{display:block;font-size:11px}.vip-home-v20-chat-copy span{display:block;margin-top:4px;font-size:8.5px;color:#998d82}.vip-home-v20-chat-meta{display:flex;align-items:center;gap:8px}.vip-home-v20-chat-meta small{font-size:7px;font-weight:950;color:#32a678}.vip-home-v20-chat-meta strong{min-width:20px;height:20px;border-radius:999px;background:#e6a73d;color:#fff;display:grid;place-items:center;font-size:8px}.vip-home-v20-chat-meta em{font-style:normal;font-size:20px;color:#b8ac9f}
.vip-home-v20-process{margin-top:12px;padding:18px 19px;border-radius:19px;background:linear-gradient(135deg,#23211f,#312a23);color:#fff;cursor:pointer}.vip-home-v20-process-top,.vip-home-v20-process-foot{display:flex;justify-content:space-between;gap:12px}.vip-home-v20-process-top em{font-style:normal;font-size:8px;color:#7be0b5}.vip-home-v20-process-main{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:16px 0 14px}.vip-home-v20-process-main small{display:block;color:#a9a099;font-size:8px}.vip-home-v20-process-main strong{display:block;margin-top:5px;font-size:25px}.vip-home-v20-process-main>b{font-size:11px}.vip-home-v20-process .is-profit{color:#6dd6a8!important}.vip-home-v20-process .is-loss{color:#ff8e94!important}.vip-home-v20-process-foot{font-size:8px;color:#aca49d}.vip-home-v20-process-foot em{font-style:normal;color:#e1c48d}
.vip-home-v20-event{width:100%;margin-top:12px;padding:17px 18px;border-radius:18px;border:1px solid #ead9bd;background:linear-gradient(135deg,#fff9ed,#fff3dc);display:flex;align-items:center;justify-content:space-between;gap:14px;text-align:left;color:#3a3027}.vip-home-v20-event h3{margin:5px 0 3px;font-size:14px}.vip-home-v20-event p{margin:0;font-size:8.5px;color:#9a8774}.vip-home-v20-event-icon{width:50px;height:50px;border-radius:16px;display:grid;place-items:center;background:#fff;border:1px solid #efd9ae;font-size:22px}
@media(max-width:700px){.vip-home-v20{padding:10px}.vip-home-v20-welcome{padding:17px 15px}.vip-home-v20-welcome h2{font-size:19px}.vip-home-v20-welcome p{font-size:8px}.vip-home-v20-welcome img{width:48px;height:48px}.vip-home-v20-alerts{grid-template-columns:1fr;gap:6px}.vip-home-v20-chatlist>button{grid-template-columns:40px 1fr auto;padding:12px}.vip-home-v20-chat-icon{width:38px;height:38px}.vip-home-v20-process{padding:15px}.vip-home-v20-process-main{display:block}.vip-home-v20-process-main strong{font-size:21px}.vip-home-v20-process-main>b{display:block;margin-top:7px}}
`;
fs.writeFileSync(pagePath,page);fs.writeFileSync(cssPath,css);console.log("V20 home applied");