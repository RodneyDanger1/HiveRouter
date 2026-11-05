# Provenance

HiveRouter contains no vendored third-party source as of this change set.

The external repository survey is recorded in `docs/EXTERNAL-RESEARCH.md`. Where a repository influenced the design, only the mechanism was reimplemented in TypeScript:

- review coverage/gate: open-code-review, eve, attractor;
- staged-artifact retention/checkpoint: fabro/eve/storm concepts;
- prompt/tool-loop concepts: OpenHands, OpenManus, Qwen-Agent, agentscope;
- repo/context/compaction concepts: codegraph, headroom, deer-flow, Aider;
- trace/score concepts: langfuse;
- grounded findings: langextract;
- metrics: E-CommerceBench, ConsisEval, Self-Lengthen;
- dominator/scorecard modules: independent implementation guided by the survey.

No AGPL/All-Rights-Reserved/no-license source was copied. Any future vendoring must record repo, commit, path, license, modifications, and a security review here before merge.

Generated artifacts and benchmark data are not third-party source and are not represented as such.
