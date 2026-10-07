# Matching specification

**Applies to:** FR-MAT-001 to FR-MAT-017 · Plan §5 principle 7, §7 · decision D10
**Constants:** all numbers are referenced as `C-nnn` from [constants.md](constants.md).

The matching engine is a **pure function**. It takes a snapshot of inputs and returns a ranked, explained list of candidates. It never reads the clock, a random source, the network or the database; the caller assembles the snapshot. It contains no AI.

---

## 1. Pipeline

```
 Snapshot ──► 1. Eligibility pool ──► 2. Hard exclusions ──► 3. Scoring ──► 4. Ranking ──► 5. Explanation ──► Result
```

| Step | Input | Output |
|---|---|---|
| 1. Eligibility pool | Seeker (mentee or team), all mentors in the programme | Candidates: approved, minimum-profile, with capacity data |
| 2. Hard exclusions | Candidates, programme exclusion switches (C-080…C-092) | Retained candidates + for each removed candidate an *internal* exclusion code (PM view only) |
| 3. Scoring | Retained candidates, programme weights (C-070…C-072) | Per-criterion sub-scores (0–1) and total (0–100) |
| 4. Ranking | Scored candidates | Total order |
| 5. Explanation | Ranked candidates, candidate pool | Up to 3 reasons per candidate, per viewer type |

### 1.1 Snapshot

Fields the engine may read — and *only* these:

| Group | Field | Visible to others? | Notes |
|---|---|---|---|
| Identity | person id, organisation id | — | organisation must be identical for seeker and mentor |
| Mentor | approval status, minimum-profile flag, capacity, current load | status/capacity yes | |
| Topics | mentor topics with depth; mentee goal tags (shared goals only) | per field visibility | |
| Availability | mentor recurring rules; mentee windows; team members' windows | per field | |
| Language | languages and proficiency | per field | |
| Interests | curated interest tags | per field | |
| Questionnaire | Leadership compatibility answers | per field | |
| **HR input 1** | **grade bucket** | **never displayed** | declared input |
| **HR input 2** | **reporting line** (manager id, skip-level, shared manager) | **never displayed** | declared input |
| Relationship history | blocks; previous and declined matches (pairs, dates) | no | |
| Programme | type, **matching settings version** (all numeric parameters: factors, sub-scores, thresholds, weights, exclusion switches, horizon), `as_of` date | — | `as_of` is supplied by the caller, never read from a clock; parameters are inputs, never read from storage by the engine (FR-MAT-018) |

Anything not in this table — including private profile fields, private notes, goal titles not shared, and session history — **must not** be readable by the engine. This is enforced by the type of the snapshot (the engine receives a typed object, not a database handle), and by property test **MT-P5**.

## 2. Candidate pool (step 1)

A mentor is in the pool only if all hold:

1. Approved mentor in this programme (D9; Open: approved by PM).
2. Minimum profile met (C-032).
3. Same organisation as the seeker.

A mentor failing (1) is an exclusion code `NOT_APPROVED` ("Never" overridable). Failing (2) means *not recommendable*: they remain browsable only if the PM marks them so; a PM can still match them manually with an audited reason **[PROPOSED]** (OQ-B1-14).

## 3. Hard exclusions (step 2)

Evaluated for every seeker–mentor pair *before* any scoring. For a team, evaluated for **every member** against the mentor; one member triggering an exclusion excludes the pair.

