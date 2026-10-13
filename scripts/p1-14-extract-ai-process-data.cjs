const fs = require('fs');

const file = 'app/page.js';
let source = fs.readFileSync(file, 'utf8');

const importLine = 'import { fetchAiProcessStateData } from "./lib/ai-process-data";';
if (!source.includes(importLine)) {
  const anchor = 'import { buildAiImpactSummary } from "./lib/ai-process-impact";';
  if (!source.includes(anchor)) throw new Error('P1-14 import anchor not found');
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

const startMarker = '  async function loadAiProcessState() {';
const endMarker = '\n  async function adminStartAiProcess() {';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('P1-14 loadAiProcessState block not found');
if (source.indexOf(startMarker, start + 1) !== -1) throw new Error('P1-14 duplicate loadAiProcessState found');

const replacement = `  async function loadAiProcessState() {\n    if (!user) return;\n    const needPublicSessions = profile?.role === "admin" || chatTab === "ai";\n    if (needPublicSessions) setAiPublicLoading(true);\n    try {\n      const {\n        mineError,\n        publicError,\n        rows,\n        publicList,\n        preferredId,\n        selected,\n      } = await fetchAiProcessStateData({\n        supabase,\n        userId: user.id,\n        needPublicSessions,\n        selectedProcessId: aiSelectedProcessId,\n      });\n\n      if (mineError) console.error("AI PROCESS 내 세션 조회 오류:", mineError);\n      if (publicError) console.error("AI PROCESS 공개 현황 조회 오류:", publicError);\n\n      setAiSessions(rows);\n      if (preferredId !== aiSelectedProcessId) setAiSelectedProcessId(preferredId);\n      setAiSession(selected);\n      if (needPublicSessions) setAiPublicSessions(publicList);\n    } finally {\n      if (needPublicSessions) setAiPublicLoading(false);\n    }\n  }\n`;

source = source.slice(0, start) + replacement + source.slice(end);

const required = [
  'fetchAiProcessStateData({',
  'setAiSessions(rows);',
  'setAiSession(selected);',
  'setAiPublicSessions(publicList);',
  'setAiPublicLoading(false);',
];
for (const text of required) {
  if (!source.includes(text)) throw new Error(`P1-14 verification failed: ${text}`);
}

fs.writeFileSync(file, source);
console.log('P1-14 page.js refactor applied');
