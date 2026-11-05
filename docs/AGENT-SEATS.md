# HiveRouter agent seats

This is the operational contract for implementation waves. It is not a runtime agent registry.

## Ownership

- **Lead/integrator:** owns `src/server/app.ts`, `src/server/index.ts`, `web/src/App.tsx`, `web/src/components/AppShell.tsx`, release manifests, final server restart, and the final integrated gate. Only one writer per shared file.
- **Forge-safety:** owns `verify/syntax.ts`, `agents/prompts.ts`, `config.ts`, `shared/features.ts`, security boundary files. RED test before edit.
- **Forge-core:** owns `pipeline/run.ts`, `pipeline/agent-runner.ts`, `runs/**`, `logic/**`, `verify/**`.
- **Forge-learning:** owns `src/server/learning/**` only. Must not claim a live evaluation/promotion without data.
- **Forge-ui:** owns `web/**` only. Every control must call a real route; no dead buttons.
- **Auditor:** read-only. Reproduces P0 defects, checks claims, gate XML, territory, and skipped tests. Does not edit product files.

## Rules

1. No generated-code execution, no arbitrary shell, no Docker required.
2. No external code installation/vendoring without license, commit, path, and security review.
3. No paid provider call without explicit owner approval.
4. No test weakening, no skipped/xfailed test added to pass a gate.
5. No historical backfill or synthetic P7 data.
6. No write outside the seat's scope; coordinate shared files through the Lead.
7. Write an interim report within 20 minutes; two identical failing probes stop the seat.
8. Evidence format: command + observed output, file path + lines. “Should work” is unverified.
9. A claim is VERIFIED, READ, INFERRED, or UNVERIFIED; never blur them.

## Stop conditions

- Phase guard rejects a legitimate writer → amend matrix/test; do not weaken the transition.
- Review gate blocks a clean run → verify finding grounding before changing gate.
- P7 data/consent absent → refuse; never synthesize.
- External code license/behavior uncertain → mechanism only or reject.
- Typecheck/tests cannot be run → report unverified; do not call the change done.
