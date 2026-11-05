import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { atomicPublishDirectory, recoverFinalizeDirectories, rollbackPublishedDirectory } from '../../src/server/runs/publish.js';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-publish-'));
  dirs.push(dir);
  return dir;
}

describe('whole-tree publish', () => {
  it('replaces the prior tree with the complete staged tree', () => {
    const parent = tempDir();
    const root = path.join(parent, 'run_x');
    const publish = path.join(parent, 'run_x.publish-abc');
    const backup = path.join(parent, 'run_x.old-abc');
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(root, 'old.txt'), 'old');
    fs.mkdirSync(publish);
    fs.writeFileSync(path.join(publish, 'new.txt'), 'new');
    fs.writeFileSync(path.join(publish, 'manifest.json'), '{"ok":true}');

    const published = atomicPublishDirectory(root, publish, backup);

    expect(fs.existsSync(path.join(root, 'new.txt'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'old.txt'))).toBe(false);
    expect(fs.existsSync(published.backup)).toBe(true);
    fs.rmSync(published.backup, { recursive: true, force: true });
  });

  it('restores the previous tree when a post-publish commit fails', () => {
    const parent = tempDir();
    const root = path.join(parent, 'run_r');
    const publish = path.join(parent, 'run_r.publish-abc');
    const backup = path.join(parent, 'run_r.old-abc');
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(root, 'prior.txt'), 'prior');
    fs.mkdirSync(publish);
    fs.writeFileSync(path.join(publish, 'new.txt'), 'new');

    const published = atomicPublishDirectory(root, publish, backup);
    rollbackPublishedDirectory(root, published);

    expect(fs.existsSync(path.join(root, 'prior.txt'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'new.txt'))).toBe(false);
  });

  it('recovers a prior tree when a crash left the root renamed aside', () => {
    const runs = tempDir();
    const root = path.join(runs, 'run_y');
    const old = path.join(runs, 'run_y.old-deadbeef');
    fs.mkdirSync(old);
    fs.writeFileSync(path.join(old, 'prior.txt'), 'prior');
    recoverFinalizeDirectories(runs);
    expect(fs.readFileSync(path.join(root, 'prior.txt'), 'utf8')).toBe('prior');
    expect(fs.existsSync(old)).toBe(false);
  });

  it('promotes a complete publish tree when the root is absent', () => {
    const runs = tempDir();
    const publish = path.join(runs, 'run_z.publish-deadbeef');
    fs.mkdirSync(publish);
    fs.writeFileSync(path.join(publish, 'manifest.json'), '{"ok":true}');
    fs.writeFileSync(path.join(publish, 'new.txt'), 'new');
    recoverFinalizeDirectories(runs);
    expect(fs.readFileSync(path.join(runs, 'run_z', 'new.txt'), 'utf8')).toBe('new');
  });
});
