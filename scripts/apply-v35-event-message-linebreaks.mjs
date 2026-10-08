import fs from 'node:fs';

const path = 'app/page.js';
let s = fs.readFileSync(path, 'utf8');
const marker = '/* V35 preserve chat line breaks */';
if (s.includes(marker)) {
  console.log('V35 already applied');
  process.exit(0);
}

const oldLine = '<div style={{...styles.refBubble,...(mine?styles.refMyBubble:styles.refOtherBubble)}}>';
const newLine = `<div style={{...styles.refBubble,...(mine?styles.refMyBubble:styles.refOtherBubble),whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>${marker}`;
if (!s.includes(oldLine)) throw new Error('group bubble anchor not found');
s = s.replace(oldLine, newLine);

fs.writeFileSync(path, s);
console.log('V35 applied');
