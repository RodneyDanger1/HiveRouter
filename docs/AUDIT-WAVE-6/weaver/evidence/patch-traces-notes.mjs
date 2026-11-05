import fs from 'node:fs';
const p = 'docs/AUDIT-WAVE-6/weaver/traces.json';
let s = fs.readFileSync(p, 'utf8');
s = s.replace('run rows show as ? (F2)', 'run rows show as \u2014 (F2)')
  .replace('TIME always ?', 'TIME always \u2014')
  .replace('prior ? n=0', 'prior \u00b7 n=0')
  .replace('Tokens ?, Chars ?, Reason ?, Included', 'Tokens \u2014, Chars \u2014, Reason \u2014, Included');
JSON.parse(s);
fs.writeFileSync(p, s, 'utf8');
console.log('patched', (s.match(/\?/g) || []).length, 'question marks remain (URLs/optional syntax)');
