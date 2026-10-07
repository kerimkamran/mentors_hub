#!/usr/bin/env python3
"""Consistency checks for the Mentorship Hub specification (Batch 1).

Run from the repository root:   python3 spec/tools/check_spec.py
Exits non-zero if any check fails. Intended to run in CI next to the
generated traceability matrix.

Checks
  1. Matching weights sum to 100 for every programme column (constants §5).
  2. Every constant ID (C-nnn) is defined exactly once and every reference resolves.
  3. Every PROPOSED constant has an open-question entry.
  4. FR / NFR / GL / N- / OQ-B1- IDs are unique where defined and every reference resolves.
  5. Relative markdown links point to files that exist.
"""
import re
import sys
from collections import Counter
from pathlib import Path

SPEC = Path(__file__).resolve().parent.parent
# 08-traceability.md is generated from the other files; it is excluded here and
# verified separately by `gen_traceability.py --check`.
FILES = sorted(p for p in SPEC.rglob("*.md") if p.name != "08-traceability.md")
errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


constants_path = SPEC / "01-prd" / "constants.md"
oq_path = SPEC / "01-prd" / "open-questions-batch1.md"
constants = read(constants_path)
oq = read(oq_path)

# ---- 1. weights -----------------------------------------------------------
m = re.search(r"## 5\. Matching weights.*?(?=\n## )", constants, re.S)
if not m:
    fail("constants.md: section 5 (matching weights) not found")
else:
    rows = [r for r in m.group(0).splitlines() if r.startswith("|")]
    header = [c.strip() for c in rows[0].strip("|").split("|")]
    cols = {name: 0 for name in header[1:4]}  # Open, Leadership, SparkLab
    for r in rows[2:]:
        cells = [c.strip() for c in r.strip("|").split("|")]
        if cells[0].startswith("**Total"):
            continue
        for i, name in enumerate(header[1:4], start=1):
            cols[name] += int(cells[i])
    for name, total in cols.items():
        if total != 100:
            fail(f"constants.md: weights for {name} sum to {total}, expected 100")

# ---- 2. constants ---------------------------------------------------------
defined = Counter()
for line in constants.splitlines():
    mm = re.match(r"\|\s*(C-\d{3})\s*\|", line)
    if mm:
        defined[mm.group(1)] += 1
# weights columns are defined in prose: "IDs: `C-070` ... `C-071` ... `C-072`"
for cid in ("C-070", "C-071", "C-072"):
    if cid in constants:
        defined[cid] += 1
for cid, n in defined.items():
    if n != 1:
        fail(f"constants.md: {cid} defined {n} times")
for p in FILES:
    for cid in set(re.findall(r"\bC-\d{3}\b", read(p))):
        if cid not in defined:
            fail(f"{p.relative_to(SPEC)}: reference to undefined constant {cid}")

# ---- 3. PROPOSED constants need an OQ ------------------------------------
for line in constants.splitlines():
    mm = re.match(r"\|\s*(C-\d{3})\s*\|", line)
    if mm and "PROPOSED" in line and mm.group(1) not in oq:
        fail(f"constants.md: {mm.group(1)} is PROPOSED but has no entry in open-questions-batch1.md")

# ---- 3b. every PROPOSED constant is an admin setting (or explicitly not) --
sec0 = re.search(r"## 0\. Admin-configurable settings(.*?)\n## 1\. ", constants, re.S)
if not sec0:
    fail("constants.md: section 0 (admin-configurable settings) not found")
else:
    named = set()
    body0 = sec0.group(1)
    for a, b in re.findall(r"(C-\d{3})\s*(?:…|–|-)\s*(C-\d{3})", body0):
        named.update(f"C-{n:03d}" for n in range(int(a[2:]), int(b[2:]) + 1))
    named.update(re.findall(r"C-\d{3}", body0))
    for cid in re.findall(r"C-\d{3}", body0):
        if cid not in defined:
            fail(f"constants.md §0 names undefined constant {cid}")
    for line in constants.splitlines():
        mm = re.match(r"\|\s*(C-\d{3})\s*\|", line)
        if mm and "PROPOSED" in line and mm.group(1) not in named:
            fail(f"constants.md: {mm.group(1)} is PROPOSED but not covered by §0 (admin setting or explicit exclusion)")

# ---- 4. ID uniqueness / resolution ---------------------------------------
all_text = {p: read(p) for p in FILES}


def defined_ids(pattern: str, path_filter=None):
    seen = Counter()
    for p, t in all_text.items():
        if path_filter and not path_filter(p):
            continue
        for line in t.splitlines():
            mm = re.match(pattern, line)
            if mm:
                seen[mm.group(1)] += 1
    return seen


groups = {
    "FR": (r"\|\s*(FR-[A-Z]+-\d{3})\s*\|", r"\bFR-[A-Z]+-\d{3}\b"),
    "NFR": (r"\|\s*(NFR-[A-Z0-9]+-\d{3})\s*\|", r"\bNFR-[A-Z0-9]+-\d{3}\b"),
    "GL": (r"\|\s*(GL-\d{3})\s*\|", r"\bGL-\d{3}\b"),
    "N": (r"\|\s*(N-\d{3})\s*\|", r"\bN-\d{3}\b"),
    "OQ": (r"\|\s*(OQ-B1-\d{2})\s*\|", r"\bOQ-B1-\d{2}\b"),
}
for label, (def_pat, ref_pat) in groups.items():
    defs = defined_ids(def_pat)
    for i, n in defs.items():
        if n != 1:
            fail(f"{label}: {i} defined {n} times")
    for p, t in all_text.items():
        for ref in set(re.findall(ref_pat, t)):
            if ref not in defs:
                fail(f"{p.relative_to(SPEC)}: reference to undefined {label} id {ref}")

