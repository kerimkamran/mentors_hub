#!/usr/bin/env python3
"""Generate spec/08-traceability.md from the specification sources.

    python3 spec/tools/gen_traceability.py          # (re)write the file
    python3 spec/tools/gen_traceability.py --check  # fail if the file is out of date (CI)

The matrix is GENERATED and must never be edited by hand (Plan §9).
Columns: requirement -> story -> acceptance criteria -> screen -> test.
The test column stays empty until tests exist; tests reference AC ids.
"""
import re
import sys
from collections import defaultdict
from pathlib import Path

SPEC = Path(__file__).resolve().parent.parent
OUT = SPEC / "08-traceability.md"


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


# ---- requirements ---------------------------------------------------------
prd = read(SPEC / "01-prd" / "README.md")
requirements = {}  # id -> text
area_titles = {}
current_area = ""
for line in prd.splitlines():
    h = re.match(r"### 5\.\d+ (.+?) — `([A-Z]+)`", line)
    if h:
        current_area = h.group(2)
        area_titles[current_area] = h.group(1)
    m = re.match(r"\|\s*(FR-[A-Z]+-\d{3})\s*\|\s*(.*?)\s*\|\s*[^|]*\|\s*$", line)
    if m:
        requirements[m.group(1)] = m.group(2)

# ---- stories --------------------------------------------------------------
stories = {}
for sf in sorted(f for d in ("06-stories-participant", "09-stories-admin") for f in (SPEC / d).glob("*.md")):
    parts = re.split(r"^### (US-[A-Z]+-\d{2}) · ", read(sf), flags=re.M)
    for sid, body in zip(parts[1::2], parts[2::2]):
        req = re.search(r"\*\*Requirements:\*\*\s*([^·\n]*)", body)
        scr = re.search(r"\*\*Screens:\*\*\s*([^·\n]*)", body)
        slc = re.search(r"\*\*Slice:\*\*\s*([^\n]*)", body)
        stories[sid] = {
            "title": re.match(r"([^\n]*)", body).group(1).strip(),
            "file": sf.name,
            "frs": re.findall(r"(?<![A-Z])FR-[A-Z]+-\d{3}", req.group(1)) if req else [],
            "scrs": re.findall(r"SCR-\d{2}", scr.group(1)) if scr else [],
            "slice": slc.group(1).strip() if slc else "",
            "acs": re.findall(r"^\|\s*(AC-[A-Z]+-\d{2}\.\d+)\s*\|", body, re.M),
        }

screens = {}
for scr_file in ("07-screens-participant.md", "10-screens-admin.md"):
    for m in re.finditer(r"^### (SCR-\d{2}) · (.+)$", read(SPEC / scr_file), re.M):
        screens[m.group(1)] = m.group(2).strip()

# ---- indexes --------------------------------------------------------------
fr_to_stories = defaultdict(list)
for sid, s in stories.items():
    for fr in s["frs"]:
        fr_to_stories[fr].append(sid)
scr_to_stories = defaultdict(list)
for sid, s in stories.items():
    for sc in s["scrs"]:
        scr_to_stories[sc].append(sid)


def short(t: str, n: int = 110) -> str:
    t = re.sub(r"\s+", " ", t.replace("|", "/"))
    t = re.sub(r"\*\*|\[PROPOSED\]", "", t).strip()
    return t if len(t) <= n else t[: n - 1].rstrip() + "…"


lines = []
w = lines.append
w("# Traceability matrix")
w("")
w("> **GENERATED FILE — do not edit by hand.** Regenerate with `python3 spec/tools/gen_traceability.py`; CI runs it with `--check`.")
w("")
covered = [fr for fr in requirements if fr_to_stories.get(fr)]
uncovered = [fr for fr in requirements if not fr_to_stories.get(fr)]
total_acs = sum(len(s["acs"]) for s in stories.values())
w("| Measure | Count |")
w("|---|---|")
w(f"| Functional requirements | {len(requirements)} |")
w(f"| …covered by at least one story (participant or admin) | {len(covered)} |")
w(f"| …not yet covered (system behaviour, Batch 3 part B, or later) | {len(uncovered)} |")
w(f"| Stories (participant + admin) | {len(stories)} |")
w(f"| Acceptance criteria | {total_acs} |")
w(f"| Screens (participant + admin) | {len(screens)} |")
w("")
w("Chain: **BRD/Plan requirement → FR → story → acceptance criteria → screen → test**. The test column is empty until the test suite exists; each test cites AC ids.")
w("")

w("## 1. Requirement → story → criteria → screens")
w("")
w("| FR | Requirement | Stories | Acceptance criteria | Screens | Tests |")
w("|---|---|---|---|---|---|")
for fr, text in requirements.items():
    ss = fr_to_stories.get(fr, [])
    ac_ids = [a for s in ss for a in stories[s]["acs"]]
    scr_ids = sorted({sc for s in ss for sc in stories[s]["scrs"]})
    acs_cell = f"{len(ac_ids)} ({ac_ids[0]}…)" if len(ac_ids) > 1 else (ac_ids[0] if ac_ids else "—")
    w(f"| {fr} | {short(text)} | {', '.join(ss) or '—'} | {acs_cell} | {', '.join(scr_ids) or '—'} | — |")
w("")

w("## 2. Stories")
w("")
w("| Story | Title | Requirements | Screens | Slice | ACs |")
w("|---|---|---|---|---|---|")
for sid, s in stories.items():
    w(f"| {sid} | {short(s['title'], 70)} | {', '.join(s['frs'])} | {', '.join(s['scrs'])} | {short(s['slice'], 40)} | {len(s['acs'])} |")
w("")

w("## 3. Screens")
w("")
w("| Screen | Name | Stories |")
w("|---|---|---|")
for sc, name in screens.items():
    w(f"| {sc} | {short(name, 70)} | {', '.join(scr_to_stories.get(sc, []))} |")
w("")

w("## 4. Requirements without a story yet")
w("")
by_area = defaultdict(list)
for fr in uncovered:
    by_area[fr.split("-")[1]].append(fr)
w("Expected: Batch 3 part B (programme creation, people import admin, vetting, matching admin, safeguarding, content), system rules enforced by invariants, and NFR-like requirements. Each must be covered by a story, an invariant test, or an NFR check before its slice's gate.")
w("")
for area, frs in by_area.items():
    w(f"- **{area}** ({area_titles.get(area, '')}): {', '.join(frs)}")
w("")

content = "\n".join(lines) + "\n"

if "--check" in sys.argv:
    if not OUT.exists() or read(OUT) != content:
        print("08-traceability.md is out of date — run: python3 spec/tools/gen_traceability.py")
        sys.exit(1)
    print("traceability OK")
else:
    OUT.write_text(content, encoding="utf-8")
    print(f"wrote {OUT.relative_to(SPEC.parent)}: {len(requirements)} FRs, {len(stories)} stories, {total_acs} ACs, {len(covered)} FRs covered")
