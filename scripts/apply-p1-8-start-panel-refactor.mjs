import fs from "node:fs";

const path = "app/page.js";
let source = fs.readFileSync(path, "utf8");

const importAnchor = 'import AiProcessMembersPanel from "./components/ai-process/AiProcessMembersPanel";';
const importLine = 'import AiProcessStartPanel from "./components/ai-process/AiProcessStartPanel";';
if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error("P1-8 import anchor not found");
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const oldBlock = String.raw`                {profile?.role === "admin" && (
                  <section className="ai-v2-admin-console ai-v51-admin-console">
                    <div className="ai-v2-admin-head"><div><span>NEW PROCESS</span><strong>새 AI PROCESS 시작</strong><p>회원과 운용금액, 진행기간을 지정하면 즉시 시작됩니다.</p></div><small>최소 1시간 · 최대 30일</small></div>
                    <div className="ai-v2-admin-form">
                      <select value={aiAdminMemberId} onChange={(e) => setAiAdminMemberId(e.target.value)}>
                        <option value="">회원 선택</option>
                        {adminApprovedMembers.map((member) => <option key={member.member_id} value={member.member_id}>{member.nickname}{member.account_type === "ai_character" ? " · AI" : member.account_type === "managed" ? " · 가라" : ""}</option>)}
                      </select>
                      <input value={aiAdminAmount} onChange={(e) => setAiAdminAmount(e.target.value.replace(/[^0-9]/g,""))} inputMode="numeric" placeholder="운용금액"/>
                      <div className="ai-v2-duration-control">
                        <div className="ai-v2-duration-tabs">
                          <button type="button" className={!aiAdminIndefinite ? "is-active" : ""} onClick={() => setAiAdminIndefinite(false)}>시간 지정</button>
                          <button type="button" className={aiAdminIndefinite ? "is-active" : ""} onClick={() => setAiAdminIndefinite(true)}>기간 미정</button>
                        </div>
                        {!aiAdminIndefinite ? (
                          <input value={aiAdminDurationHours} onChange={(e) => setAiAdminDurationHours(e.target.value.replace(/[^0-9]/g,""))} inputMode="numeric" placeholder="진행 시간"/>
                        ) : (
                          <div className="ai-v2-indefinite-label"><b>∞ 기간 미정</b><span>관리자가 종료할 때까지 진행</span></div>
                        )}
                      </div>
                      <button type="button" onClick={adminStartAiProcess} disabled={aiAdminWorking || !aiAdminMemberId}>{aiAdminWorking ? "처리 중" : "PROCESS START"}</button>
                    </div>
                  </section>
                )}`;

const newBlock = String.raw`                {profile?.role === "admin" && (
                  <AiProcessStartPanel
                    members={adminApprovedMembers}
                    memberId={aiAdminMemberId}
                    setMemberId={setAiAdminMemberId}
                    amount={aiAdminAmount}
                    setAmount={setAiAdminAmount}
                    durationHours={aiAdminDurationHours}
                    setDurationHours={setAiAdminDurationHours}
                    indefinite={aiAdminIndefinite}
                    setIndefinite={setAiAdminIndefinite}
                    working={aiAdminWorking}
                    onStart={adminStartAiProcess}
                  />
                )}`;

if (!source.includes(oldBlock)) throw new Error("P1-8 target block not found");
source = source.replace(oldBlock, newBlock);
fs.writeFileSync(path, source);
console.log("P1-8 patch applied");
