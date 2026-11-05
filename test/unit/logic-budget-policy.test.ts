import { describe, expect, it } from 'vitest';
import {
  BudgetPolicyError,
  BUDGET_REFUSAL_CODES,
  canAfford,
  commit,
  createBudget,
  release,
  remainingMicroUsd,
  reserve,
  snapshot,
} from '../../src/server/logic/budget-policy';

function expectRefusal(fn: () => unknown, code: string) {
  try {
    fn();
    throw new Error(`expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(BudgetPolicyError);
    expect((error as BudgetPolicyError).code).toBe(code);
  }
}

describe('LG4 budget-policy — accounting', () => {
  it('reserves, commits actual usage, and returns the unused remainder', () => {
    let state = createBudget(1_000_000);
    expect(remainingMicroUsd(state)).toBe(1_000_000);
    state = reserve(state, 'call-1', 300_000);
    expect(state.reservedMicroUsd).toBe(300_000);
    expect(canAfford(state, 700_000)).toBe(true);
    expect(canAfford(state, 700_001)).toBe(false);
    state = commit(state, 'call-1', 250_000);
    expect(state.committedMicroUsd).toBe(250_000);
    expect(state.reservedMicroUsd).toBe(0);
    expect(remainingMicroUsd(state)).toBe(750_000);
    expect(snapshot(state).unknownReservationIds).toEqual([]);
  });

  it('treats null actual cost as unknown, never as zero', () => {
    let state = createBudget(500_000);
    state = reserve(state, 'unknown-call', 200_000);
    const after = commit(state, 'unknown-call', null);
    expect(after.committedMicroUsd).toBe(200_000);
    expect(after.reservedMicroUsd).toBe(0);
    expect(remainingMicroUsd(after)).toBe(300_000);
    const snap = snapshot(after);
    expect(snap.unknownReservationIds).toEqual(['unknown-call']);
    expect(snap.remainingMicroUsd).toBe(300_000);
  });

  it('releases a reservation without spending it', () => {
    let state = createBudget(100_000);
    state = reserve(state, 'r1', 40_000);
    state = release(state, 'r1');
    expect(state.reservedMicroUsd).toBe(0);
    expect(state.committedMicroUsd).toBe(0);
    expect(remainingMicroUsd(state)).toBe(100_000);
    expect(state.reservations.r1.status).toBe('released');
  });

  it('enforces exact caps and micro-USD integer input', () => {
    let state = createBudget(10);
    state = reserve(state, 'exact', 10);
    expect(remainingMicroUsd(state)).toBe(0);
    expectRefusal(() => reserve(state, 'over', 1), 'E_BUDGET_EXCEEDED');
    expectRefusal(() => reserve(state, 'fraction', 0.5), 'E_BUDGET_INVALID_AMOUNT');
    expectRefusal(() => createBudget(-1), 'E_BUDGET_INVALID_AMOUNT');
    expectRefusal(() => canAfford(state, Number.NaN), 'E_BUDGET_INVALID_AMOUNT');
  });

  it('refuses duplicate reservations and unknown/committed reservation operations', () => {
    let state = createBudget(100);
    state = reserve(state, 'r1', 10);
    expectRefusal(() => reserve(state, 'r1', 10), 'E_BUDGET_DUPLICATE_RESERVATION');
    expectRefusal(() => commit(state, 'missing', 1), 'E_BUDGET_UNKNOWN_RESERVATION');
    const committed = commit(state, 'r1', 5);
    expectRefusal(() => commit(committed, 'r1', 5), 'E_BUDGET_UNKNOWN_RESERVATION');
    expectRefusal(() => release(committed, 'r1'), 'E_BUDGET_UNKNOWN_RESERVATION');
  });

  it('refuses overcommit and keeps state immutable', () => {
    const state = reserve(createBudget(100), 'r1', 10);
    expectRefusal(() => commit(state, 'r1', 11), 'E_BUDGET_OVERCOMMIT');
    expect(state.reservedMicroUsd).toBe(10);
    expect(state.reservations.r1.status).toBe('reserved');
  });

  it('allows a zero-cap budget only for zero-amount decisions', () => {
    const state = createBudget(0);
    expect(canAfford(state, 0)).toBe(true);
    expect(canAfford(state, 1)).toBe(false);
    expectRefusal(() => reserve(state, 'r', 1), 'E_BUDGET_EXCEEDED');
  });

  it('exposes refusal codes that the shared registry owns', () => {
    for (const code of BUDGET_REFUSAL_CODES) {
      expect(code).toMatch(/^E_BUDGET_/);
    }
  });
});
