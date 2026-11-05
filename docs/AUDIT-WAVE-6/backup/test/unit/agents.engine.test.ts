import { describe, expect, it } from 'vitest';
import { engineForPath, resolveEngine } from '../../src/server/agents/registry.js';

describe('engine resolution', () => {
  it('honors an exact capable engine hint first', () => {
    const result = resolveEngine('src/main.py', '', 'python-engine');
    expect(result.agentId).toBe('python-engine');
    expect(result.source).toBe('hint');
  });

  it('resolves a legacy alias hint and warns about it', () => {
    const result = resolveEngine('src/main.js', '', 'node');
    expect(result.agentId).toBe('js-engine');
    expect(result.warnings.join(' ')).toContain('resolved');
  });

  it('falls through an incapable hint to the path rule', () => {
    const result = resolveEngine('src/main.py', '', 'react-engine');
    expect(result.agentId).toBe('python-engine');
    expect(result.source).toBe('path');
    expect(result.warnings.join(' ')).toContain('cannot handle');
  });

  it('honors duty markers before the path', () => {
    expect(resolveEngine('src/main.py', 'algorithm with Big-O').agentId).toBe('algorithm-engine');
    expect(resolveEngine('src/scene.js', 'three.js webgl scene').agentId).toBe('threejs-engine');
    expect(resolveEngine('src/app.jsx', 'NDS national design studio').agentId).toBe('nds-engine');
    expect(resolveEngine('scripts/api.ps1', 'REST API client').agentId).toBe('powershell-api');
    expect(resolveEngine('scripts/diag.ps1', 'event log diagnostic').agentId).toBe('powershell-diagnostics');
    expect(resolveEngine('db/maintenance.sql', 'janitor vacuum').agentId).toBe('db-janitor-engine');
    expect(resolveEngine('config/state.yaml', 'state machine transitions').agentId).toBe('symbolic-logic-engine');
    expect(resolveEngine('src/scraper.py', 'scrape crawl ingest').agentId).toBe('harvester-engine');
    expect(resolveEngine('src/monitor.ts', 'heartbeat monitor').agentId).toBe('live-monitor-engine');
  });

  it('uses the path rules for ordinary files', () => {
    expect(resolveEngine('src/main.py').agentId).toBe('python-engine');
    expect(resolveEngine('src/main.ts').agentId).toBe('ts-engine');
    expect(resolveEngine('src/App.tsx').agentId).toBe('react-engine');
    expect(resolveEngine('src/styles.css').agentId).toBe('tailwind-engine');
    expect(resolveEngine('src/index.html').agentId).toBe('html-engine');
    expect(resolveEngine('src/schema.json').agentId).toBe('schema-engine');
    expect(resolveEngine('src/query.sql').agentId).toBe('sql-engine');
    expect(resolveEngine('config/app.yaml').agentId).toBe('yaml-engine');
    expect(resolveEngine('README.md').agentId).toBe('markdown-engine');
    expect(resolveEngine('src/lib.rs').agentId).toBe('baremetal-engine');
    expect(resolveEngine('scripts/run.ps1').agentId).toBe('powershell-core');
    expect(resolveEngine('scripts/run.cmd').agentId).toBe('cmd-engine');
    expect(resolveEngine('scripts/run.sh').agentId).toBe('bash-engine');
  });

  it('gives test paths to the Gatekeeper', () => {
    expect(resolveEngine('tests/test_main.py').agentId).toBe('gatekeeper');
    expect(resolveEngine('src/main.test.ts').agentId).toBe('gatekeeper');
  });

  it('uses specific infrastructure path rules before generic extensions', () => {
    expect(resolveEngine('.github/workflows/ci.yml').agentId).toBe('gitops-engine');
    expect(resolveEngine('package.json').agentId).toBe('package-engine');
    expect(resolveEngine('Dockerfile').agentId).toBe('sandbox-engine');
    expect(resolveEngine('docker-compose.yml').agentId).toBe('sandbox-engine');
  });

  it('uses the fallback extension before the polyglot step', () => {
    const result = resolveEngine('notes.txt');
    expect(result.agentId).toBe('markdown-engine');
    expect(result.source).toBe('fallback');
  });

  it('uses polyglot only for a declared language', () => {
    const result = resolveEngine('src/main.go');
    expect(result.agentId).toBe('polyglot-engine');
    expect(result.source).toBe('polyglot');
  });

  it('refuses an unknown language by name', () => {
    const result = resolveEngine('src/main.xyz');
    expect(result.agentId).toBeNull();
    expect(result.code).toBe('E_NO_CAPABLE_AGENT');
    expect(result.reason).toContain('No registered engine');
  });

  it('respects an agent path glob before a duty match', () => {
    const result = resolveEngine('src/random.sql', 'janitor vacuum');
    expect(result.agentId).toBe('sql-engine');
    expect(result.agentId).not.toBe('db-janitor-engine');
  });

  it('matches root-level files through **/ path globs', () => {
    expect(resolveEngine('README.md').agentId).toBe('markdown-engine');
    expect(resolveEngine('Dockerfile').agentId).toBe('sandbox-engine');
    expect(resolveEngine('package.json').agentId).toBe('package-engine');
  });

  it('refuses equally ranked, conflicting duty markers', () => {
    const result = resolveEngine('src/main.js', 'algorithm and three.js scene');
    expect(result.agentId).toBeNull();
    expect(result.code).toBe('E_AGENT_AMBIGUOUS');
    expect(result.warnings.join(' ')).toContain('ambiguous');
  });

  it('keeps the compatibility engineForPath surface returning an id', () => {
    expect(engineForPath('src/main.py')).toBe('python-engine');
    expect(engineForPath('src/main.go')).toBe('polyglot-engine');
    expect(engineForPath('src/main.xyz')).toBe('structural-engine');
  });
});
