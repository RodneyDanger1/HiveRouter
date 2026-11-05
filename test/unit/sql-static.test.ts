import { describe, expect, it } from 'vitest';
import { checkSyntax, splitSqlStatements } from '../../src/server/verify/syntax.js';

describe('static SQL verification — never executes generated SQL', () => {
  it('splits statements without treating quoted semicolons as separators', () => {
    expect(splitSqlStatements("SELECT ';' AS semi; SELECT 2;")).toEqual(["SELECT ';' AS semi", 'SELECT 2']);
  });

  it('classifies DDL as unverified rather than executing it', async () => {
    const result = await checkSyntax('schema.sql', 'CREATE TABLE t(x INTEGER);');
    expect(result.ok).toBe(true);
    expect(result.unverified).toBe(true);
    expect(result.detail).toContain('not executed');
  });

  it('classifies DML as unverified rather than executing it', async () => {
    const result = await checkSyntax('seed.sql', 'INSERT INTO t VALUES (1);');
    expect(result.ok).toBe(true);
    expect(result.unverified).toBe(true);
  });

  it('refuses attach/detach/pragma/load_extension outright', async () => {
    for (const sql of [
      "ATTACH DATABASE 'x' AS y;",
      'DETACH DATABASE y;',
      'PRAGMA writable_schema = 1;',
      "SELECT load_extension('evil');",
    ]) {
      const result = await checkSyntax('unsafe.sql', sql);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('SQL_FORBIDDEN');
    }
  });

  it('accepts a read-only SELECT as a static shape check without running it', async () => {
    const result = await checkSyntax('query.sql', 'SELECT 1 AS one;');
    expect(result.ok).toBe(true);
    expect(result.unverified).toBeUndefined();
    expect(result.detail).toBe('SQL static shape (not executed)');
  });

  it('marks multiple statements unverified', async () => {
    const result = await checkSyntax('multi.sql', 'SELECT 1; SELECT 2;');
    expect(result.ok).toBe(true);
    expect(result.unverified).toBe(true);
  });

  it('rejects an unterminated SQL string instead of executing it', async () => {
    const result = await checkSyntax('broken.sql', "SELECT 'unterminated");
    expect(result.ok).toBe(false);
    expect(result.code).toBe('SYNTAX_ERROR');
  });
});
