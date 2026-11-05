import fs from 'node:fs';
import path from 'node:path';
import { checkSyntax } from './syntax.js';
import { scanSecrets } from './secret-scan.js';
import { scanText } from './stub-scan.js';
import { isAllowedExtension, listFiles, normalizeRel, safePath } from '../security/paths.js';
import type { CheckResult } from '../../shared/types.js';

const CODE_EXT = new Set(['.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.sql', '.json', '.yml', '.yaml', '.ps1', '.cmd', '.bat', '.sh', '.rs', '.cpp', '.c', '.h', '.go', '.java', '.cs', '.rb', '.swift', '.php']);

function extOf(file: string): string {
  return path.extname(file).toLowerCase();
}

function isVerifiable(file: string): boolean {
  return ['.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.sql', '.json', '.yml', '.yaml'].includes(extOf(file));
}

const SYNTAX_LANGUAGE: Record<string, string> = {
  '.py': 'python',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.jsx': 'jsx',
  '.json': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.sql': 'sql',
  '.html': 'html',
};

function syntaxCheckId(file: string): string {
  const ext = extOf(file);
  return `syntax.${SYNTAX_LANGUAGE[ext] ?? (ext.replace('.', '') || 'text')}`;
}

export interface VerificationPlanCheck {
  checkId: string;
  status: 'planned' | 'unverified';
}

export async function verifyStaged(root: string, plannedPaths: string[], rvsPlan?: { checks: VerificationPlanCheck[] }): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const plannedCheckIds = rvsPlan ? new Set(rvsPlan.checks.filter((check) => check.status === 'planned').map((check) => check.checkId)) : null;
  const shouldRun = (id: string): boolean => plannedCheckIds === null || plannedCheckIds.has(id) || id === 'path.safety' || id === 'plan.coverage';
  let files: string[] = [];
  try {
    files = listFiles(root);
  } catch (error) {
    return [{ id: 'path.safety', status: 'fail', detail: `staged tree unreadable: ${error instanceof Error ? error.message : String(error)}`, mandatory: true }];
  }
  const fileSet = new Set(files);
  for (const planned of plannedPaths) {
    try {
      normalizeRel(planned);
    } catch (error) {
      checks.push({ id: 'path.safety', status: 'fail', detail: `unsafe planned path ${planned}`, file: planned, mandatory: true });
      continue;
    }
    if (!fileSet.has(planned)) {
      checks.push({ id: 'plan.coverage', status: 'fail', detail: `planned file missing: ${planned}`, file: planned, mandatory: true });
    }
  }
  if (!checks.some((c) => c.id === 'plan.coverage')) {
    checks.push({ id: 'plan.coverage', status: 'pass', detail: `${plannedPaths.length} planned files present`, mandatory: true });
  }

  let secretFailures = 0;
  let stubFailures = 0;
  let syntaxFailures = 0;
  let syntaxSkipped = 0;
  let syntaxRan = 0;
  let unverified = 0;
  let skippedByPlan = 0;
  for (const file of files) {
    let full: string;
    try {
      full = safePath(root, file);
    } catch (error) {
      checks.push({ id: 'path.safety', status: 'fail', detail: error instanceof Error ? error.message : 'unsafe path', file, mandatory: true });
      continue;
    }
    if (!isAllowedExtension(file)) {
      checks.push({ id: 'path.safety', status: 'fail', detail: 'unsupported extension', file, mandatory: true });
      continue;
    }
    const content = fs.readFileSync(full, 'utf8');
    if (shouldRun('secret.scan') && scanSecrets(file, content).length > 0) {
      secretFailures += 1;
      checks.push({ id: 'secret.scan', status: 'fail', detail: 'secret pattern found (content redacted from detail)', file, mandatory: true });
    }
    if (CODE_EXT.has(extOf(file)) && shouldRun('stub.scan')) {
      const stubs = scanText(file, content);
      if (stubs.length > 0) {
        stubFailures += 1;
        checks.push({ id: 'stub.scan', status: 'fail', detail: `${stubs.length} placeholder marker(s), first at line ${stubs[0].line}`, file, line: stubs[0].line, mandatory: true });
      }
    }
    if (isVerifiable(file)) {
      const checkId = syntaxCheckId(file);
      if (!shouldRun(checkId)) {
        skippedByPlan += 1;
        syntaxSkipped += 1;
        checks.push({
          id: checkId,
          status: 'unverified',
          detail: 'RVS plan did not schedule this syntax check',
          file,
          mandatory: true,
        });
      } else {
        syntaxRan += 1;
        const result = await checkSyntax(full, content);
        if (!result.ok) {
          syntaxFailures += 1;
          checks.push({ id: checkId, status: 'fail', detail: result.detail, file, mandatory: true, code: result.code });
        }
      }
    } else if (CODE_EXT.has(extOf(file))) {
      unverified += 1;
    }
  }
  if (rvsPlan) {
    checks.push({
      id: 'verification.plan',
      status: skippedByPlan > 0 ? 'warn' : 'pass',
      detail: `RVS planned ${rvsPlan.checks.filter((check) => check.status === 'planned').length} check(s); ${skippedByPlan} syntax check(s) skipped by plan`,
      mandatory: false,
    });
  }
  if (secretFailures === 0 && shouldRun('secret.scan')) checks.push({ id: 'secret.scan', status: 'pass', detail: 'no secret patterns', mandatory: true });
  if (stubFailures === 0 && shouldRun('stub.scan')) checks.push({ id: 'stub.scan', status: 'pass', detail: 'no placeholder markers', mandatory: true });
  if (syntaxFailures === 0 && syntaxSkipped === 0) {
    checks.push({ id: 'syntax.all', status: 'pass', detail: `all ${syntaxRan} verifiable file(s) parse`, mandatory: true });
  } else if (syntaxSkipped > 0) {
    checks.push({ id: 'syntax.all', status: 'unverified', detail: `${syntaxSkipped} verifiable file(s) skipped by the RVS plan; the gate cannot pass`, mandatory: true });
  }
  if (unverified > 0) {
    checks.push({ id: 'syntax.unverified', status: 'unverified', detail: `${unverified} file(s) have no runtime parser (static-only)`, mandatory: false });
  }
  return checks;
}

export function mandatoryFailed(checks: CheckResult[]): boolean {
  return checks.some((c) => c.mandatory && (c.status === 'fail' || c.status === 'unverified'));
}

export function gateStatus(checks: CheckResult[]): 'pass' | 'pass_with_warnings' | 'fail' {
  if (mandatoryFailed(checks)) return 'fail';
  if (checks.some((c) => c.status === 'warn' || c.status === 'unverified')) return 'pass_with_warnings';
  return 'pass';
}
