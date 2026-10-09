import fs from 'node:fs';
const path = 'app/page.js';
let page = fs.readFileSync(path,'utf8');
page = page.replaceAll('\\`','`').replaceAll('\\${','${');
page = page.replace('\n                        {profile?.role === "admin" ? (','\n                        profile?.role === "admin" ? (');
page = page.replace('\n                        )}\n                      ))}','\n                        )\n                      ))}');
fs.writeFileSync(path,page);
console.log('V50 generated JSX normalized');
