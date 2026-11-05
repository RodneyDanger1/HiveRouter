import { z } from 'zod';
import type { RefusalCode } from '../../shared/refusals';

/**
 * LG4 — pure micro-USD budget policy.
 *
 * This module owns accounting decisions only. Pricing, provider usage, SQLite
 * transactions, and leases belong to the ledger service that persists the
 * returned state. Amounts are integer micro-USD. A null actual cost means
 * "unknown" and is never coerced to zero.
 */

export const MicroUsdSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const ReservationStatusSchema = z.enum(['reserved', 'committed', 'released']);
export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;

export const BudgetReservationSchema = z.object({
  id: z.string().min(1).max(200),
  amountMicroUsd: MicroUsdSchema,
  status: ReservationStatusSchema,
  actualMicroUsd: MicroUsdSchema.nullable(),
  unknown: z.boolean(),
});
export type BudgetReservation = z.infer<typeof BudgetReservationSchema>;

export const BudgetStateSchema = z.object({
  capMicroUsd: MicroUsdSchema,
  reservedMicroUsd: MicroUsdSchema,
  committedMicroUsd: MicroUsdSchema,
  reservations: z.record(z.string(), BudgetReservationSchema),
});
export type BudgetState = z.infer<typeof BudgetStateSchema>;

export const BudgetSnapshotSchema = z.object({
  capMicroUsd: MicroUsdSchema,
  reservedMicroUsd: MicroUsdSchema,
  committedMicroUsd: MicroUsdSchema,
  remainingMicroUsd: z.number().int(),
  unknownReservationIds: z.array(z.string()),
  reservationCount: z.number().int().min(0),
});
export type BudgetSnapshot = z.infer<typeof BudgetSnapshotSchema>;

export type BudgetRefusalCode =
  | 'E_BUDGET_EXCEEDED'
  | 'E_BUDGET_UNKNOWN_RESERVATION'
  | 'E_BUDGET_DUPLICATE_RESERVATION'
  | 'E_BUDGET_INVALID_AMOUNT'
  | 'E_BUDGET_OVERCOMMIT';

export class BudgetPolicyError extends Error {
  readonly code: BudgetRefusalCode;
  readonly details: Record<string, unknown>;

  constructor(code: BudgetRefusalCode, message: string, details: Record<string, unknown> = {}) {
    super(`${code}: ${message}`);
    this.name = 'BudgetPolicyError';
    this.code = code;
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return { code: this.code, message: this.message, details: this.details };
  }
}

function parseAmount(value: unknown, field: string): number {
  const parsed = MicroUsdSchema.safeParse(value);
  if (!parsed.success) {
    throw new BudgetPolicyError(
      'E_BUDGET_INVALID_AMOUNT',
      `${field} must be a non-negative integer micro-USD amount`,
      { field, value: typeof value === 'number' ? value : typeof value },
    );
  }
  return parsed.data;
}

function parseState(state: BudgetState): BudgetState {
  const parsed = BudgetStateSchema.safeParse(state);
  if (!parsed.success) {
    throw new BudgetPolicyError('E_BUDGET_INVALID_AMOUNT', 'invalid budget state', {
      issues: parsed.error.issues.map((i) => i.message),
    });
  }
  let reserved = 0;
  let committed = 0;
  for (const reservation of Object.values(parsed.data.reservations)) {
    if (reservation.status === 'reserved') reserved += reservation.amountMicroUsd;
    if (reservation.status === 'committed') {
      committed += reservation.actualMicroUsd ?? reservation.amountMicroUsd;
    }
  }
  if (reserved !== parsed.data.reservedMicroUsd || committed !== parsed.data.committedMicroUsd) {
    throw new BudgetPolicyError('E_BUDGET_INVALID_AMOUNT', 'budget totals do not match reservations', {
      expectedReserved: reserved,
      storedReserved: parsed.data.reservedMicroUsd,
      expectedCommitted: committed,
      storedCommitted: parsed.data.committedMicroUsd,
    });
  }
  return parsed.data;
}

export function createBudget(capMicroUsd: number): BudgetState {
  const cap = parseAmount(capMicroUsd, 'capMicroUsd');
  return { capMicroUsd: cap, reservedMicroUsd: 0, committedMicroUsd: 0, reservations: {} };
}

export function remainingMicroUsd(state: BudgetState): number {
  const parsed = parseState(state);
  return parsed.capMicroUsd - parsed.reservedMicroUsd - parsed.committedMicroUsd;
}

export function canAfford(state: BudgetState, amountMicroUsd: number): boolean {
  const amount = parseAmount(amountMicroUsd, 'amountMicroUsd');
  return remainingMicroUsd(state) >= amount;
}

