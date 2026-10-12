import fs from 'node:fs';

const path = 'app/page.js';
let src = fs.readFileSync(path, 'utf8');

const importAnchor = 'import { supabase } from "./supabase";\n';
if (!src.includes(importAnchor)) throw new Error('import anchor not found');
if (!src.includes('from "./lib/ui-helpers"')) {
  src = src.replace(importAnchor, importAnchor + 'import { AVATAR_CATALOG, avatarSrc, normalizePasswordInput } from "./lib/ui-helpers";\n');
}

const start = src.indexOf('const AVATAR_CATALOG = [');
const endMarker = '\n\nexport default function Home() {';
const end = src.indexOf(endMarker);
if (start === -1) throw new Error('avatar helper block start not found');
if (end === -1 || end <= start) throw new Error('Home function anchor not found');

src = src.slice(0, start) + src.slice(end + 2);
fs.writeFileSync(path, src);
console.log('P1-1 helper extraction applied');
