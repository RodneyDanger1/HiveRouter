# External research and adoption register

Read-only survey, 2026-11-04. No third-party code was vendored. Licenses are recorded, but this is not legal advice.

## Sources actually inspected

| Repo | License | Reuse verdict |
|---|---|---|
| alibaba/open-code-review | Apache-2.0 | review coverage/filter/SARIF concepts |
| colbymchenry/codegraph | MIT | repo graph/context concepts; Node engine `<25` conflicts with HiveRouter 26.7 |
| headroomlabs-ai/headroom | Apache-2.0 | masks/CCR/prefix concepts; Python; pyproject documents a compromised `ast-grep-cli` release |
| bytedance/deer-flow | MIT | compaction/checkpoint concepts |
| vercel-labs/eve-software-factory-template | MIT | evidence/approval concepts |
| strongdm/attractor | reference/spec | loop/DoD concepts |
| fabro-sh/fabro | no root LICENSE found | gate/checkpoint concepts only; no code |
| dzhng/skills | MIT | skill discovery/dry-run concepts |
| pi-hermes-memory | MIT | memory/decay/correction concepts; peer deps Pi |
| QwenLM/Qwen-Agent | Apache-2.0 | tool registry/call-budget concepts |
| agentscope-ai/agentscope | Apache-2.0 | permissions/tool-loop concepts |
| google/langextract | Apache-2.0 | grounded alignment concepts |
| langfuse/langfuse | MIT outside `ee/` | trace/score concepts |
| QwenLM/E-CommerceBench | Apache-2.0 | metric vocabulary |
| QwenLM/ConsisEval | see repo | consistency arithmetic concept |
| QwenLM/RationaleRM | see repo | metric concept; committed script broken |
| QwenLM/Self-Lengthen | see repo | partial-credit concept |
| QwenLM/AutoIF | see repo | cross-validation concept, but executes generated code |
| QwenLM/open-computer-use | MIT | out of contract |
| QwenLM/Qwen3-TTS | Apache-2.0 | out of contract |
| QwenLM/WebWorld | no license file found | reject |
| QwenLM/qwen-code-examples | no license file found | reject |
| calesthio/OpenMontage | AGPL-3.0 | concepts only; no code |
| anthropics/claude-code | All rights reserved / no root source | no code |
| AOSSIE-Org/CodingAgent | no implementation source found | reject |
| AOSSIE-Org/PythonScripts | NOASSERTION; mutating star script | reject |
| jimmysuncpt/Algorithms | no declared license | algorithm concepts only |
| cammypeterson/Multi-Agent-Systems-Algorithms | no declared license | CBBA concept only |
| CHSZLab/AgenticAlgorithmEngineering | license body unread | keep/discard concept |
| jpbat/SearchAlgorithms | no license; toy | reject |
| trekhleb/javascript-algorithms | MIT | algorithm cross-check |
| langflow-ai/langflow | MIT | graph/event concepts |
| langgenius/dify | restrictive Dify license | concepts only |
| stanford-oval/storm | MIT | checkpoint concepts |
| OpenHands/software-agent-sdk | MIT | tool/workspace/event concepts |
| FoundationAgents/OpenManus | MIT | tool-loop concepts; its Python executor is unsafe to copy |
| SWE-agent/SWE-agent | MIT | ACI/trajectory/Docker concepts |
| Aider-AI/aider | Apache-2.0 | repo map/edit concepts |

## Safety findings

- No malicious behavior was found in the inspected files. This is not a full audit.
- `headroom` documents a compromised dependency release; never install it into HiveRouter.
- `codegraph` declares Node `<25` and has a `preuninstall` hook; do not vendor.
- `qwen-code-examples` contains shell execution and generated-HTML preview; reject code.
- `AutoIF` executes model-written Python; reject code.
- `AOSSIE PythonScripts` mutates GitHub with no dry-run; reject.
- `OpenMontage` is AGPL; patterns only.
- `claude-code` has no product source and is all-rights-reserved.

## Adopted into this tree

- Non-executing SQL shape check (replaces SQLite execution).
- Review findings now persist; critical findings (including ungrounded critical) fail the gate; non-critical ungrounded findings are `REVIEW_UNGROUNDED_WARNING`.
- Retained staged artifacts with explicit status.
- Prompt envelopes for untrusted brief/file/review content.
- Required stage and honest unknown-usage stats.
- Pure dominator/scorecard modules (not yet wired to a product route).
- Local research reports only; no upstream code imported.

## Not adopted

Computer use, TTS/video, browser automation, arbitrary shell, generated-code execution, full framework installation, MCP runtime, multi-user/cloud, synthetic P7 data, auto-promotion.
