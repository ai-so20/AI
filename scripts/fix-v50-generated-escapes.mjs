import fs from 'node:fs';
const path = 'app/page.js';
let page = fs.readFileSync(path,'utf8');
page = page.replaceAll('\\`','`').replaceAll('\\${','${');
fs.writeFileSync(path,page);
console.log('V50 generated JSX escapes normalized');
