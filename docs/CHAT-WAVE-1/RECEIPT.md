# CHAT-WAVE-1 — receipt

**Goal:** add the missing live-chat projection, a real durable agent-job worker/reaper, and the residual projection fields to HiveRouter B2 — without mocks, fake success, or provider-key exposure.

**Outcome:** implemented and live-proven. One owner conversation can fan a message out to 1–3 registered agents; each answer is a durable leased job; the UI projects queued/running/succeeded/failed state, errors, attempts, lease/availability, measured cost/tokens, and a cancel control.

## Product files

| File | SHA-256 |
|---|---|
| `src/server/chat/events.ts` | `C31622ECFD252B0C44B435C10449920E63FC1CCD1592239741DC58002CF228E1` |
| `src/server/chat/store.ts` | `CB32E92152346C167460F4EB84B37D02B1FF6B004476EB812A6A6BC87559146D` |
| `src/server/chat/generate.ts` | `838765715E8FE747CFEA363D5F076232ED110AAA2FD0E8FF9026AFDF77D67D00` |
| `src/server/chat/worker.ts` | `5B52A49BBA817A89C29CE678D2A92EC0F327AF8FA57E74DB78A5BADB00B25D5B` |
| `src/shared/chat.ts` | `9B7141F2D4E3A7091FB8FFE52832E549DB9A8CCCAE8D1C44D9EFC0F21BF9A9D5` |
| `src/server/db/migrations.ts` | `1731C8C5FF4521833C379EE1227095CA61ED56B310673BA4E1CB404DF4446B36` |
| `src/server/db/database.ts` | `B8F0FA11F598CBC71A63F0C8D5BDD5B1C510DEF8148E50FD66A4E03FC20F54D6` |
| `src/server/config.ts` | `4E894EECB71D356E933DE38CBEFC390B0D9DE2493C9A0B331C015DB03A58A853` |
| `src/shared/features.ts` | `33EC2E4673277527285AE4527C28CAE34D48281ED8AE4565E95D417B9FCBEC85` |
| `src/shared/refusals.ts` | `ED7AB0C2CA1ABF7B94AD0B8D3A67C2B8D94EB64A128488202AA4D0D2D277148F` |
| `src/server/app.ts` | `D95CB33356C0B12BC571A0473DE54D82ED0C48C71C0E54691A4517BF1A668C6E` |
| `src/server/index.ts` | `00716866F5E5062CBA5DF86D1CC733D61A3A772928197EDD9841C49F6B706051` |
| `web/src/pages/ChatPage.tsx` | `08610940E7B1F7DCE05004FF78124F01FF557CD4124BE8DCB6C7D9ABC3AE4FB0` |
| `web/src/hooks/useChatStream.ts` | `F8C430F45D98BAB16EC71CEA26843E81FA1E159A611C49FDAA8FE5CF18A69AAD` |
| `web/src/App.tsx` | `E9C8C03407580449046631763E175E2375322599D1A1B96ACDEFF911FB27009C` |
| `web/src/components/AppShell.tsx` | `60712CEA1B0112A21B56D1481BF3BBC709460E111B1FF679A9DEC32AA86F96BC` |
| `web/src/api.ts` | `86D1EF029C325B13DFCB50D199CD778BFA64830367821A094DE6424CBB7B2182` |
| `web/src/api-types.ts` | `1D52FB76FFBCD86CFB7A79FB8E6BA1C5127E581C23B3254F35EA55D58D874093` |
| `web/src/styles.css` | `9484A60CD4B6E224D9C7281F253FCF82AB183CAFBC11D635FC61C6E9EC81722B` |
| `test/unit/chat-store.test.ts` | `FAEED879E9EF64404E38F02C75E186E86892630CAB368FA53C17916E7AA40B1D` |
| `test/unit/chat-worker.test.ts` | `CC1DED6D7B846E318057A18563ADC66386D2ED1C988CFAE95CC2ACBDD048266E` |
| `e2e/chat.spec.ts` | `7D379A9DBA2993AD561DF3A7A0835E7F32D6E83C74EBBA729B1BC1E4C19962EB` |
| `config/releases/p7.json` | `565DBFE1CC20A12FA69F0753D954EF46DAE5814D26C59C3302374B5B57BBF040` |