| Code | Condition | Overridable | Constant |
|---|---|---|---|
| `SAME_PERSON` | seeker = mentor | Never | C-080 |
| `BLOCKED` | either party blocked the other | Never | C-081 |
| `NOT_APPROVED` | mentor not approved | Never | C-082 |
| `ELIGIBILITY` | seeker or mentor fails programme eligibility rule | PM, audited reason | C-083 |
| `INCOMPATIBLE_HISTORY` | existing or previous relationship marked incompatible | PM | C-084 |
| `DECLINED_RECENTLY` | a match for the same pair was declined within C-004 | PM | C-085 |
| `REPORTING_LINE` | mentor is seeker's direct manager or skip-level (or the reverse) | PM | C-086 |
| `REPORTING_PEER` | share a manager (Leadership only by default) | PM | C-087 |
| `MENTOR_JUNIOR` | mentor's grade bucket is lower than the mentee's | PM | C-088 |
| `NO_LANGUAGE` | no language at working-or-fluent level for both | PM | C-089 |
| `NO_AVAILABILITY` | no slot overlap in a standard 4-week horizon | PM | C-090 |
| `CAPACITY_FULL` | mentor load ≥ capacity (C-021 / C-022) | PM | C-091 |
| `ALREADY_MATCHED` | seeker already has an accepted or pending match in this programme | PM | C-092 |

**Rules**

1. Exclusion codes are internal. The only thing a user ever sees is the neutral line: *"Not available for requests in this programme."* (FR-MAT-003). No code, count or reason is exposed to mentees or mentors.
2. A programme's switches may turn the overridable exclusions on or off (FR-PRG-011); the three "Never" exclusions are always on.
3. An override is a PM action that requires a reason (free text, at least C-152 characters), is written to the audit log by id and code only (no free text, Principle 3), and the reason itself is stored in the PM-visible override record. Each override applies to one seeker–mentor pair and one programme.
4. `NO_AVAILABILITY` is evaluated on the horizon C-150 from `as_of` (admin-managed).
5. Publishing a draft re-checks every pair (FR-MAT-009). A pair that now fails a non-overridden exclusion blocks publishing for that pair only.

## 4. Scoring (step 3)

**Every number in this section is an admin-managed setting** (see [constants §0](constants.md)); the values quoted are starting defaults. The engine receives them in the snapshot as the programme's *matching settings version*, so the output remains a pure function of its input (INV-7.1) and an old match can always be explained with the parameters it was scored with.

Total score:

```
total = Σ over criteria  weight_i × subscore_i          (weights sum to 100, subscore_i ∈ [0, 1])
```

A programme with weight 0 for a criterion never reads that criterion's fields (property **MT-P2**).

Missing data: if the **mentee/team** has not provided the data for a criterion, `subscore = C-057` (0.50). If the **mentor** has not, `subscore = C-058` (0.00). (If both, mentor rule wins: 0.00.)

### 4.1 Goal alignment

Mentee's *shared* goals, each with taxonomy tags. Let goal *g* have weight `w_g = C-051` if primary, else 1.

```
coverage(g) = |tags of g covered by mentor topics| / |tags of g|
   where a tag counts 1.0 if the mentor has the tag (after synonym normalisation),
         C-052 (0.5) if the mentor has its parent or a child tag in the taxonomy, otherwise 0.
subscore = Σ_g w_g × coverage(g) / Σ_g w_g
```

If the mentee has shared no goals → neutral.

### 4.2 Expertise

