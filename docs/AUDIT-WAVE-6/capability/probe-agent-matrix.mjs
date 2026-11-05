// W6-AUD-04 capability auditor — derive the 37-agent capability matrix from code.
import { REGISTRY } from '../../../src/server/agents/registry.ts';

const HARD_CODED = {
  architect: 'full-build planning (run.ts:470-471)',
  cleaner: 'cleaning (run.ts:726-727) + revise/audit (run.ts:296-297)',
  sentinel: 'hardening (run.ts:737-738) + revise/audit (run.ts:306-307)',
  watchman: 'repair loop (run.ts:827-828)',
  gatekeeper: 'testing (run.ts:752-753) + audit tests (run.ts:318-319)',
};

const rows = REGISTRY.map((a) => {
  const routable = a.outputKind === 'files' && a.canWrite;
  const hard = HARD_CODED[a.id];
  let paths;
  if (routable) paths = 'routed generation (ccr eligibility) + adhoc';
  else if (hard) paths = `${hard} + adhoc`;
  else if (a.outputKind === 'plan') paths = 'adhoc only';
  else if (a.outputKind === 'text') paths = 'adhoc only (callAgentText)';
  else paths = 'adhoc only';
  return {
    id: a.id,
    group: a.group,
    outputKind: a.outputKind,
    canWrite: a.canWrite,
    canReview: a.canReview,
    canTest: a.canTest,
    schemaId: a.schemaId,
    verificationSupport: a.verificationSupport,
    languages: a.languages.join('/') || '—',
    routable,
    paths,
  };
});

const md = [
  '| # | Agent | Group | Output | W/R/T | Schema | Routable | Invocation path(s) |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map((r, i) => `| ${i + 1} | \`${r.id}\` | ${r.group} | ${r.outputKind} | ${[r.canWrite ? 'W' : '', r.canReview ? 'R' : '', r.canTest ? 'T' : ''].filter(Boolean).join('/') || '—'} | ${r.schemaId} | ${r.routable ? 'yes' : 'no'} | ${r.paths} |`),
].join('\n');

console.log(md);
console.log('');
console.log(JSON.stringify({
  total: rows.length,
  routable: rows.filter((r) => r.routable).length,
  byOutput: rows.reduce((acc, r) => { acc[r.outputKind] = (acc[r.outputKind] ?? 0) + 1; return acc; }, {}),
  byVerification: rows.reduce((acc, r) => { acc[r.verificationSupport] = (acc[r.verificationSupport] ?? 0) + 1; return acc; }, {}),


}, null, 2));
