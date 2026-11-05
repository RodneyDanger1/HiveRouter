import crypto from 'node:crypto';

export const FAILURE_CATEGORIES = [
  'syntax',
  'type',
  'import',
  'missing_file',
  'permission',
  'timeout',
  'rate_limit',
  'budget',
  'auth',
  'secret',
  'placeholder',
  'path',
  'test_assert',
  'runtime',
  'unknown',
] as const;
export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

const CATEGORY_RULES: Array<{ category: FailureCategory; re: RegExp }> = [
  { category: 'auth', re: /\b(401|403|unauthorized|forbidden|invalid api key|authentication)\b/i },
  { category: 'budget', re: /\b(402|429|budget|quota|balance|insufficient funds)\b/i },
  { category: 'rate_limit', re: /\b(rate[ _-]?limit|too many requests|retry[- ]after)\b/i },
  { category: 'timeout', re: /\b(timeout|timed out|ETIMEDOUT|deadline exceeded)\b/i },
  { category: 'permission', re: /\b(EACCES|EPERM|permission denied|access denied)\b/i },
  { category: 'missing_file', re: /\b(ENOENT|no such file|file not found|cannot find module)\b/i },
  { category: 'import', re: /\b(import|export|module not found|is not exported)\b/i },
  { category: 'syntax', re: /\b(syntaxerror|unexpected token|parse error|invalid syntax|unterminated)\b/i },
  { category: 'type', re: /\b(typeerror|TS\d{4}|type .* is not assignable|not assignable to type)\b/i },
  { category: 'secret', re: /\b(secret|credential|api key|token leak|redact)\b/i },
  { category: 'placeholder', re: /\b(TODO|FIXME|NotImplemented|placeholder|not implemented)\b/i },
  { category: 'path', re: /\b(path|traversal|reserved name|unsafe file|zip slip)\b/i },
  { category: 'test_assert', re: /\b(assertionerror|expected .* to (?:be|equal)|test failed|failing test)\b/i },
];

export function normalizeFailureMessage(message: string): string {
  return message
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[A-Za-z]:\\(?:[^\s:]+\\?)+/g, '<path>')
    .replace(/\/(?:[\w.-]+\/)+[\w.-]+/g, '<path>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hex>')
    .replace(/\b\d+(?:\.\d+)?(?:ms|s|us|µs)?\b/gi, '<n>')
    .replace(/\bline\s+<n>\b/gi, 'line <n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);
}

export function classifyFailure(message: string): FailureCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(message)) return rule.category;
  }
  return 'unknown';
}

export interface FailureSignatureInput {
  phase?: string | null;
  agentId?: string | null;
  category?: FailureCategory | string | null;
  message: string;
  fileExt?: string | null;
  repairRound?: number | null;
}

export function failureSignature(input: FailureSignatureInput): string {
  const category = input.category ?? classifyFailure(input.message);
  const canonical = [
    input.phase ?? '',
    input.agentId ?? '',
    category,
    input.fileExt ?? '',
    String(input.repairRound ?? 0),
    normalizeFailureMessage(input.message),
  ].join('|');
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
