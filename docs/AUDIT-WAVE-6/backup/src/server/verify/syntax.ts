import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ts from 'typescript';
import YAML from 'yaml';
import { parse as parseHtml } from 'parse5';
import { DatabaseSync } from 'node:sqlite';
import { PathError, safePath } from '../security/paths.js';

const execFileAsync = promisify(execFile);

/**
 * Minimal environment for the Python AST checker. Never forward provider
 * credentials (DEEPSEEK_API_KEY, OPENROUTER_API_KEY, AWS/GitHub tokens) or
 * arbitrary PYTHONPATH injection into a child process.
 */
const SAFE_CHILD_ENV_KEYS = new Set([
  'PATH',
  'Path',
  'PATHEXT',
  'SystemRoot',
  'SYSTEMROOT',
  'WINDIR',
  'ComSpec',
  'COMSPEC',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMDATA',
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'OS',
  'PROCESSOR_ARCHITECTURE',
  'NUMBER_OF_PROCESSORS',
  'PYTHONHOME',
  'PYTHONIOENCODING',
  'LANG',
  'LC_ALL',
]);

export function syntaxChildEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const safe: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && SAFE_CHILD_ENV_KEYS.has(key)) safe[key] = value;
  }
  return safe;
}

export interface SyntaxResult {
  ok: boolean;
  detail: string;
  code?: string;
}

function languageOf(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.py') return 'python';
  if (['.js', '.mjs', '.cjs'].includes(ext)) return 'javascript';
  if (['.ts', '.tsx', '.jsx'].includes(ext)) return 'typescript';
  if (ext === '.json') return 'json';
  if (['.yml', '.yaml'].includes(ext)) return 'yaml';
  if (ext === '.sql') return 'sql';
  if (ext === '.html') return 'html';
  return 'text';
}

export async function checkSyntax(filePath: string, content: string): Promise<SyntaxResult> {
  const language = languageOf(filePath);
  try {
    switch (language) {
      case 'python': {
        const script = 'import ast,sys; ast.parse(open(sys.argv[1], encoding="utf-8").read(), filename=sys.argv[1])';
        await execFileAsync(process.env.PYTHON_BIN ?? 'python', ['-B', '-c', script, filePath], {
          timeout: 15_000,
          windowsHide: true,
          maxBuffer: 1024 * 1024,
          env: { ...syntaxChildEnv(), PYTHONDONTWRITEBYTECODE: '1' },
        });
        return { ok: true, detail: 'python ast parse' };
      }
      case 'javascript':
      case 'typescript': {
        const result = ts.transpileModule(content, {
          fileName: filePath,
          reportDiagnostics: true,
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.Preserve,
            allowJs: true,
            noEmit: true,
          },
        });
        const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
        if (errors.length > 0) {
          const first = errors[0];
          const message = ts.flattenDiagnosticMessageText(first.messageText, '\n');
          return { ok: false, detail: `${message}`, code: `TS${first.code}` };
        }
        return { ok: true, detail: 'typescript transpile' };
      }
      case 'json': {
        JSON.parse(content);
        return { ok: true, detail: 'json parse' };
      }
      case 'yaml': {
        const docs = YAML.parseAllDocuments(content);
        const errors = docs.flatMap((d) => d.errors);
        if (errors.length > 0) return { ok: false, detail: errors[0]?.message ?? 'yaml parse error', code: 'YAML_PARSE' };
        return { ok: true, detail: 'yaml parse' };
      }
      case 'sql': {
        if (/\b(ATTACH|DETACH|load_extension|VACUUM\s+INTO)\b/i.test(content)) {
          return { ok: false, detail: 'SQL contains a forbidden statement', code: 'SQL_FORBIDDEN' };
        }
        const db = new DatabaseSync(':memory:');
        try {
          db.exec(content);
        } finally {
          db.close();
        }
        return { ok: true, detail: 'sqlite parse' };
      }
      case 'html': {
        const errors: unknown[] = [];
        parseHtml(content, { onParseError: (err: unknown) => errors.push(err) } as never);
        if (errors.length > 0) return { ok: false, detail: 'html parse error', code: 'HTML_PARSE' };
        return { ok: true, detail: 'html parse' };
      }
      default:
        return { ok: true, detail: 'no syntax checker for this language (static-only)' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: message.slice(0, 500), code: 'SYNTAX_ERROR' };
  }
}

export function checkFileSyntax(root: string, rel: string): Promise<SyntaxResult> {
  const full = safePath(root, rel);
  if (!fs.existsSync(full)) return Promise.resolve({ ok: false, detail: 'file missing', code: 'E_FILE_NOT_FOUND' });
  if (Buffer.byteLength(fs.readFileSync(full)) > 256 * 1024) {
    return Promise.resolve({ ok: false, detail: 'file exceeds 256 KB', code: 'SYNTAX_TOO_LARGE' });
  }
  return checkSyntax(rel, fs.readFileSync(full, 'utf8'));
}

export function assertNoBinary(filePath: string): void {
  const buf = fs.readFileSync(filePath);
  if (buf.includes(0)) throw new PathError('E_UNSAFE_PATH', 'binary content');
}
