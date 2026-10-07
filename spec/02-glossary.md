# Glossary (EN / AZ / RU)

**Status: seed, pending native-speaker review.** The terms in the Plan's Appendix B seed (mentor, mentee, programme, mentoring relationship, session, goal, milestone, action, progress report, spark) are carried over unchanged; every other row is proposed by the specification author. Review is owned by L&D (Plan §13) and must finish before the release candidate (S14). Until then **every AZ and RU cell below is provisional**, and translation keys must be marked `needs-review` in the locale files.

## How this glossary is used

1. **Single vocabulary.** User-facing text, specification documents and code identifiers use these terms and no synonyms. If two English words mean the same thing, only the glossary term is allowed.
2. **Translation keys** reference glossary IDs (`GL-nnn`). Changing a glossary term is a one-place change followed by a translation-completeness check.
3. **Code names** are the English singular, snake_case (`mentoring_relationship`). User-facing English may differ slightly (shown in the first column).
4. **Never user-visible** terms (exclusion codes, engine, weights, RLS) are listed at the end; they must not appear in any locale.

## 1. People and roles

| ID | English | Azərbaycanca | Русский | Notes |
|---|---|---|---|---|
| GL-001 | mentor | mentor | ментор | Participation, not a role |
| GL-002 | mentee | menti | менти | Participation, not a role. Avoid "protégé" |
| GL-003 | team lead (SparkLab) | komanda lideri | руководитель команды | Spark team accepts through the lead |
| GL-004 | programme manager (PM) | proqram meneceri | менеджер программы | Role |
| GL-005 | assessor | qiymətləndirici | оценщик | Role; scores mentor applications |
| GL-006 | content manager | məzmun meneceri | контент-менеджер | Role |
| GL-007 | safeguarding contact | mühafizə üzrə əlaqə şəxsi | ответственное лицо по защите участников | Receives concerns. Native review needed — "safeguarding" has no single everyday term |
| GL-008 | organisation admin | təşkilat administratoru | администратор организации | Role |
| GL-009 | platform admin | platforma administratoru | администратор платформы | Role, global |
| GL-010 | sponsor | sponsor | спонсор | Named recipient of the evaluation pack; not a user |
| GL-011 | participant | iştirakçı | участник | Mentor, mentee or team member in a programme |

## 2. Programme structure

| ID | English | Azərbaycanca | Русский | Notes |
|---|---|---|---|---|
| GL-020 | programme | proqram | программа | |
| GL-021 | Leadership programme | Liderlik proqramı | программа для руководителей | Proper name of the Azerconnect programme: *Rəhbərlik üçün mentorluq programı* — use the programme's own title where it is shown |
| GL-022 | SparkLab | SparkLab | SparkLab | Not translated |
| GL-023 | Open mentoring | Açıq mentorluq | открытое менторство | |
| GL-024 | cohort | qrup (dövr) | поток | One run of a programme |
| GL-025 | spark (idea team) | spark (komanda) | спарк (команда) | Always paired with the clarifying word on first use |
| GL-026 | enrolment | qeydiyyat | зачисление | |
| GL-027 | eligibility rule | uyğunluq qaydası | правило допуска | |

## 3. Relationship and sessions

| ID | English | Azərbaycanca | Русский | Notes |
|---|---|---|---|---|
| GL-030 | mentoring relationship | mentorluq əlaqəsi | менторские отношения | |
| GL-031 | session | görüş | встреча | A meeting between mentor and mentee/team |
| GL-032 | goal | məqsəd | цель | |
| GL-033 | milestone | mərhələ | этап | |
| GL-034 | action | tapşırıq | задача | |
| GL-035 | progress report | inkişaf hesabatı | отчёт о прогрессе | |
| GL-036 | final evaluation | yekun qiymətləndirmə | итоговая оценка | |
| GL-037 | evaluation pack | qiymətləndirmə paketi | пакет итоговой оценки | Exported to sponsors |
| GL-038 | check-in | görüşdən sonrakı qısa sorğu | краткий опрос после встречи | 3 questions after a session |
| GL-039 | private note | şəxsi qeyd | личная заметка | Readable only by its author |
| GL-040 | reflection | düşüncə qeydi | рефлексия | |
| GL-041 | message | mesaj | сообщение | |
| GL-042 | agenda | gündəm | повестка | |
| GL-043 | resource | resurs | материал | Library item for mentors/mentees |
| GL-044 | availability | uyğun vaxtlar | доступное время | |
| GL-045 | capacity | tutum | лимит наставляемых | Max mentees/teams per mentor |

## 4. Matching

