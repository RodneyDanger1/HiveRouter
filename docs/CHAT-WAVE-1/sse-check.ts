import { chromium } from '@playwright/test';
import fs from 'node:fs';

const base = 'http://127.0.0.1:8787';
const threads = await (await fetch(`${base}/api/chat/threads?limit=100`)).json();
const completed = threads.threads.find((thread: { title: string; lastJobStatus: string | null }) => thread.title === 'Live chat proof' && thread.lastJobStatus === 'succeeded');
if (!completed) throw new Error('live proof thread missing');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(`${base}/chat`);
const result = await page.evaluate(
  async ({ threadId }) =>
    await new Promise((resolve) => {
      const events: Array<{ seq: number; type: string }> = [];
      const source = new EventSource(`/api/chat/threads/${threadId}/stream`);
      const timer = setTimeout(() => {
        source.close();
        resolve({ status: 'timeout', events });
      }, 5000);
      source.onmessage = (event) => {
        const data = JSON.parse(event.data) as { seq: number; type: string };
        events.push({ seq: data.seq, type: data.type });
        if (events.length >= 8) {
          clearTimeout(timer);
          source.close();
          resolve({ status: 'ok', events });
        }
      };
      source.onerror = () => {
        clearTimeout(timer);
        source.close();
        resolve({ status: 'error', events });
      };
    }),
  { threadId: completed.id },
);
fs.writeFileSync('docs/CHAT-WAVE-1/sse.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
