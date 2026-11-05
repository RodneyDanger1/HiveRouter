# HiveRouter — repository agent instructions

Read `docs/PLAN-v3.md` first. It is the authoritative contract. This file is a short operational reminder.

1. **Stack lock:** TypeScript, Node 26.7, Fastify 5, React 19, Vite 8, Tailwind 4, `node:sqlite`, direct DeepSeek Chat Completions. No Next.js, Electron, Python backend, OpenAI SDK, or DSH runtime dependency.
2. **No fake code:** no TODO/FIXME/stub/mock in `src/`. Test doubles live only in `test/` and `e2e/`. Never fabricate a gate, promotion, or metric.
3. **No secret exposure:** never print, log, commit, or send the DeepSeek key to the browser. Key sources are env/.env.local and `data/secrets/deepseek.json`; DSH is not read at runtime. Redact every sink.
4. **No generated-code execution:** verification is static. No shell tool; no auto-promotion; no auto-apply.
5. **Windows:** use `npm.cmd` or `cmd /c npm`; `npm.ps1` is blocked by execution policy. Do not change execution policy.
6. **Stage lock:** A/B1/B2 phases; P6a/P7 code is not part of Release A. The merged working tree is B2; `assert-stage --stage=p7` is the current gate.
7. **Gates:** `npm.cmd run verify`, `npm.cmd run e2e`, `npm.cmd run assert-stage -- --stage=p7 --json`, `npm.cmd run preflight -- --port 0 --json`, `npm.cmd run test:live -- --yes`. Quote command + observed output.
8. **Definition of done:** a change is done only when it runs, the output was checked against acceptance, the evidence is quoted, and the failure path was exercised. Unverified is a valid report entry.
9. **P7:** the learning loop is implemented but this build has no sealed 390-case pool/consent, so it must report `E_LEARNING_POOL_EXHAUSTED`/refused. Do not claim a live learning promotion.

## AI agent operating plan

The durable agent plan is `docs/AGENT-OPERATING-PLAN.md`. Read it before choosing work, then read `docs/PLAN-v3.md` §0, §3, §4, §6, §10, §11, §13, `docs/BACKLOG.md`, and the latest `docs/TRACE/**/TRACE-SUMMARY.md` again.

- **Current wave:** Wave 12, backlog P0-3 — enforce the per-file byte bound at the agent output-schema boundary, before persistence, with a bounded typed refusal; keep the existing write-time guard as defense in depth. No router data-model or UI changes.
- **Skill routing:** use `forgewright-recon` before edits; `logic-gatekeeper` Phase 1 before every mutation; `logic-debugger` for state/error/retry invariants; `forge` for RED→GREEN; `forgewright-lead` for the final integration and gates; `capability-auditor` for registry/prompt parity; `agent-experience` for UI truth; `agent-learning-loop` only for L0/L1/L2 claims and never weight-learning claims; `agent-native-design` for CLI/API affordances; `integration-logic` for client→route→store seams; `research` when a fact is unknown; `evidence-check` before delivery.
- **No scope drift:** do not implement approval, repo tools, the tool loop, P7 evaluation, checkpoints, or parallel generation in this wave. They stay in `docs/BACKLOG.md`.
- **Evidence rule:** every claim in the final report names a command/output, file:line, or captured HTTP/DB result. A passing test on another path is not evidence.