# ---- 5. relative links ---------------------------------------------------
for p, t in all_text.items():
    for target in re.findall(r"\]\(([^)#\s]+)(?:#[^)]*)?\)", t):
        if re.match(r"[a-z]+://", target) or target.startswith("mailto:"):
            continue
        if not (p.parent / target).resolve().exists():
            fail(f"{p.relative_to(SPEC)}: broken link {target}")

# ---- 6. Batch 2: stories, acceptance criteria, screens -------------------
STORY_DIRS = [SPEC / "06-stories-participant", SPEC / "09-stories-admin"]
SCREEN_FILES = [SPEC / "07-screens-participant.md", SPEC / "10-screens-admin.md"]
story_files = sorted(f for d in STORY_DIRS if d.exists() for f in d.glob("*.md"))
stories = {}  # id -> dict
acs = Counter()
if story_files:
    fr_defined = defined_ids(groups["FR"][0])
    screens_defined = set()
    for SCREENS in SCREEN_FILES:
        if SCREENS.exists():
            found = re.findall(r"^### (SCR-\d{2}) ", read(SCREENS), re.M)
            for sc in found:
                if sc in screens_defined:
                    fail(f"{SCREENS.name}: screen {sc} defined twice")
            screens_defined |= set(found)
        else:
            fail(f"{SCREENS.name} is missing")
    referenced_screens = set()
    for sf in story_files:
        text = read(sf)
        parts = re.split(r"^### (US-[A-Z]+-\d{2}) · ", text, flags=re.M)
        # parts: [preamble, id1, body1, id2, body2, ...]
        for sid, body in zip(parts[1::2], parts[2::2]):
            if sid in stories:
                fail(f"{sf.name}: story {sid} defined twice")
            area, num = sid.split("-")[1], sid.split("-")[2]
            rows = re.findall(r"^\|\s*(AC-[A-Z]+-\d{2}\.\d+)\s*\|(.*)\|\s*([PN])\s*\|\s*$", body, re.M)
            req = re.search(r"\*\*Requirements:\*\*\s*([^·\n]*)", body)
            scr = re.search(r"\*\*Screens:\*\*\s*([^·\n]*)", body)
            stories[sid] = {
                "file": sf.name,
                "title": re.match(r"([^\n]*)", body).group(1).strip(),
                "frs": re.findall(r"(?<![A-Z])FR-[A-Z]+-\d{3}", req.group(1)) if req else [],
                "scrs": re.findall(r"SCR-\d{2}", scr.group(1)) if scr else [],
                "acs": [(a, k) for a, _, k in rows],
            }
            s = stories[sid]
            if not s["frs"]:
                fail(f"{sid}: no requirements listed")
            for fr in s["frs"]:
                if fr not in fr_defined:
                    fail(f"{sid}: unknown requirement {fr}")
            if not s["scrs"]:
                fail(f"{sid}: no screens listed")
            for sc in s["scrs"]:
                referenced_screens.add(sc)
                if sc not in screens_defined:
                    fail(f"{sid}: unknown screen {sc}")
            n = len(s["acs"])
            if not 3 <= n <= 6:
                fail(f"{sid}: has {n} acceptance criteria, expected 3-6")
            if not any(k == "N" for _, k in s["acs"]):
                fail(f"{sid}: no negative/permission (N) acceptance criterion")
            for a, _ in s["acs"]:
                acs[a] += 1
                if not a.startswith(f"AC-{area}-{num}."):
                    fail(f"{sid}: AC id {a} does not match story id")
            # every AC row in the body must have parsed (catches malformed rows)
            raw_rows = re.findall(r"^\|\s*AC-", body, re.M)
            if len(raw_rows) != n:
                fail(f"{sid}: {len(raw_rows) - n} malformed acceptance-criterion row(s)")
    for a, c in acs.items():
        if c != 1:
            fail(f"AC id {a} defined {c} times")
    for sc in screens_defined - referenced_screens:
        fail(f"{sc}: screen not referenced by any story")
    # every US-/AC-/SCR- reference anywhere must resolve
    for p, t in all_text.items():
        for ref in set(re.findall(r"\bUS-[A-Z]+-\d{2}\b", t)):
            if ref not in stories:
                fail(f"{p.relative_to(SPEC)}: reference to undefined story {ref}")
        for ref in set(re.findall(r"\bAC-[A-Z]+-\d{2}\.\d+\b", t)):
            if ref not in acs:
                fail(f"{p.relative_to(SPEC)}: reference to undefined acceptance criterion {ref}")
        for ref in set(re.findall(r"\bSCR-\d{2}\b", t)):
            if ref not in screens_defined:
                fail(f"{p.relative_to(SPEC)}: reference to undefined screen {ref}")

# ---- report --------------------------------------------------------------
if errors:
    print(f"{len(errors)} problem(s):")
    for e in errors:
        print(" -", e)
    sys.exit(1)

print("spec OK:",
      f"{len(defined)} constants,",
      f"{len(defined_ids(groups['FR'][0]))} functional requirements,",
      f"{len(defined_ids(groups['NFR'][0]))} NFRs,",
      f"{len(defined_ids(groups['GL'][0]))} glossary terms,",
      f"{len(defined_ids(groups['N'][0]))} notifications,",
      f"{len(defined_ids(groups['OQ'][0]))} open questions,",
      f"{len(stories)} stories, {len(acs)} acceptance criteria")
