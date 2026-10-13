import fs from "node:fs";

const path = "app/page.js";
let text = fs.readFileSync(path, "utf8");

const importAnchor = 'import AiProcessHistoryPanel from "./components/ai-process/AiProcessHistoryPanel";';
const importLine = 'import AiProcessMembersPanel from "./components/ai-process/AiProcessMembersPanel";';
if (!text.includes(importLine)) {
  if (!text.includes(importAnchor)) throw new Error("P1-7 import anchor not found");
  text = text.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const startMarker = '                <section className={profile?.role === "admin" ? "ai-v2-live-members ai-v51-member-section" : "ai-v2-live-members"}>';
const endMarker = '\n\n                {aiSimError && <div className="ai-v2-error">{aiSimError}</div>}';
const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker, start);
if (start === -1 || end === -1 || end <= start) throw new Error("P1-7 members panel block not found");

const replacement = `                <AiProcessMembersPanel
                  isAdmin={profile?.role === "admin"}
                  sessions={aiPublicSessions}
                  loading={aiPublicLoading}
                  currentUserId={user?.id}
                  adminControlAmounts={aiAdminControlAmounts}
                  setAdminControlAmounts={setAiAdminControlAmounts}
                  adminWorking={aiAdminWorking}
                  onAdjust={adminAdjustAiProcess}
                  onStop={adminStopAiProcess}
                  onRestart={adminRestartAiProcess}
                />`;

text = text.slice(0, start) + replacement + text.slice(end);
fs.writeFileSync(path, text);
console.log("P1-7 members panel refactor applied");
