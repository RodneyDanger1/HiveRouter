import crypto from 'node:crypto';

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'deepseek', re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'openrouter', re: /\bsk-or-v1-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'gemini', re: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { name: 'bearer', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi },
  { name: 'password', re: /\b(password|passwd|pwd)\s*[:=]\s*["']?[^"'\s]{6,}/gi },
  { name: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { name: 'dsh-yaml-key', re: /^\s*(?:DEEPSEEK_API_KEY|OPENROUTER_API_KEY):\s*\S+\s*$/gm },
  { name: 'aws-access', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
];

export const REDACTOR_VERSION = '1.0.0';
export const MASK = '[REDACTED_SYSTEM_SECRET]';

export function redactString(input: string): string {
  let out = input;
  for (const { re } of PATTERNS) out = out.replace(re, MASK);
  return out;
}

export function containsSecret(input: string): boolean {
  return PATTERNS.some(({ re }) => {
    re.lastIndex = 0;
    return re.test(input);
  });
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[DEPTH_LIMIT]';
  if (typeof value === 'string') return redactString(value);
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/^(authorization|cookie|x-api-key|api[_-]?key|secret|token|password)$/i.test(k)) {
        out[k] = MASK;
      } else {
        out[k] = redactValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function fingerprint(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 8);
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function redactForLog(obj: unknown): unknown {
  return redactValue(obj);
}