Let *N* be the set of topics the seeker is seeking (the tags from shared goals; for a team, the **team's needed expertise**).

```
for each tag n ∈ N:  cov(n) × depth(n)
   cov = 1.0 / C-052 / 0 as in 4.1
   depth = C-050 factor for the mentor's declared depth for that tag (working / advanced / expert)
subscore = Σ_n cov(n) × depth(n) / |N|
```

### 4.3 Availability

`days` = number of days per week having at least one slot suitable for both parties on the generated slot grid. For a team, a slot counts only if the team lead and ≥ 60% of members are free (C-027).

```
subscore = min(days, C-053) / C-053
```

### 4.4 Career level

Using grade buckets (never numbers). Let `gap = mentor_bucket − mentee_bucket`.

| Gap | Band | Sub-score |
|---|---|---|
| 1 or 2 | ahead | 1.00 |
| 0 | peer | 0.60 |
| ≥ 3 | far | 0.40 |
| < 0 | mentor-junior (only reachable when `MENTOR_JUNIOR` is off or overridden) | 0.30 |

For a team the seeker's bucket is the team lead's.

### 4.5 Language

Best shared language by proficiency of the weaker party: both fluent → 1.00; otherwise working → 0.70 (C-056). No shared language → exclusion (`NO_LANGUAGE`) unless overridden, then sub-score 0.

### 4.6 Interests

```
subscore = |mentee_interests ∩ mentor_interests| / |mentee_interests ∪ mentor_interests|     (Jaccard)
```

Empty union → neutral (mentee side) or 0 (mentor side) per the missing-data rule.

### 4.7 Other (compatibility questionnaire)

Used by Leadership (weight 20). The questionnaire has three sections — **character**, **field**, **experience** — each with questions configured by the PM as `similar` (score = 1 − |a − b| / range) or `complementary` (score = |a − b| / range) **[PROPOSED]** (OQ-B1-16). Section score is the mean of its questions; subscore is the mean of the three section scores. The engine reads only answers that the person marked as available to matching.

For Open, the weight 5 uses the optional short compatibility questions if the PM enabled them; otherwise it is "missing → neutral".

### 4.8 SparkLab team additions

Replaces the seeker with the team (FR-MAT-016):

- **Needed expertise** is a list of taxonomy tags set by the team lead/PM; it takes the place of goal tags in 4.1/4.2.
- **Phase experience:** the team's current phase (develop, design, test). The mentor's declared phase experience adds a multiplier on the Expertise sub-score: `×1.0` if the mentor has the team's phase, `×0.8` otherwise **[PROPOSED]** (OQ-B1-17). Capped at 1.
- **Capacity:** a team consumes one unit (C-022); a mentor's default cap is two teams (C-021).
- **Exclusions:** evaluated for every member (§3).

## 5. Ranking (step 4)

Candidates are ordered by:

1. `total` descending (compared at C-061 precision),
2. tie-break 1: fewer current accepted relationships (lower load first),
3. tie-break 2: higher Goal alignment sub-score,
4. tie-break 3: mentor's `person_id` ascending (stable, opaque id — not alphabetical name, so output never depends on locale or name).

The order of candidates in the input never affects output (**MT-P3**).

**Open mode.** *Recommended* = first 5 in ranking (C-024). *Browse* = all candidates not excluded, filterable, ordered by the same ranking by default.

**Admin draft ("Generate draft").** For Leadership/SparkLab the draft assigns seekers to mentors by a deterministic greedy pass **[PROPOSED]** (OQ-B1-18):

1. Process seekers in ascending order of number of non-excluded candidates (fewest options first), then by `person_id`.
2. Assign each seeker to their top-ranked mentor with remaining capacity.
3. Seekers with no available mentor are left unmatched and listed.

The draft is a *proposal*. A PM reviews, edits, and publishes. Fully automatic optimisation is out of scope (§14).

## 6. Explanations (step 5)

Per candidate, for each viewer type:

| Viewer | Content |
|---|---|
| **Mentee (or team lead)** | Up to C-034 (3) plain reasons; **no percentages, no scores, no weights** |
| **Mentor** | Topic labels only. Never the mentee's goal titles unless the mentee shared a goal in the request (FR-MAT-011) |
| **PM** | Full breakdown: each criterion sub-score, weight, contribution, rank, engine version, exclusion codes and overrides |

**Reason selection (mentee view)**

1. For each criterion with weight > 0 produce a *candidate reason* if its sub-score ≥ C-059 (0.60) **and** the underlying data is visible to the viewer.
2. Drop a reason that is true for ≥ C-060 (90%) of the scored pool — it does not help the person choose.
3. Order remaining reasons by `weight × subscore` descending; ties by fixed criterion order (goal, expertise, availability, career, language, interests, other).
4. Keep the top 3.
5. If none remain, show a single generic line ("A good overall fit for your goals") — never an empty explanation. **[PROPOSED]** wording; localised.

**Templates.** Each reason is an ICU message with typed parameters (names, counts, topic labels, language names, years). Examples, all in the viewer's language:

| Criterion | English template |
|---|---|
| Goal alignment | "Has worked on {topic}, your first goal" |
| Expertise | "{years} years {experience_phrase}" |
| Availability | "Free on {count, plural, one {# day} other {# days}} a week" |
| Language | "You can meet in {languages}" |
| Career level | "Is {band_phrase} in their career" |
| Interests | "You share an interest in {interest}" |

Russian uses three plural forms (one / few / many) and Azerbaijani has no grammatical plural after numerals; snapshot tests cover each (see §8.3).

**Privacy of explanations.** A reason may use only fields visible to the viewer. A reason never discloses an exclusion, a grade, a reporting-line fact, a score, or any private field.

## 7. Rematch

1. The requester (mentee, PM or team lead) gives a reason (selected from a fixed list plus optional free text, stored with the match, **not** shown to the mentor **[PROPOSED]**).
2. The system shows a preview of goals eligible to carry over; **only goals the mentee ticks** move. Notes, reflections and messages never move (FR-MAT-013).
3. The previous mentor is excluded from the new candidate pool unless the PM overrides.
4. All exclusions apply as normal.

## 8. Quality checks

### 8.1 Fixed reference scenarios

Fixture organisation "Reference Telecom": a 3-level org chart (executive → director → manager → staff) with one programme of each type. Every scenario has a golden expected output (ranking, sub-scores, explanations in EN/AZ/RU). Minimum scenarios:

| ID | Scenario |
|---|---|
| MT-S1 | Leadership: strong-fit pair beats a stale-profile pair |
| MT-S2 | Reporting line: manager and skip-level are excluded; peers sharing a manager are excluded in Leadership only |
| MT-S3 | Open: mentor-junior allowed (reverse mentoring) and scored 0.30 on career |
| MT-S4 | SparkLab: team quorum — a slot with the lead but < 60% members is not counted |
| MT-S5 | Missing data: blank mentor profile scores 0 and never outranks a complete one |
| MT-S6 | Capacity: mentor at cap excluded; override with reason returns the pair |
| MT-S7 | Tie-break chain exercised through all four levels |
| MT-S8 | Rematch: declined pair is excluded for 90 days |
| MT-S9 | A reason applying to ≥ 90% of the pool is dropped from every explanation |

### 8.2 Property tests (must always hold)

| ID | Property |
|---|---|
| MT-P1 | An excluded pair never appears in any ranked output (unless an override record for that pair exists) |
| MT-P2 | A criterion with weight 0 has no effect on any output (changing its inputs changes nothing) |
| MT-P3 | Shuffling input order does not change output |
| MT-P4 | Capacity is never exceeded in a published draft, and never under simultaneous accepts (the latter is a database concurrency test, §11 of the Plan) |
| MT-P5 | Changing any field not in the snapshot table (§1.1), including private fields, does not change output |
| MT-P6 | Same snapshot + same engine version ⇒ byte-identical output |
| MT-P7 | A blank mentor profile never outranks a complete profile with equal exclusions |
| MT-P8 | Total score is within [0, 100]; each sub-score within [0, 1] |
| MT-P9 | Explanations never contain digits that encode a score or percentage |
| MT-P10 | Mentor view contains no goal title unless the goal was shared |
| MT-P11 | Changing a parameter value changes output only through that parameter: with the same snapshot and a different settings version the output may differ, and the stored match always names the version used |
| MT-P12 | Every parameter bound is enforced: values outside bounds (e.g. depth factors out of order, band scores outside [0, 1], weights not totalling 100) are rejected before they can reach the engine |

### 8.3 Explanation snapshots

For each reason template and each locale (`en`, `az`, `ru`), a snapshot test covers: singular, plural, zero, large counts; for Russian additionally the one / few / many plural categories (1, 2, 5, 11, 21, 22, 25). A completeness gate fails the build if any template lacks a translation.

## 9. Engine versioning and storage

Every match stores `engine_version`, the **matching settings version id**, the **input snapshot hash**, the per-criterion sub-scores, and the reason codes shown. A match is never recomputed in place; re-scoring produces a new match record. This is how a PM can answer "why was this pair suggested?" months later.
