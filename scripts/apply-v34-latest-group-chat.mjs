import fs from 'node:fs';

const path = 'app/page.js';
let s = fs.readFileSync(path, 'utf8');
const marker = '// V34: always load the newest group-chat messages';
if (s.includes(marker)) {
  console.log('V34 already applied');
  process.exit(0);
}

const oldBlock = `  async function loadMessages() {\n    const { data, error } = await supabase\n      .from("group_messages")\n      .select("*")\n      .eq("room_id", ROOM_ID)\n      .eq("is_deleted", false)\n      .order("created_at", { ascending: true })\n      .limit(200);\n\n    if (!error && data) {\n      setMessages(data);\n    }\n  }`;

const newBlock = `  async function loadMessages() {\n    ${marker}\n    // 200개가 넘는 방에서는 ascending + limit(200)이 가장 오래된 메시지만 가져와\n    // 방금 보낸 메시지가 화면에서 사라지는 문제가 생깁니다. 최신 200개를 가져온 뒤\n    // 화면 표시 순서만 오래된→최신으로 되돌립니다.\n    const { data, error } = await supabase\n      .from("group_messages")\n      .select("*")\n      .eq("room_id", ROOM_ID)\n      .eq("is_deleted", false)\n      .order("created_at", { ascending: false })\n      .limit(200);\n\n    if (!error && data) {\n      setMessages([...data].reverse());\n    }\n  }`;

if (!s.includes(oldBlock)) throw new Error('loadMessages anchor not found');
s = s.replace(oldBlock, newBlock);
fs.writeFileSync(path, s);
console.log('V34 applied');
