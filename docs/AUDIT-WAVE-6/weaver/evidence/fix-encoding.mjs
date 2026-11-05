import fs from 'node:fs';
const p = 'docs/AUDIT-WAVE-6/weaver/findings.md';
let s = fs.readFileSync(p, 'utf8');
const rev = new Map(Object.entries({0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F}).map(([k,v])=>[Number(k),v]));
function undoOnce(text) {
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (rev.has(cp)) bytes.push(rev.get(cp));
    else if (cp <= 0xFF) bytes.push(cp);
    else return null;
  }
  return Buffer.from(bytes).toString('utf8');
}
let passes = 0;
for (let i = 0; i < 4; i += 1) {
  const next = undoOnce(s);
  if (!next || next === s) break;
  s = next;
  passes += 1;
}
const before = fs.readFileSync(p, 'utf8').length;
fs.writeFileSync(p, s, 'utf8');
console.log({ passes, before, after: s.length, hasMojibake: /Ã|â€|Â·|Ã—/.test(s) });
console.log(s.split('\n').slice(0, 8).join('\n'));
