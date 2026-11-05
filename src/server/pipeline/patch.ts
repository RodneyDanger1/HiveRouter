import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export interface TextPatch {
  oldText: string;
  newText: string;
}

export interface PatchRequest {
  filePath: string;
  expectedSha256?: string;
  patches: TextPatch[];
  maxChangedNodes?: number;
}

export interface PatchOptions {
  maxFileBytes?: number;
  maxPatches?: number;
  maxPatchTextChars?: number;
  maxChangedNodes?: number;
  backupSuffix?: string;
}

export const PATCH_LIMITS = {
  maxFileBytes: 1024 * 1024,
  maxPatches: 100,
  maxPatchTextChars: 250_000,
  maxChangedNodes: 500,
} as const;

export type PatchLanguage = 'typescript' | 'javascript' | 'unsupported';

export type PatchErrorCode =
  | 'E_PATCH_PATH'
  | 'E_PATCH_TOO_LARGE'
  | 'E_PATCH_EMPTY'
  | 'E_PATCH_NOT_FOUND'
  | 'E_PATCH_AMBIGUOUS'
  | 'E_PATCH_HASH_MISMATCH'
  | 'E_PATCH_SYNTAX'
  | 'E_PATCH_TOO_MANY_NODES'
  | 'E_PATCH_IO';

export interface PatchResult {
  ok: boolean;
  verified: boolean;
  filePath: string;
  language: PatchLanguage;
  changed: boolean;
  sha256Before?: string;
  sha256After?: string;
  backupPath?: string;
  changedNodes?: number;
  errorCode?: PatchErrorCode;
  message?: string;
}

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const JS_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs']);

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function languageFor(filePath: string): PatchLanguage {
  const ext = path.extname(filePath).toLowerCase();
  if (TS_EXTENSIONS.has(ext)) return 'typescript';
  if (JS_EXTENSIONS.has(ext)) return 'javascript';
  return 'unsupported';
}

function scriptKindFor(filePath: string): ts.ScriptKind {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function fail(filePath: string, language: PatchLanguage, errorCode: PatchErrorCode, message: string, extra: Partial<PatchResult> = {}): PatchResult {
  return { ok: false, verified: false, filePath, language, changed: false, errorCode, message, ...extra };
}

function insideRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function leafNodes(sourceFile: ts.SourceFile): Array<{ kind: number; text: string }> {
  const leaves: Array<{ kind: number; text: string }> = [];
  const visit = (node: ts.Node): void => {
    const children = node.getChildren(sourceFile);
    if (children.length === 0) {
      leaves.push({ kind: node.kind, text: node.getText(sourceFile) });
      return;
    }
    for (const child of children) visit(child);
  };
  visit(sourceFile);
  return leaves;
}

/** Approximate changed-node count by comparing leaf/leaf-token nodes in AST order. */
export function changedNodeCount(before: ts.SourceFile, after: ts.SourceFile): number {
  const left = leafNodes(before);
  const right = leafNodes(after);
  let changed = Math.abs(left.length - right.length);
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    if (left[index].kind !== right[index].kind || left[index].text !== right[index].text) changed += 1;
  }
  return changed;
}

function parseSource(filePath: string, text: string): { sourceFile: ts.SourceFile; errors: readonly ts.Diagnostic[] } {
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKindFor(filePath));
  const diagnostics = (sourceFile as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  return { sourceFile, errors: diagnostics };
}

