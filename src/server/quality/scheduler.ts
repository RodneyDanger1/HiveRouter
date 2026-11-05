/**
 * RVS module alias.
 *
 * The algorithm is implemented in ./rvs.ts; this file keeps the conventional
 * verify/scheduler import name available without creating a second behavior.
 */
export {
  DEFAULT_CHECK_SPECS,
  RISK_RANK,
  KNOWN_CHECK_IDS,
  isCode,
  isDocs,
  planVerification,
} from './rvs';
