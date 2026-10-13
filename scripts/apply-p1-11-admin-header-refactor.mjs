import fs from "node:fs";

const path = "app/page.js";
let source = fs.readFileSync(path, "utf8");

const importAnchor = 'import AiProcessMemberHeader from "./components/ai-process/AiProcessMemberHeader";';
const importLine = 'import AiProcessAdminHeader from "./components/ai-process/AiProcessAdminHeader";';

if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error("P1-11 import anchor not found");
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const oldBlock = `                {profile?.role === "admin" ? (
                  <section className="ai-v51-admin-hero">
                    <div className="ai-v51-admin-hero-copy">
                      <span className="ai-v51-kicker">AI PROCESS ADMIN</span>
                      <h2>AI PROCESS 운영</h2>
                      <p>회원별 운용 상태와 금액을 한 화면에서 관리합니다.</p>
                    </div>
                    <div className="ai-v51-admin-overview">
                      <div><span>진행 중</span><strong>{aiPublicSessions.filter((x)=>x.status === "running").length}</strong><small>명</small></div>
                      <div><span>총 운용금액</span><strong>{aiKrw(aiPublicSessions.filter((x)=>x.status === "running").reduce((sum,x)=>sum+Number(x.current_amount||0),0))}</strong></div>
                      <div><span>누적 손익</span><strong className={aiPublicSessions.reduce((sum,x)=>sum+Number(x.total_profit||0),0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(aiPublicSessions.reduce((sum,x)=>sum+Number(x.total_profit||0),0))}</strong></div>
                    </div>
                  </section>
                ) : (`;

const newBlock = `                {profile?.role === "admin" ? (
                  <AiProcessAdminHeader sessions={aiPublicSessions} />
                ) : (`;

if (!source.includes(newBlock)) {
  if (!source.includes(oldBlock)) throw new Error("P1-11 admin header block not found");
  source = source.replace(oldBlock, newBlock);
}

if ((source.match(/AiProcessAdminHeader/g) || []).length !== 2) {
  throw new Error("P1-11 admin header import/usage validation failed");
}

fs.writeFileSync(path, source);
console.log("P1-11 admin header refactor applied");