function atomicReplace(target: string, content: string, backupPath: string): void {
  const directory = path.dirname(target);
  const tempPath = path.join(directory, `.${path.basename(target)}.tmp-${crypto.randomBytes(8).toString('hex')}`);
  let fd: number | null = null;
  try {
    fd = fs.openSync(tempPath, 'wx', 0o600);
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.copyFileSync(target, backupPath);
    fs.renameSync(tempPath, target);
  } catch (error) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* already closed */ }
    }
    try { fs.rmSync(tempPath, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}

export function applyPatch(root: string, request: PatchRequest, options: PatchOptions = {}): PatchResult {
  const resolvedRoot = path.resolve(root);
  const language = languageFor(request.filePath);
  const maxFileBytes = options.maxFileBytes ?? PATCH_LIMITS.maxFileBytes;
  const maxPatches = options.maxPatches ?? PATCH_LIMITS.maxPatches;
  const maxPatchTextChars = options.maxPatchTextChars ?? PATCH_LIMITS.maxPatchTextChars;
  const maxChangedNodes = request.maxChangedNodes ?? options.maxChangedNodes ?? PATCH_LIMITS.maxChangedNodes;
  const backupSuffix = options.backupSuffix ?? '.bak';

  if (!request.filePath || request.filePath.includes('\0') || path.isAbsolute(request.filePath)) {
    return fail(request.filePath, language, 'E_PATCH_PATH', 'filePath must be a relative path inside the patch root.');
  }
  const target = path.resolve(resolvedRoot, request.filePath);
  if (!insideRoot(resolvedRoot, target)) {
    return fail(request.filePath, language, 'E_PATCH_PATH', 'filePath escapes the patch root.');
  }
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(target);
  } catch {
    return fail(request.filePath, language, 'E_PATCH_NOT_FOUND', 'Target file does not exist.');
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    return fail(request.filePath, language, 'E_PATCH_PATH', 'Target must be a regular file, not a symlink or directory.');
  }
  try {
    const realRoot = fs.realpathSync(resolvedRoot);
    const realTarget = fs.realpathSync(target);
    if (!insideRoot(realRoot, realTarget)) {
      return fail(request.filePath, language, 'E_PATCH_PATH', 'Resolved filePath escapes the patch root through a symlink.');
    }
  } catch {
    return fail(request.filePath, language, 'E_PATCH_IO', 'Target path could not be resolved.');
  }
  if (stat.size > maxFileBytes) {
    return fail(request.filePath, language, 'E_PATCH_TOO_LARGE', `Target exceeds ${maxFileBytes} bytes.`);
  }
  if (!Array.isArray(request.patches) || request.patches.length === 0) {
    return fail(request.filePath, language, 'E_PATCH_EMPTY', 'At least one patch is required.');
  }
  if (request.patches.length > maxPatches) {
    return fail(request.filePath, language, 'E_PATCH_TOO_LARGE', `Patch count exceeds ${maxPatches}.`);
  }
  for (const patch of request.patches) {
    if (typeof patch.oldText !== 'string' || typeof patch.newText !== 'string' || patch.oldText.length === 0) {
      return fail(request.filePath, language, 'E_PATCH_EMPTY', 'Every patch needs non-empty oldText and string newText.');
    }
    if (patch.oldText.length > maxPatchTextChars || patch.newText.length > maxPatchTextChars) {
      return fail(request.filePath, language, 'E_PATCH_TOO_LARGE', `Patch text exceeds ${maxPatchTextChars} characters.`);
    }
  }

  let before: string;
  try {
    before = fs.readFileSync(target, 'utf8');
  } catch {
    return fail(request.filePath, language, 'E_PATCH_IO', 'Target could not be read.');
  }
  const sha256Before = sha256(before);
  if (request.expectedSha256 !== undefined && request.expectedSha256.toLowerCase() !== sha256Before) {
    return fail(request.filePath, language, 'E_PATCH_HASH_MISMATCH', 'Expected sha256 does not match the target.', { sha256Before });
  }

  let after = before;
  for (const patch of request.patches) {
    const first = after.indexOf(patch.oldText);
    if (first < 0) {
      return fail(request.filePath, language, 'E_PATCH_NOT_FOUND', 'oldText was not found exactly.', { sha256Before });
    }
    if (after.indexOf(patch.oldText, first + patch.oldText.length) >= 0) {
      return fail(request.filePath, language, 'E_PATCH_AMBIGUOUS', 'oldText occurs more than once; patches must be unique.', { sha256Before });
    }
    after = after.slice(0, first) + patch.newText + after.slice(first + patch.oldText.length);
  }

  if (Buffer.byteLength(after, 'utf8') > maxFileBytes) {
    return fail(request.filePath, language, 'E_PATCH_TOO_LARGE', `Patched file would exceed ${maxFileBytes} bytes.`, { sha256Before });
  }

  let verified = false;
  let changedNodes: number | undefined;
  if (language !== 'unsupported') {
    const beforeSource = parseSource(target, before);
    const afterSource = parseSource(target, after);
    if (afterSource.errors.length > 0) {
      const first = afterSource.errors[0];
      return fail(request.filePath, language, 'E_PATCH_SYNTAX', `Patched ${language} does not parse: ${ts.flattenDiagnosticMessageText(first.messageText, ' ')}`, { sha256Before });
    }
    changedNodes = changedNodeCount(beforeSource.sourceFile, afterSource.sourceFile);
    if (changedNodes > maxChangedNodes) {
      return fail(request.filePath, language, 'E_PATCH_TOO_MANY_NODES', `Patch changes ${changedNodes} nodes; limit is ${maxChangedNodes}.`, { sha256Before, changedNodes });
    }
    verified = true;
  }

  if (after === before) {
    return {
      ok: true,
      verified,
      filePath: request.filePath,
      language,
      changed: false,
      sha256Before,
      sha256After: sha256Before,
      changedNodes,
    };
  }

  const backupPath = `${target}${backupSuffix}`;
  try {
    atomicReplace(target, after, backupPath);
  } catch (error) {
    return fail(request.filePath, language, 'E_PATCH_IO', error instanceof Error ? error.message : 'Atomic write failed.', {
      sha256Before,
      backupPath,
    });
  }

  let readBack: string;
  try {
    readBack = fs.readFileSync(target, 'utf8');
  } catch {
    return fail(request.filePath, language, 'E_PATCH_IO', 'Patched file could not be read back.', { sha256Before, backupPath });
  }
  const sha256After = sha256(readBack);
  if (readBack !== after) {
    return fail(request.filePath, language, 'E_PATCH_IO', 'Read-back does not match the intended patch.', { sha256Before, sha256After, backupPath });
  }
  return {
    ok: true,
    verified,
    filePath: request.filePath,
    language,
    changed: true,
    sha256Before,
    sha256After,
    backupPath,
    changedNodes,
  };
}