| ID | English | Azərbaycanca | Русский | Notes |
|---|---|---|---|---|
| GL-050 | match | uyğunlaşdırma | подбор пары | The pairing, as an object |
| GL-051 | request | sorğu | запрос | Mentee asks mentor (Open) |
| GL-052 | proposal | təklif | предложение | PM proposes a pair (Leadership/SparkLab) |
| GL-053 | recommended | tövsiyə olunanlar | рекомендуемые | Top 5 in Open |
| GL-054 | browse | bütün mentorlar | все менторы | |
| GL-055 | rematch | yenidən uyğunlaşdırma | повторный подбор | |
| GL-056 | accept / decline | qəbul et / rədd et | принять / отклонить | |
| GL-057 | "Not available for requests in this programme." | "Bu proqramda sorğular üçün əlçatan deyil." | «Недоступно для запросов в этой программе.» | The **only** text ever shown for an exclusion |
| GL-058 | compatibility questionnaire | uyğunluq sorğusu | анкета совместимости | Leadership |
| GL-059 | skills and topics | bacarıqlar və mövzular | навыки и темы | Taxonomy |
| GL-060 | expertise depth: working / advanced / expert | işlək / irəli / ekspert | рабочий / продвинутый / экспертный | |
| GL-061 | career level | karyera səviyyəsi | карьерный уровень | Shown as "ahead / peer / far", never grades |

## 5. Vetting

| ID | English | Azərbaycanca | Русский | Notes |
|---|---|---|---|---|
| GL-070 | mentor application | mentor müraciəti | заявка на роль ментора | |
| GL-071 | nomination | namizədlik | номинация | |
| GL-072 | rubric | qiymətləndirmə meyarları | рубрика оценки | |
| GL-073 | assessment | qiymətləndirmə | оценка | |
| GL-074 | approved / rejected / withdrawn / suspended | təsdiqlənib / rədd edilib / geri götürülüb / dayandırılıb | одобрено / отклонено / отозвано / приостановлено | Application states |

## 6. Health and support

| ID | English | Azərbaycanca | Русский | Notes |
|---|---|---|---|---|
| GL-080 | relationship health | əlaqənin vəziyyəti | состояние отношений | PM only |
| GL-081 | "Where should I intervene?" | "Harada dəstək lazımdır?" | «Где нужна поддержка?» | PM action list title |
| GL-082 | "I'd like support" | "Dəstək istəyirəm" | «Мне нужна поддержка» | Check-in flag → PM |
| GL-083 | report a concern | narahatlığı bildir | сообщить о проблеме | → safeguarding, never the PM |
| GL-084 | pause / leave | fasilə ver / ayrıl | приостановить / выйти | Any member, immediately |
| GL-085 | dashboard | panel | панель | |

## 7. System

| ID | English | Azərbaycanca | Русский | Notes |
|---|---|---|---|---|
| GL-090 | sign-in link | giriş linki | ссылка для входа | Magic link |
| GL-091 | sign-in code | giriş kodu | код для входа | 6 digits |
| GL-092 | authenticator app | autentifikator tətbiqi | приложение-аутентификатор | TOTP |
| GL-093 | AI suggestion | süni intellekt təklifi | предложение ИИ | Always labelled; never auto-saved |
| GL-094 | notification | bildiriş | уведомление | |
| GL-095 | consent | razılıq | согласие | |
| GL-096 | import | idxal | импорт | HR data import |

## 8. Style rules for AZ and RU copy

- **Russian: gender-neutral phrasing** (Plan §8). Prefer plural, impersonal or noun constructions to gendered past-tense verbs ("Встреча назначена", not "Вы назначили"). Native review decides the final wording of §1 role nouns.
- **Azerbaijani:** use the Latin alphabet with full diacritics (ə, ı, ö, ü, ç, ş, ğ); capital **Ə** must render (fallback font Noto Sans).
- **Layout:** AZ and RU run about 35% longer than English (C-112).
- **Numbers and plurals:** use ICU plural rules. Russian has three categories (one/few/many/other).
- **Dates and times:** 24-hour clock, Monday-first weeks, Asia/Baku default (C-110, C-111).
- **Tone:** respectful, warm, no jargon. Avoid HR-evaluative words (e.g. "rating", "performance") in mentee-facing copy.

## 9. Never user-visible

These internal words must not appear in any rendered locale (a test scans the locale files and email templates):

`exclusion`, `excluded`, `engine`, `weight`, `score` (as a matching term), `override`, `RLS`, `tenant`, `bucket`, `skip-level`.

(PM-only screens may show "override" and "weights" where the PM manages them; the scan applies to participant-facing keys and emails.)
