# Participant stories — access, profile, availability, mentor application

**Batch 2 · DRAFT, pending Batch 1 sign-off · covers Epics 1, 4 and 5 (applicant side)**

**Story format.** Each story has an ID `US-<AREA>-nn`, linked requirements (`FR-…`), linked screens (`SCR-…`) and the slice it ships in. Each has 3–6 acceptance criteria with IDs `AC-<AREA>-nn.k`. **Kind** is **P** (positive) or **N** (negative or permission case). Every story with a data-visibility or state change has at least one **N**. Numbers are cited as constants (`C-nnn`), never restated. Automated tests reference AC IDs.

---

### US-TEN-01 · Sign in with an emailed link

**As a** colleague, **I want** to sign in with a link sent to my work email, **so that** I never manage a password.
**Requirements:** FR-TEN-003, FR-TEN-004, FR-TEN-005, FR-TEN-006, FR-TEN-007, FR-TEN-008 · **Screens:** SCR-01 · **Slice:** S1

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-TEN-01.1 | **Given** I am an active person in the HR import, **when** I enter my work email on the sign-in page, **then** I see the neutral message "If this address can sign in, we've sent a link" and receive an email with a link and a 6-digit code (N-001). | P |
| AC-TEN-01.2 | **Given** an email address that is unknown, inactive, or not invited, **when** it is entered, **then** the on-screen response and its timing class are identical to AC-TEN-01.1 and no email is sent. | N |
| AC-TEN-01.3 | **Given** I open the sign-in link, **when** the page loads, **then** I see a "Continue" button and I am **not** signed in until I click it; a pre-fetch of the link by a mail scanner changes nothing. | N |
| AC-TEN-01.4 | **Given** I requested the sign-in in browser A, **when** I enter the 6-digit code in browser A, **then** I am signed in; **when** the same code is entered in browser B, **then** it is rejected with a neutral message. | N |
| AC-TEN-01.5 | **Given** the link or code is older than C-041 or has been used, **when** I use it, **then** it is rejected and I am offered a new link. | N |
| AC-TEN-01.6 | **Given** 100 colleagues behind one office IP address, **when** each requests a link within C-046 limits for their own identity and browser, **then** all succeed (C-045). | P |

### US-TEN-02 · Use the interface in my language and time zone

**As a** participant, **I want** to choose English, Azerbaijani or Russian and see times in my zone, **so that** I am never confused about when a session is.
**Requirements:** FR-TEN-013, FR-PRV-006, FR-PRV-007 · **Screens:** SCR-03 · **Slice:** S1

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-TEN-02.1 | **Given** I have not chosen a language, **when** I first sign in, **then** the interface uses the organisation default locale and I see a language switcher in the header. | P |
| AC-TEN-02.2 | **Given** I choose Azerbaijani, **when** any page, email or calendar invite is produced for me, **then** it is in Azerbaijani and the `lang` attribute is `az`. | P |
| AC-TEN-02.3 | **Given** my time zone is not set, **when** a time is shown, **then** it is in Asia/Baku (C-110) on a 24-hour clock with Monday as first day of the week (C-111). | P |
| AC-TEN-02.4 | **Given** my chosen language has a missing translation key, **when** the build runs, **then** the translation-completeness gate fails the build (the user never sees a raw key). | N |

### US-TEN-03 · Give my consent and read the privacy notice

**As a** new user, **I want** to read the privacy notice and decide on optional consents, **so that** I know how my data is used.
**Requirements:** FR-TEN-014, FR-PRV-009 · **Screens:** SCR-01, SCR-17 · **Slice:** S1

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-TEN-03.1 | **Given** I sign in for the first time, **when** I land, **then** I am shown the privacy notice and cannot reach other pages until I accept it. | P |
| AC-TEN-03.2 | **Given** the notice has a new version, **when** I next sign in, **then** I am asked to accept again and the new acceptance is stored with the version. | P |
| AC-TEN-03.3 | **Given** I decline the required notice, **when** I choose "Decline", **then** I am signed out and no profile data is created. | N |
| AC-TEN-03.4 | **Given** optional consents (e.g. AI assistance), **when** I leave them unticked, **then** the features depending on them stay unavailable to me (INV-6.2). | N |

---

### US-PRF-01 · Complete my profile

**As a** participant, **I want** to describe what I can offer and what I want to learn, **so that** matching suggests the right people.
**Requirements:** FR-PRF-002, FR-PRF-003, FR-PRF-004, FR-PRF-005, FR-PRF-009 · **Screens:** SCR-03 · **Slice:** S4

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-PRF-01.1 | **Given** I open Profile, **when** I add topics, **then** I choose only from the curated taxonomy (searchable in my language, with synonyms) and cannot enter free-text topics. | P |
| AC-PRF-01.2 | **Given** I add a topic I offer, **when** I save, **then** I must pick a depth: working, advanced or expert. | P |
| AC-PRF-01.3 | **Given** I type "mammadov" or "ozbek" into any search, **when** results load, **then** Məmmədov and Özbək are found (C-115 folding). | P |
| AC-PRF-01.4 | **Given** I am editing my profile, **when** I pause typing or lose connection, **then** my changes autosave and are restored when I return. | P |
| AC-PRF-01.5 | **Given** I have not provided a language, **when** matching runs, **then** my "language" criterion scores neutral as a mentee (C-057) and zero as a mentor (C-058). | N |

