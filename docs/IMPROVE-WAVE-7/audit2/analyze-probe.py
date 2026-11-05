import json, collections, pathlib

p = pathlib.Path(r"C:\Users\Riley\Desktop\HiveRouter\docs\IMPROVE-WAVE-7\audit2\probe-cas.out.json")
data = json.loads(p.read_text(encoding="utf-8-sig"))
print("matrixSummary:", json.dumps(data["matrixSummary"]))
print("matrixMismatches:", len(data.get("matrixMismatches") or []))
for m in data.get("matrixMismatches") or []:
    print("  MISMATCH", json.dumps(m, sort_keys=True))

print("\nresults:", len(data["results"]))
for r in data["results"]:
    err = r.get("error")
    print(
        f"- {r.get('case')} | outcome={r.get('outcome')}"
        + (f" | code={err.get('code')} kind={err.get('transitionKind')} from={err.get('from')} to={err.get('to')}" if err else "")
        + (f" | row={r.get('row', {}).get('status')}/{r.get('row', {}).get('phase')}" if isinstance(r.get('row'), dict) else "")
        + (f" | injected={r.get('injected')} competitorChanges={r.get('competitorChanges')} preserved={r.get('preservedCompetitorStatus')} codeMatches={r.get('codeMatches')}" if 'injected' in r else "")
        + (f" | unchanged={r.get('unchanged')}" if 'unchanged' in r else "")
    )

# Assertions the auditor cares about
by_case = {r.get("case"): r for r in data["results"]}
print("\nKEY ASSERTIONS")
def check(name, cond, detail):
    print(("PASS " if cond else "FAIL ") + name + " :: " + detail)

mism = data.get("matrixMismatches") or []
check("status-edge matrix 100/100", data["matrixSummary"]["total"] == 100 and not mism,
      f"total={data['matrixSummary']['total']} mismatches={len(mism)}")
for r in data["results"]:
    c = r.get("case", "")
    if c.startswith("terminal ") and "must reject" in c:
        check(c, r.get("outcome") == "threw" and r.get("unchanged") is True,
              f"outcome={r.get('outcome')} unchanged={r.get('unchanged')} code={r.get('error',{}).get('code')}")
for r in data["results"]:
    c = r.get("case", "")
    if "phase rule" in c:
        check(c, r.get("outcome") == r.get("expected"),
              f"expected={r.get('expected')} outcome={r.get('outcome')} code={r.get('error',{}).get('code')}")
for r in data["results"]:
    c = r.get("case", "")
    if c.startswith("CAS:"):
        check(c, r.get("outcome", "").startswith("threw") and r.get("preservedCompetitorStatus") is True and r.get("codeMatches") is True,
              f"outcome={r.get('outcome')} preserved={r.get('preservedCompetitorStatus')} code={r.get('error',{}).get('code')} injected={r.get('injected')}")
