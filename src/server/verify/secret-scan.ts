import { containsSecret, redactString } from '../security/redact.js';

export interface SecretFinding {
  file: string;
  line: number;
  pattern: string;
}

export function scanSecrets(file: string, content: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (containsSecret(lines[i])) findings.push({ file, line: i + 1, pattern: 'secret-pattern' });
  }
  return findings;
}

export function redactContent(content: string): string {
  return redactString(content);
}
