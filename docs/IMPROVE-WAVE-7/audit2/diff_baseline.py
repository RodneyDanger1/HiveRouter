import difflib, hashlib, pathlib, sys

repo = pathlib.Path(r"C:\Users\Riley\Desktop\HiveRouter")
out = repo / "docs" / "IMPROVE-WAVE-7" / "audit2"
pairs = [
    ("src/server/runs/recorder.ts", "docs/IMPROVE-WAVE-7/backup/src/server/runs/recorder.ts"),
    ("web/src/pages/RunsPage.tsx", "docs/IMPROVE-WAVE-7/backup/web/src/pages/RunsPage.tsx"),
    ("web/src/pages/SettingsPage.tsx", "docs/IMPROVE-WAVE-7/backup/web/src/pages/SettingsPage.tsx"),
    ("web/src/api.ts", "docs/IMPROVE-WAVE-7/backup/web/src/api.ts"),
    ("e2e/ui-audit.spec.ts", "docs/IMPROVE-WAVE-7/backup/e2e/ui-audit.spec.ts"),
]

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest().upper()

all_diff = []
summary = []
for cur_rel, base_rel in pairs:
    cur = repo / cur_rel
    base = repo / base_rel
    a = base.read_text(encoding="utf-8").splitlines(keepends=True)
    b = cur.read_text(encoding="utf-8").splitlines(keepends=True)
    diff = list(difflib.unified_diff(a, b, fromfile=base_rel, tofile=cur_rel, n=3))
    all_diff.extend(diff)
    added = sum(1 for l in diff if l.startswith("+") and not l.startswith("+++"))
    removed = sum(1 for l in diff if l.startswith("-") and not l.startswith("---"))
    summary.append((cur_rel, sha(cur), sha(base), added, removed))

(out / "diff-vs-baseline.txt").write_text("".join(all_diff), encoding="utf-8")
lines = ["file\tcurrent_sha256\tbaseline_sha256\tadded_lines\tremoved_lines"]
lines += [f"{f}\t{c}\t{b}\t{a}\t{r}" for f, c, b, a, r in summary]
(out / "diff-summary.tsv").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
print("\nTOTAL added", sum(s[3] for s in summary), "removed", sum(s[4] for s in summary))
