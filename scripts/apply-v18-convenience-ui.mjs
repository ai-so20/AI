import fs from "node:fs";

const path = "app/page.js";
let src = fs.readFileSync(path, "utf8");

const fixedStart = `                    {profile?.role !== "admin" && (\n                      <section className="vip-private-intro">`;
const fixedEnd = `                    <div style={styles.refPrivateTop}>`;
const start = src.indexOf(fixedStart);
const end = src.indexOf(fixedEnd, start);
if (start < 0 || end < 0) throw new Error("private fixed intro block not found");
src = src.slice(0, start) + src.slice(end);

const privateMessagesMarker = `                    <div ref={privateMessagesRef} style={styles.refPrivateMessages}>\n`;
if (!src.includes(privateMessagesMarker)) throw new Error("private message area marker not found");
const inChatGuide = `                    <div ref={privateMessagesRef} style={styles.refPrivateMessages}>\n                      {profile?.role !== "admin" && (\n                        <section className="vip-private-intro vip-private-intro-in-chat" style={{margin:"2px 0 18px",flexShrink:0}}>\n                          <div className="vip-private-chip">VIP MEMBERSHIP</div>\n                          <h3>VIP 회원님, 환영합니다. <span>♛</span></h3>\n                          <p>1:1 문의는 이 채팅에서 편하게 남겨주세요. 이벤트 당첨 상품과 주요 안내도 이곳으로 전달됩니다.</p>\n                          <div className="vip-private-event">\n                            <b>🎁 VIP 이용 안내</b>\n                            <span>이벤트 당첨 시 기프티콘과 상세 안내가 이 채팅에 자동으로 지급됩니다.</span>\n                          </div>\n                          <div className="vip-private-shortcuts">\n                            <button type="button" onClick={() => setChatTab("group")}>💬 <b>그룹채팅</b></button>\n                            <button type="button" onClick={() => setChatTab("event")}>🎁 <b>이벤트</b></button>\n                          </div>\n                          {!pushEnabled && (\n                            <button type="button" className="vip-private-alert" onClick={enablePrivateNotifications}>🔔 <span><b>알림 켜기</b><small>당첨 및 1:1 답변 알림을 받을 수 있습니다.</small></span></button>\n                          )}\n                        </section>\n                      )}\n`;
src = src.replace(privateMessagesMarker, inChatGuide);

const lockMarker = `                {memberGroupChatLocked && (\n                  <div style={styles.refLockNotice}>🔒 그룹채팅 운영시간은 11:00 ~ 18:30입니다.</div>\n                )}\n\n                <div ref={groupMessagesRef} style={styles.refMessages}>`;
if (!src.includes(lockMarker)) throw new Error("group lock/message marker not found");
const quickStrip = `                {memberGroupChatLocked && (\n                  <div style={styles.refLockNotice}>🔒 그룹채팅 운영시간은 11:00 ~ 18:30입니다.</div>\n                )}\n\n                {profile?.role !== "admin" && (activeEvent || memberUnreadCount > 0 || aiSession?.status === "running") && (\n                  <div style={{display:"flex",gap:"7px",padding:"8px 12px",background:"#fff8eb",borderBottom:"1px solid #ead9bd",overflowX:"auto",flexShrink:0}}>\n                    {activeEvent && (\n                      <button type="button" onClick={() => setChatTab("event")} style={{border:"1px solid #dfbe7b",background:activeEvent.participated?"#f7f0e2":"#fff1ca",color:"#5a3a18",borderRadius:"999px",padding:"7px 11px",fontSize:"11px",fontWeight:900,whiteSpace:"nowrap",cursor:"pointer"}}>\n                        {activeEvent.participated ? "✓ 이벤트 참여 완료" : "🎁 이벤트 바로 참여"}\n                      </button>\n                    )}\n                    {aiSession?.status === "running" && (\n                      <button type="button" onClick={() => setChatTab("ai")} style={{border:"1px solid #c6d5e8",background:"#eef5ff",color:"#173b69",borderRadius:"999px",padding:"7px 11px",fontSize:"11px",fontWeight:900,whiteSpace:"nowrap",cursor:"pointer"}}>◆ AI PROCESS 진행 중</button>\n                    )}\n                    {memberUnreadCount > 0 && (\n                      <button type="button" onClick={() => setChatTab("private")} style={{border:"1px solid #dfc9aa",background:"#fff",color:"#5a3a18",borderRadius:"999px",padding:"7px 11px",fontSize:"11px",fontWeight:900,whiteSpace:"nowrap",cursor:"pointer"}}>🎧 1:1 새 답변 {memberUnreadCount}</button>\n                    )}\n                  </div>\n                )}\n\n                <div ref={groupMessagesRef} style={styles.refMessages}>`;
src = src.replace(lockMarker, quickStrip);

const oldEventCopy = `<span>{activeEvent ? "LIVE EVENT" : "NEXT EVENT"}</span>\n                      <strong>{featuredEvent.title}</strong>\n                      <small>{formatEventTime(featuredEvent.starts_at)} ~ {formatEventTime(featuredEvent.ends_at)}</small>`;
const newEventCopy = `<span>{activeEvent ? "LIVE EVENT" : "NEXT EVENT"}</span>\n                      <strong>{featuredEvent.title}</strong>\n                      <small>{activeEvent ? (featuredEvent.participated ? "✓ 참여 완료 · 결과를 기다려주세요" : "지금 참여 가능 · 눌러서 바로 이동") : (formatEventTime(featuredEvent.starts_at) + " ~ " + formatEventTime(featuredEvent.ends_at))}</small>`;
src = src.replace(oldEventCopy, newEventCopy);

fs.writeFileSync(path, src);
console.log("patched", path);
