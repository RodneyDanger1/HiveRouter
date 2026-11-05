import fs from 'node:fs';
import path from 'node:path';

export interface PublishedTree {
  backup: string;
  hadRoot: boolean;
}

/**
 * Publish a fully-built directory by renaming the old tree aside and the new
 * tree into place. This removes the "partially written workspace" window for
 * readers: a workspace either contains the previous tree or the complete new
 * tree. The backup is retained until the caller commits its DB/vault side
 * effects, so a failure can restore the previous tree.
 */
export function atomicPublishDirectory(root: string, publish: string, backup: string): PublishedTree {
  const parent = path.dirname(root);
  fs.mkdirSync(parent, { recursive: true });
  if (!fs.existsSync(publish)) throw new Error('E_FINALIZE_PUBLISH_MISSING');
  if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
  const hadRoot = fs.existsSync(root);
  if (hadRoot) fs.renameSync(root, backup);
  try {
    fs.renameSync(publish, root);
  } catch (error) {
    if (hadRoot && fs.existsSync(backup) && !fs.existsSync(root)) {
      try {
        fs.renameSync(backup, root);
      } catch {
        // preserve the original publish failure; recovery will handle leftovers
      }
    }
    throw error;
  }
  return { backup, hadRoot };
}

/** Undo a published tree after a post-publish DB/vault failure. */
export function rollbackPublishedDirectory(root: string, published: PublishedTree): void {
  try {
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
    if (published.hadRoot && fs.existsSync(published.backup)) fs.renameSync(published.backup, root);
  } catch {
    // Never mask the original commit failure; startup recovery can still help.
  }
}

/**
 * Recover workspaces interrupted between the two directory renames. Called
 * once at startup, before any executor can touch a run workspace.
 */
export function recoverFinalizeDirectories(runsRoot: string): number {
  if (!fs.existsSync(runsRoot)) return 0;
  let recovered = 0;
  const entries = fs
    .readdirSync(runsRoot, { withFileTypes: true })
    .sort((a, b) => {
      const rank = (name: string): number => name.includes('.publish-') ? 0 : name.includes('.old-') ? 1 : 2;
      return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
    });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = /^(.*)\.(publish|old)-[a-z0-9]+$/i.exec(entry.name);
    if (!match) continue;
    const base = match[1];
    const root = path.join(runsRoot, base);
    const candidate = path.join(runsRoot, entry.name);
    if (!fs.existsSync(root)) {
      // Prefer a complete publish directory; otherwise restore the prior tree.
      const publishManifest = path.join(candidate, 'manifest.json');
      if (match[2].toLowerCase() === 'publish' && fs.existsSync(publishManifest)) {
        fs.renameSync(candidate, root);
        recovered += 1;
      } else if (match[2].toLowerCase() === 'old') {
        fs.renameSync(candidate, root);
        recovered += 1;
      }
      continue;
    }
    // A live root wins; leftovers are stale.
    fs.rmSync(candidate, { recursive: true, force: true });
    recovered += 1;
  }
  return recovered;
}