### US-PRF-02 · Control who sees each part of my profile

**As a** participant, **I want** to choose the visibility of each field, **so that** I stay in control.
**Requirements:** FR-PRF-001, FR-PRF-010, FR-MAT-006 · **Screens:** SCR-03 · **Slice:** S4

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-PRF-02.1 | **Given** a new profile, **when** I view visibility settings, **then** every field is "Only me" except name and department (OQ-B1-19). | P |
| AC-PRF-02.2 | **Given** a field set to "Only me", **when** matching, discovery, a mentor or a PM reads my profile, **then** that field is not returned and does not affect matching. | N |
| AC-PRF-02.3 | **Given** I change a field to "Mentors in my programme", **when** an approved mentor browses, **then** they see it; **when** I change it back, **then** they no longer do. | P |
| AC-PRF-02.4 | **Given** I open "What matching can see", **when** it renders, **then** it lists exactly the fields the engine reads for me and who sees each; it does not list my grade or reporting line. | N |
| AC-PRF-02.5 | **Given** my grade bucket and my manager, **when** any participant-facing screen or API response is produced, **then** neither appears. | N |

### US-PRF-03 · Set my availability

**As a** mentor, **I want** to set recurring availability and capacity, **and as a** mentee **I want** to give time windows, **so that** booking is easy.
**Requirements:** FR-PRF-007, FR-SCH-001 · **Screens:** SCR-04 · **Slice:** S4

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-PRF-03.1 | **Given** I am a mentor, **when** I add a weekly rule (weekday, start, end), **then** slots are generated in each viewer's time zone. | P |
| AC-PRF-03.2 | **Given** I am a mentor, **when** I set my capacity, **then** it cannot be lower than my current number of active relationships/teams without the PM being notified (the "mentor over capacity" item). | N |
| AC-PRF-03.3 | **Given** I am a mentee, **when** I add availability windows, **then** they are used for matching and booking and are visible only per my field visibility. | P |
| AC-PRF-03.4 | **Given** I have already booked a session at a time, **when** I add a rule that overlaps it, **then** existing sessions are unaffected. | N |

### US-PRF-04 · Know whether I am recommendable as a mentor

**As an** approved mentor, **I want** to see what is missing from my profile, **so that** I can be recommended.
**Requirements:** FR-PRF-006, FR-VET-001, FR-MAT-005 · **Screens:** SCR-02, SCR-03 · **Slice:** S4

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-PRF-04.1 | **Given** I am approved but have no topics or no expertise area (C-032), **when** I open Home, **then** my main card is "Finish my profile" explaining what is missing. | P |
| AC-PRF-04.2 | **Given** my profile is below the minimum, **when** a mentee browses or asks for recommendations, **then** I do not appear. | N |
| AC-PRF-04.3 | **Given** I meet the minimum, **when** the next recommendation list is generated, **then** I can appear. | P |

---

### US-VET-01 · Apply or accept a nomination to become a mentor

**As a** colleague, **I want** to apply, or accept a nomination, **so that** I can be considered as a mentor.
**Requirements:** FR-VET-001, FR-VET-002, FR-VET-012 · **Screens:** SCR-16 · **Slice:** S5

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-VET-01.1 | **Given** a programme is accepting applications and I am eligible, **when** I open Home, **then** I see "Mentor applications open" (lowest-priority card before "up to date"). | P |
| AC-VET-01.2 | **Given** I was nominated, **when** I open the nomination, **then** I can accept (application becomes a draft) or decline (application becomes withdrawn). | P |
| AC-VET-01.3 | **Given** my application is a draft, **when** I edit it, **then** it autosaves; **when** I submit it with incomplete required parts, **then** submit is blocked with what is missing. | P |
| AC-VET-01.4 | **Given** I am not eligible for the programme, **when** I try to open the application by its address, **then** I get "not found" (INV-4.3). | N |
| AC-VET-01.5 | **Given** my application is submitted, **when** I look at it, **then** I see only its status, never any assessor's identity or score. | N |

### US-VET-02 · See the outcome of my application

**As an** applicant, **I want** to see the decision and any feedback the PM releases, **so that** I understand the result.
**Requirements:** FR-VET-009, FR-VET-008 · **Screens:** SCR-16 · **Slice:** S5

| AC | Given / When / Then | Kind |
|---|---|---|
| AC-VET-02.1 | **Given** the PM released a decision, **when** I open my application, **then** I see the outcome and any feedback the PM chose to release (N-025). | P |
| AC-VET-02.2 | **Given** the decision is not yet released, **when** I open my application, **then** I see only "in review". | N |
| AC-VET-02.3 | **Given** I was assessed, **when** I view the decision, **then** item-level scores are not shown, but they are included in my personal data export (FR-PRV-004). | N |
| AC-VET-02.4 | **Given** I was approved and my profile meets the minimum, **when** matching next runs, **then** I become discoverable; **given** I was suspended, **then** I do not. | P |
