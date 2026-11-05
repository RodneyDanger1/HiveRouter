# CHAT-WAVE-1 — trace

## Inventory

| Surface | Control | Verdict | Evidence |
|---|---|---|---|
| Nav | `Chat` link | WIRED-AND-WORKS | `AppShell.tsx` NAV; live `/chat` route in E2E |
| Chat | New conversation (agent select + optional title) | WIRED-AND-WORKS | E2E creates a durable thread; API 201; thread appears |
| Chat | Thread list rows with preview/status/count | WIRED-AND-WORKS | `live-chat-final.png`; thread projection fields |
| Chat | Agent select for the next answer | WIRED-AND-WORKS | `ChatPage.tsx`; API validates agent IDs against registry |
| Chat | Message textarea + Send & queue job | WIRED-AND-WORKS | Live thread `chat_fb...` produced a completed answer and job |
| Chat | Pending/running assistant state | WIRED-AND-WORKS | `live-chat-message.png` (mid-run, queued 0/3) then succeeded; SSE refreshed |
| Chat | Cancel job | WIRED-AND-WORKS | Live thread `chat_ba2...` job `cjob_4882...` cancelled; sibling succeeded |
| Chat | Job fields disclosure | WIRED-AND-WORKS | `Job fields` visible on live final screenshot; API exposes all residual fields |
| Chat | Live badge / SSE | WIRED-AND-WORKS | `useChatStream` opens EventSource; `sse.json` has 8 ordered events |
| Chat | Error state | WIRED-AND-WORKS | `MessageCard` renders `errorCode`; live cancel proves failed message |

## Chain

```
web/src/pages/ChatPage.tsx
  -> web/src/api.ts (list/create/get/send/cancel)
  -> src/server/app.ts /api/chat/*
  -> src/server/chat/store.ts (tx, CAS, projections, reaper)
  -> src/server/chat/generate.ts (server-side provider + cycle budget)
  -> src/server/chat/worker.ts (claim, lease, timeout, retry)
  -> src/server/chat/events.ts (durable events)
  -> GET /api/chat/threads/:id/stream (SSE)
  -> useChatStream -> snapshot reload -> ChatPage render
```

## Evidence classes

- **VERIFIED** — `npm.cmd test -- --run`: 53 files / 330 tests; E2E 27/27; live `/api/chat` thread/job; SSE 8 events; DB audit 9 measured jobs; screenshots.
- **READ** — code paths and projection fields above; the UI does not compute state itself.
- **UNVERIFIED** — process-kill reaper (unit-tested only); multi-process claims; 390px chat page visual check; live provider failure/retry (unit-tested with `LlmError`).
- **Known benign console error** — `/favicon.ico` 404, no page errors.

## Residual

- Thread list capped at 100; no cursor/total.
- No child-thread delegation; fan-out jobs only.
- Worker is in-process; a distributed deployment would need a cross-process claim/reaper proof.
