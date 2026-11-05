import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RESERVED_WINDOWS = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

const ALLOWED_EXT = new Set([
  '.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.scss',
  '.sql', '.json', '.yml', '.yaml', '.ps1', '.cmd', '.bat', '.sh', '.rs', '.cpp',
  '.cc', '.c', '.h', '.hpp', '.go', '.java', '.cs', '.rb', '.swift', '.php',
  '.md', '.txt', '.toml', '.ini', '.env.example', '.gitignore', '.dockerignore',
  '.dockerfile', 'Dockerfile', '.csv', '.xml', '.svg',
]);

export function normalizeRel(rel: string): string {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > 512) throw new PathError('E_UNSAFE_PATH', 'empty or oversized path');
  if (rel.includes('\0')) throw new PathError('E_UNSAFE_PATH', 'null byte');
  if (rel.includes(':')) throw new PathError('E_UNSAFE_PATH', 'alternate data stream or drive separator');
  if (path.isAbsolute(rel)) throw new PathError('E_UNSAFE_PATH', 'absolute path');
  const normalized = rel.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.length > 8) throw new PathError('E_UNSAFE_PATH', 'path depth');
  for (const part of parts) {
    if (!part || part === '.' || part === '..') throw new PathError('E_UNSAFE_PATH', 'dot segment');
    if (/[<>"|?*]/.test(part)) throw new PathError('E_UNSAFE_PATH', 'invalid character');
    if (/[. ]$/.test(part)) throw new PathError('E_UNSAFE_PATH', 'trailing dot or space');
    if (RESERVED_WINDOWS.has(part.replace(/\.[^.]+$/, '').toUpperCase())) throw new PathError('E_UNSAFE_PATH', 'reserved device name');
    // Windows reserves a device name even with multiple extensions:
    // CON.tar.gz is still the CON device, not a normal file.
    if (RESERVED_WINDOWS.has(part.split('.')[0]!.toUpperCase())) throw new PathError('E_UNSAFE_PATH', 'reserved device name');
  }
  return parts.join('/');
}

export class PathError extends Error {
  constructor(public readonly code: 'E_UNSAFE_PATH' | 'E_FILE_NOT_FOUND' | 'E_ZIP_PATH', message: string) {
    super(message);
    this.name = 'PathError';
  }
}

export function safePath(root: string, rel: string): string {
  const normalized = normalizeRel(rel);
  const rootReal = fs.realpathSync(root);
  const target = path.resolve(rootReal, normalized);
  const relative = path.relative(rootReal, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new PathError('E_UNSAFE_PATH', 'escapes root');
  const segments = relative.split(path.sep);
  let cursor = rootReal;
  for (const segment of segments) {
    cursor = path.join(cursor, segment);
    if (fs.existsSync(cursor)) {
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) throw new PathError('E_UNSAFE_PATH', 'symlink or junction');
    }
  }
  return target;
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function atomicWrite(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): void {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, content, { encoding });
  fs.renameSync(tmp, filePath);
}

export function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

export function listFiles(root: string, rel = ''): string[] {
  const start = rel ? safePath(root, rel) : root;
  if (!fs.existsSync(start)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile()) out.push(path.relative(root, full).replace(/\\/g, '/'));
    }
  };
  walk(start);
  return out.sort();
}

export function isAllowedExtension(rel: string): boolean {
  const base = path.basename(rel);
  if (base === 'Dockerfile' || base.startsWith('Dockerfile.')) return true;
  if (base === '.gitignore' || base === '.dockerignore' || base === '.env.example') return true;
  const ext = path.extname(base).toLowerCase();
  return ALLOWED_EXT.has(ext);
}

export function assertAllowedExtension(rel: string): void {
  if (!isAllowedExtension(rel)) throw new PathError('E_UNSAFE_PATH', `unsupported extension for ${rel}`);
}

export function contentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
