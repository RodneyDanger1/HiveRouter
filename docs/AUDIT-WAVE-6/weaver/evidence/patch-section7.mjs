import fs from 'node:fs';
const p = 'docs/AUDIT-WAVE-6/weaver/findings.md';
let s = fs.readFileSync(p, 'utf8');
const oldText = 'A 7-step snapshot therefore existed only between ~03:09:53 and ~03:10:14 — six minutes before terminal. Screenshot/document timestamps are consistent with a capture taken then.';
const newText = 'A 7-step snapshot could only exist from step #7 start (`03:09:33.029Z`) until step #8 start (`03:09:52.479Z`), i.e. more than six minutes before the `03:15:46.742Z` terminal write; a 5-second poll lag extends the visible window by at most 5 s. The capture is therefore consistent with a mid-run screenshot, not with a terminal page stuck on an old state.';
if (!s.includes(oldText)) {
  console.error('pattern not found');
  process.exit(1);
}
s = s.replace(oldText, newText);
fs.writeFileSync(p, s, 'utf8');
console.log('patched', s.includes('03:09:33.029Z'));