export function reserve(
  state: BudgetState,
  reservationId: string,
  amountMicroUsd: number,
): BudgetState {
  const parsed = parseState(state);
  const id = z.string().min(1).max(200).parse(reservationId);
  const amount = parseAmount(amountMicroUsd, 'amountMicroUsd');
  if (Object.prototype.hasOwnProperty.call(parsed.reservations, id)) {
    throw new BudgetPolicyError(
      'E_BUDGET_DUPLICATE_RESERVATION',
      `reservation ${id} already exists`,
      { reservationId: id },
    );
  }
  const remaining = parsed.capMicroUsd - parsed.reservedMicroUsd - parsed.committedMicroUsd;
  if (amount > remaining) {
    throw new BudgetPolicyError(
      'E_BUDGET_EXCEEDED',
      `reservation ${id} requires ${amount} micro-USD but only ${remaining} remains`,
      { reservationId: id, requestedMicroUsd: amount, remainingMicroUsd: remaining },
    );
  }
  return BudgetStateSchema.parse({
    ...parsed,
    reservedMicroUsd: parsed.reservedMicroUsd + amount,
    reservations: {
      ...parsed.reservations,
      [id]: {
        id,
        amountMicroUsd: amount,
        status: 'reserved',
        actualMicroUsd: null,
        unknown: false,
      },
    },
  });
}

/**
 * Commit a reservation. `actualMicroUsd === null` means the provider did not
 * report usage: hold the reserved amount and mark it unknown, not zero.
 */
export function commit(
  state: BudgetState,
  reservationId: string,
  actualMicroUsd: number | null,
): BudgetState {
  const parsed = parseState(state);
  const existing = parsed.reservations[reservationId];
  if (!existing || existing.status !== 'reserved') {
    throw new BudgetPolicyError(
      'E_BUDGET_UNKNOWN_RESERVATION',
      `reservation ${reservationId} is missing or not reserved`,
      { reservationId },
    );
  }
  const actual =
    actualMicroUsd === null ? existing.amountMicroUsd : parseAmount(actualMicroUsd, 'actualMicroUsd');
  if (actual > existing.amountMicroUsd) {
    throw new BudgetPolicyError(
      'E_BUDGET_OVERCOMMIT',
      `actual ${actual} exceeds reserved ${existing.amountMicroUsd}`,
      { reservationId, actualMicroUsd: actual, reservedMicroUsd: existing.amountMicroUsd },
    );
  }
  return BudgetStateSchema.parse({
    ...parsed,
    reservedMicroUsd: parsed.reservedMicroUsd - existing.amountMicroUsd,
    committedMicroUsd: parsed.committedMicroUsd + actual,
    reservations: {
      ...parsed.reservations,
      [reservationId]: {
        ...existing,
        status: 'committed',
        actualMicroUsd,
        unknown: actualMicroUsd === null,
      },
    },
  });
}

export function release(state: BudgetState, reservationId: string): BudgetState {
  const parsed = parseState(state);
  const existing = parsed.reservations[reservationId];
  if (!existing || existing.status !== 'reserved') {
    throw new BudgetPolicyError(
      'E_BUDGET_UNKNOWN_RESERVATION',
      `reservation ${reservationId} is missing or not reserved`,
      { reservationId },
    );
  }
  return BudgetStateSchema.parse({
    ...parsed,
    reservedMicroUsd: parsed.reservedMicroUsd - existing.amountMicroUsd,
    reservations: {
      ...parsed.reservations,
      [reservationId]: {
        ...existing,
        status: 'released',
        actualMicroUsd: null,
        unknown: false,
      },
    },
  });
}

export function snapshot(state: BudgetState): BudgetSnapshot {
  const parsed = parseState(state);
  const unknownReservationIds = Object.values(parsed.reservations)
    .filter((r) => r.unknown)
    .map((r) => r.id)
    .sort();
  return BudgetSnapshotSchema.parse({
    capMicroUsd: parsed.capMicroUsd,
    reservedMicroUsd: parsed.reservedMicroUsd,
    committedMicroUsd: parsed.committedMicroUsd,
    remainingMicroUsd:
      parsed.capMicroUsd - parsed.reservedMicroUsd - parsed.committedMicroUsd,
    unknownReservationIds,
    reservationCount: Object.keys(parsed.reservations).length,
  });
}

/** Useful for CI/tests that assert the refusal registry is the source of truth. */
export const BUDGET_REFUSAL_CODES: readonly BudgetRefusalCode[] = [
  'E_BUDGET_EXCEEDED',
  'E_BUDGET_UNKNOWN_RESERVATION',
  'E_BUDGET_DUPLICATE_RESERVATION',
  'E_BUDGET_INVALID_AMOUNT',
  'E_BUDGET_OVERCOMMIT',
] as const satisfies readonly RefusalCode[];
