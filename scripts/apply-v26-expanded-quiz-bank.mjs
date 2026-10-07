import fs from "node:fs";

const path = "app/api/event-runtime/route.js";
let src = fs.readFileSync(path, "utf8");

if (!src.includes('import { EXPANDED_QUIZ_SEEDS } from "../../lib/event-quiz-bank";')) {
  src = src.replace(
    'import { createClient } from "@supabase/supabase-js";\n',
    'import { createClient } from "@supabase/supabase-js";\nimport { EXPANDED_QUIZ_SEEDS } from "../../lib/event-quiz-bank";\n'
  );
}

if (src.includes("const QUIZ_SEEDS = [")) {
  src = src.replace("const QUIZ_SEEDS = [", "const BASE_QUIZ_SEEDS = [");
  src = src.replace(
    "];\n\nfunction dbClient() {",
    "];\n\nconst QUIZ_SEEDS = [...BASE_QUIZ_SEEDS, ...EXPANDED_QUIZ_SEEDS];\n\nfunction dbClient() {"
  );
}

src = src.replace(
  '  const questions = QUIZ_SEEDS.map((q) => q[0]);\n  const { data: existing } = await db.from("event_quiz_bank").select("question").in("question", questions);\n  const have = new Set((existing || []).map((row) => row.question));',
  '  const { data: existing } = await db.from("event_quiz_bank").select("question").limit(1000);\n  const have = new Set((existing || []).map((row) => row.question));'
);

src = src.replace('.eq("active", true).limit(200);', '.eq("active", true).limit(1000);');

fs.writeFileSync(path, src);
console.log(`V26 quiz bank wired: ${path}`);
