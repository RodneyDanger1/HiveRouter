import { describe, expect, it } from 'vitest';
import { scanText } from '../../src/server/verify/stub-scan.js';

describe('stub scan', () => {
  it('does not flag capability prose that merely mentions unimplemented tools', () => {
    const code = [
      '"""Explain what is not implemented and which tools are unavailable."""',
      'STATUSES = ("verified", "refuted", "unknown")',
      'MARKER = "not implemented"',
      'ERROR_NAMES = ("NotImplementedError", "PermissionError")',
      '',
    ].join('\n');
    expect(scanText('src/probes/tool_access.py', code)).toEqual([]);
  });

  it('flags real placeholder code and comment markers', () => {
    const code = [
      'def probe():',
      '    # TODO: wire this probe',
      '    raise NotImplementedError("probe not implemented")',
      '',
    ].join('\n');
    const findings = scanText('src/probes/tool_access.py', code);
    expect(findings.some((finding) => finding.pattern === 'todo')).toBe(true);
    expect(findings.some((finding) => finding.pattern === 'not-implemented')).toBe(true);
  });

  it('does not turn a normal comment about mock testing into a product-code defect', () => {
    expect(scanText('tests/test_probe.py', '# use mock only at the provider boundary\n')).toEqual([]);
  });
});