Docs: `docs/CHAT-WAVE-1/{PLAN.md, live-chat.md? no, live-chat.json, live-chat.png, live-chat-final.png, live-chat-message.png, sse.json, preflight.json, verify.out.txt}`.

## Design decisions

- **Fan-out, not merged child threads:** one user message creates one pending assistant message and one queued job per selected agent (max 3). This preserves every answer's own job identity and cancellation/error state; no fake delegation or shared-thread merge.
- **In-process, single-owner worker:** a real leased consumer started by the server; it claims with a transaction, leases 120 s, times out below the lease, and reaps expired leases at startup and every tick. Multi-process claim semantics are not claimed.
- **Durable SSE projection:** `chat_events` rows are written in the same transaction as state; the SSE route replays the durable window and uses `Last-Event-ID` for reconnect.
- **Budget:** cycle-scope reservations via the existing ledger; the provider key stays server-side.
- **Residual fields:** thread `lastMessagePreview/lastJobStatus/pending/queued/running/failed/succeeded/messageCount`; message `errorCode/errorMessage/jobId/jobStatus/jobAttempts/jobMaxAttempts/jobAvailableAt/jobLeaseExpiresAt/jobLastError*/jobCostUsd`; job full status/attempt/lease/error/usage/timestamps.

## Verification

| Gate | Evidence |
|---|---|
| Typecheck | PASS |
| Full unit | **53 files / 330 tests passed** |
| Build | PASS |
| E2E | **27/27 passed** |
| Strict stage | **173 files / 49 tables / 55 routes / 24 scripts**, violations `[]` |
| `verify` | exit 0; stub-sweep clean (93), secret-scan clean (171) |
| Preflight | exit 0 (`docs/CHAT-WAVE-1/preflight.json`) |
| Live chat | Thread `chat_fb07f8c115b881e417`; architect answer `complete`; job `cjob_6a84290dc4c1888f22` succeeded with measured `$0.00009375`, 529 prompt / 24 completion tokens. |
| Live cancel | Thread `chat_ba2df5d07d3a30578c`; job `cjob_4882d4425be41f2275` cancelled; assistant message failed `E_CHAT_JOB_CANCELLED`; sibling job succeeded. |
| SSE | 8 ordered events (thread.updated, message.created, job.queued, job.started, message.completed, job.succeeded) under `sse.json`. |
| UI | `/chat` final screenshot `live-chat-final.png`; live badge, succeeded job, `succeeded · attempt 1/3`, `Job fields` visible. |
| Data truth | 9 succeeded jobs measured `$0.0007362` / 4,720 prompt / 47 completion; 1 cancelled job has NULL cost (not 0); 73 events; 12 threads. |

## Tests that prove the hard paths

- `chat-store.test.ts` (8): atomic fan-out, idempotent replay, claim/CAS, measured success, queued cancel, expired-lease requeue, exhausted terminal, cancellation-requested terminal.
- `chat-worker.test.ts` (5): real success, retryable requeue then `E_CHAT_JOB_EXHAUSTED`, deterministic first-attempt failure, running cancellation, empty queue.
- `e2e/chat.spec.ts` (1): real `/chat` thread creation and projected empty state.

No existing test was weakened or removed. No test double exists in `src/`; the fake generator is confined to `test/unit/chat-worker.test.ts` and is explicitly a test double.

## Not done / residual

- **Multi-process worker claims**: the queue is durable and lease-safe within one HiveRouter process. A distributed/multi-process claim test is not implemented.
- **Child-thread delegation/merged parent-child conversation**: not implemented; this design fans multiple independent agent jobs into one thread.
- **Live process-kill reaper test**: reaper behavior is unit-tested against expired leases; a real `kill -9` and restart was not performed.
- **Pagination**: thread list is capped at 100; no total/cursor.
- **P7 learning promotion**: unchanged; no promotion claimed.
- **Generated-code execution**: none.

## Final state

Server healthy B2; no active run; chat worker running; 12 threads / 10 jobs (9 succeeded, 1 cancelled); desktop window 1440×780; no provider key in the browser.
