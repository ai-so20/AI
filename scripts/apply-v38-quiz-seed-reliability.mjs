import fs from 'node:fs';

const path = 'app/api/event-runtime/route.js';
let s = fs.readFileSync(path, 'utf8');

const replacement = `async function ensureQuizBank(db) {\n  const { data: existing, error: readError } = await db.from("event_quiz_bank").select("question").limit(1000);\n  if (readError) throw new Error(\`quiz_bank_read_failed: \${readError.message}\`);\n  const have = new Set((existing || []).map((row) => row.question));\n  const missing = QUIZ_SEEDS\n    .filter((q) => Array.isArray(q) && q.length >= 6)\n    .filter((q) => q.slice(0, 5).every((value) => String(value ?? "").trim().length > 0))\n    .filter((q) => Number.isInteger(Number(q[5])) && Number(q[5]) >= 1 && Number(q[5]) <= 4)\n    .filter((q) => !have.has(q[0]))\n    .map((q) => ({\n      question: String(q[0]).trim(),\n      option_1: String(q[1]).trim(),\n      option_2: String(q[2]).trim(),\n      option_3: String(q[3]).trim(),\n      option_4: String(q[4]).trim(),\n      correct_option: Number(q[5]),\n      active: true,\n    }));\n\n  // 큰 seed 배열을 한 번에 보내면 PostgREST 요청 크기/문장 제한에서 조용히 실패할 수 있어\n  // 40개씩 나눠 넣고 오류를 즉시 드러내도록 합니다.\n  for (let i = 0; i < missing.length; i += 40) {\n    const chunk = missing.slice(i, i + 40);\n    const { error } = await db.from("event_quiz_bank").insert(chunk);\n    if (error) throw new Error(\`quiz_seed_insert_failed[\${i}-\${i + chunk.length - 1}]: \${error.message}\`);\n  }\n  return missing.length;\n}\n\nasync function ensureQuizSetup`;

const next = s.replace(/async function ensureQuizBank\(db\) \{[\s\S]*?\n\}\n\nasync function ensureQuizSetup/, replacement);
if (next === s) throw new Error('ensureQuizBank anchor not found');
s = next;

s = s.replace('    await ensureQuizBank(db);', '    const seededQuizCount = await ensureQuizBank(db);');
s = s.replace('return Response.json({ ok: true, announcements, aiEntries, quizSeeds: QUIZ_SEEDS.length });', 'return Response.json({ ok: true, announcements, aiEntries, quizSeeds: QUIZ_SEEDS.length, seededQuizCount });');

fs.writeFileSync(path, s);
console.log('V38 quiz seed fix applied');
