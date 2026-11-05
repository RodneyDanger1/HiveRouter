import fs from 'node:fs';
import path from 'node:path';
import { safePath } from '../security/paths.js';

export interface StubFinding {
  file: string;
  line: number;
  pattern: string;
  text: string;
}

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'todo', re: /\bTODO\b/ },
  { name: 'fixme', re: /\bFIXME\b/ },
  { name: 'xxx', re: /\bXXX\b/ },
  { name: 'hack', re: /\bHACK\b/ },
  { name: 'ellipsis-comment', re: /(?:\/\/|#)\s*\.\.\.|\/\*\s*\.\.\.\s*\*\// },
];

const CODE_EXT = new Set(['.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.sql', '.json', '.yml', '.yaml', '.ps1', '.cmd', '.bat', '.sh', '.rs', '.cpp', '.c', '.h', '.go', '.java', '.cs', '.rb', '.swift', '.php']);

function isCommentLine(line: string): boolean {
  return /^\s*(?:\/\/|#|\/\*|\*|<!--|--)/.test(line);
}

export function scanText(file: string, content: string): StubFinding[] {
  const ext = path.extname(file).toLowerCase();
  if (!CODE_EXT.has(ext)) return [];
  const findings: StubFinding[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of PATTERNS) {
      if (pattern.re.test(line)) {
        findings.push({ file, line: i + 1, pattern: pattern.name, text: line.trim().slice(0, 240) });
      }
    }
    const comment = isCommentLine(line);
    // Docs may name unavailable capabilities; only explicit sentinel comments
    // or executable sentinel constructs count as defects.
    if (comment && /\b(?:placeholder|implementation here|add logic here|your code here)\b/i.test(line)) {
      findings.push({ file, line: i + 1, pattern: 'comment-placeholder', text: line.trim().slice(0, 240) });
    }
    if (/\b(?:raise|throw|return)\b[^\n]*\bNotImplemented(?:Error)?\b/.test(line)) {
      findings.push({ file, line: i + 1, pattern: 'not-implemented', text: line.trim().slice(0, 240) });
    } else if (/\b(?:raise|throw|return)\b[^\n]*\bnot implemented\b/i.test(line)) {
      findings.push({ file, line: i + 1, pattern: 'not-implemented', text: line.trim().slice(0, 240) });
    }
  }
  return findings;
}

export function scanTree(root: string): StubFinding[] {
  const out: StubFinding[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.staging') continue;
      const full = path.join(dir, entry.name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile()) out.push(...scanText(path.relative(root, full).replace(/\\/g, '/'), fs.readFileSync(full, 'utf8')));
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out;
}

export function scanStagedTree(runRoot: string, stagedRel: string): StubFinding[] {
  return scanTree(safePath(runRoot, stagedRel));
}
