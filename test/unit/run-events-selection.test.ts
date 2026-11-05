import { describe, expect, it } from 'vitest';
import { selectVisibleEvents, type MappedRunEvent } from '../../src/shared/run-events.js';

function rows(count: number): MappedRunEvent[] {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'phase.started',
    data: { index },
    receivedAt: `2026-11-04T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
  }));
}

describe('AF-03 Events tab selection', () => {
  it('terminal=true, live=100, persisted=108 -> the 108-row ledger', () => {
    const live = rows(100);
    const persisted = rows(108);
    const visible = selectVisibleEvents({ terminal: true, live, persisted });
    expect(visible).toHaveLength(108);
    expect(visible).toBe(persisted);
  });

  it('terminal=true, live=100, persisted=0 -> the honest empty ledger', () => {
    const live = rows(100);
    const persisted: MappedRunEvent[] = [];
    const visible = selectVisibleEvents({ terminal: true, live, persisted });
    expect(visible).toHaveLength(0);
    expect(visible).toBe(persisted);
  });

  it('terminal=false, live=100, persisted=108 -> the live buffer (persisted is not fetched yet)', () => {
    const live = rows(100);
    const persisted = rows(108);
    const visible = selectVisibleEvents({ terminal: false, live, persisted });
    expect(visible).toHaveLength(100);
    expect(visible).toBe(live);
  });

  it('terminal=false, live=0, persisted=0 -> empty', () => {
    const live: MappedRunEvent[] = [];
    const persisted: MappedRunEvent[] = [];
    expect(selectVisibleEvents({ terminal: false, live, persisted })).toBe(live);
    expect(selectVisibleEvents({ terminal: false, live, persisted })).toHaveLength(0);
  });

  it('does not mutate either input array', () => {
    const live = rows(3);
    const persisted = rows(5);
    const liveSnapshot = JSON.parse(JSON.stringify(live)) as unknown;
    const persistedSnapshot = JSON.parse(JSON.stringify(persisted)) as unknown;
    selectVisibleEvents({ terminal: true, live, persisted });
    selectVisibleEvents({ terminal: false, live, persisted });
    expect(JSON.parse(JSON.stringify(live))).toEqual(liveSnapshot);
    expect(JSON.parse(JSON.stringify(persisted))).toEqual(persistedSnapshot);
  });
});
