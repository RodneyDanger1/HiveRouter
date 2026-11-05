import { z } from 'zod';

export const PHASE = z.enum(['A', 'B1', 'B2']).parse(process.env.HIVE_PHASE ?? 'B2');
export type Phase = 'A' | 'B1' | 'B2';

export const FEATURES = {
  routing: PHASE !== 'A',
  learning: PHASE === 'B2',
  chat: PHASE === 'B2',
} as const;

export const VERSION = '0.1.0';
export const SCHEMA_VERSION = 1;

export function isFeatureEnabled(name: keyof typeof FEATURES): boolean {
  return FEATURES[name];
}
