import fs from 'node:fs';

const path = 'app/lib/ai-community.js';
let s = fs.readFileSync(path, 'utf8');
const marker = '// V33: exclude admin/system event messages from human conversation detection';
if (s.includes(marker)) {
  console.log('V33 already applied');
  process.exit(0);
}

const oldSelect = 'db.from("profiles").select("id,nickname,account_type").in("id", memberIds)';
const newSelect = 'db.from("profiles").select("id,nickname,account_type,role").in("id", memberIds)';
if (!s.includes(oldSelect)) throw new Error('recentChatContext profile select anchor not found');
s = s.replace(oldSelect, newSelect);

const oldHuman = `  const humanRows = rows.filter((r) =>\n    r.member_id &&\n    r.message_type !== "event" &&\n    profileMap.get(r.member_id)?.account_type === "human"\n  );`;
const newHuman = `  ${marker}\n  const humanRows = rows.filter((r) => {\n    const p = profileMap.get(r.member_id);\n    return r.member_id &&\n      r.message_type !== "event" &&\n      p?.account_type === "human" &&\n      p?.role !== "admin";\n  });`;
if (!s.includes(oldHuman)) throw new Error('findLatestUnhandledHuman anchor not found');
s = s.replace(oldHuman, newHuman);

const oldRecent = '  const row = context.rows.find((r) => r.member_id && context.profileMap.get(r.member_id)?.account_type === "human");';
const newRecent = `  const row = context.rows.find((r) => {\n    const p = context.profileMap.get(r.member_id);\n    return r.member_id && r.message_type !== "event" && p?.account_type === "human" && p?.role !== "admin";\n  });`;
if (!s.includes(oldRecent)) throw new Error('hasRecentHuman anchor not found');
s = s.replace(oldRecent, newRecent);

fs.writeFileSync(path, s);
console.log('V33 applied');
