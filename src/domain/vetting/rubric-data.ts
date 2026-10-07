/**
 * Seed definitions of the two vetting rubrics (FR-VET-004). The PRD fixes only their sizes (35 items for Leadership,
 * 20 for SparkLab); the sections, items, scale and bands below are this slice's documented choices, see docs/RUBRICS.md.
 * Scale for every item: 0 no evidence · 1 weak · 2 adequate · 3 strong · 4 outstanding (max 4).
 * Bands (advisory only): approve at 70 % of the maximum or more, borderline from 55 %, below that reject.
 */
import type { RubricBand, RubricDefinition } from "./rubric";

type L3 = readonly [en: string, az: string, ru: string];
interface SeedSection { label: L3; items: readonly L3[] }
export interface RubricSeed { code: "leadership" | "sparklab"; version: 1; name: string; sections: readonly SeedSection[]; bands: RubricBand[] }

const ITEM_MAX = 4;

export const LEADERSHIP_SEED: RubricSeed = {
  code: "leadership",
  version: 1,
  name: "Leadership mentors (35 items)",
  bands: [{ min: 0, outcome: "reject" }, { min: 77, outcome: "borderline" }, { min: 98, outcome: "approve" }],
  sections: [
    {
      label: ["Leadership experience", "Rəhbərlik təcrübəsi", "Руководящий опыт"],
      items: [
        ["Years of experience leading teams or functions", "Komanda və ya funksiyaya rəhbərlik təcrübəsinin illəri", "Стаж руководства командами или функциями"],
        ["Scale and complexity of current responsibility", "Cari məsuliyyətin miqyası və mürəkkəbliyi", "Масштаб и сложность текущей ответственности"],
        ["Track record of delivering results through others", "Başqaları vasitəsilə nəticə əldə etmə təcrübəsi", "Опыт достижения результатов через других людей"],
        ["Experience guiding teams through organisational change", "Komandaları təşkilati dəyişikliklərdən keçirmə təcrübəsi", "Опыт ведения команд через организационные изменения"],
        ["Credibility with peers and senior stakeholders", "Həmkarlar və yuxarı səviyyəli tərəfdaşlar nəzdində etibarlılıq", "Авторитет среди коллег и старших стейкхолдеров"],
      ],
    },
    {
      label: ["Coaching and listening", "Koçinq və dinləmə", "Коучинг и умение слушать"],
      items: [
        ["Listens actively without interrupting", "Sözünü kəsmədən aktiv dinləyir", "Слушает активно, не перебивая"],
        ["Asks open questions that prompt reflection", "Düşünməyə sövq edən açıq suallar verir", "Задаёт открытые вопросы, побуждающие к размышлению"],
        ["Paraphrases to confirm understanding", "Anlaşılmanı təsdiqləmək üçün öz sözləri ilə təkrarlayır", "Перефразирует, чтобы подтвердить понимание"],
        ["Helps the mentee find their own answers instead of advising by default", "Məsləhət verməkdənsə mentorun öz cavabını tapmasına kömək edir", "Помогает подопечному находить собственные ответы, а не советует по умолчанию"],
        ["Stays calm with silence and difficult emotions", "Sükut və çətin emosiyalar qarşısında sakit qalır", "Сохраняет спокойствие при паузах и сильных эмоциях"],
      ],
    },
    {
      label: ["Communication and feedback", "Ünsiyyət və əks əlaqə", "Коммуникация и обратная связь"],
      items: [
        ["Communicates clearly and concisely", "Aydın və yığcam ünsiyyət qurur", "Выражается ясно и лаконично"],
        ["Gives specific, balanced and actionable feedback", "Konkret, balanslı və tətbiq oluna bilən əks əlaqə verir", "Даёт конкретную, взвешенную и применимую обратную связь"],
        ["Receives feedback openly", "Əks əlaqəni açıq qəbul edir", "Открыто принимает обратную связь"],
        ["Adapts style to different personalities", "Üslubunu müxtəlif xarakterlərə uyğunlaşdırır", "Подстраивает стиль под разные характеры"],
        ["Handles difficult conversations constructively", "Çətin söhbətləri konstruktiv aparır", "Конструктивно ведёт трудные разговоры"],
      ],
    },
    {
      label: ["Values and integrity", "Dəyərlər və dürüstlük", "Ценности и добросовестность"],
      items: [
        ["Acts in line with Azerconnect Group values", "Azerconnect Group dəyərlərinə uyğun davranır", "Действует в соответствии с ценностями Azerconnect Group"],
        ["Keeps confidences", "Məxfiliyi qoruyur", "Хранит конфиденциальность"],
        ["Models fairness and inclusion", "Ədalət və inklüzivlik nümunəsi göstərir", "Подаёт пример справедливости и инклюзивности"],
        ["Is honest about the limits of their own knowledge", "Öz biliyinin hüdudları barədə səmimidir", "Честно говорит о границах собственных знаний"],
        ["Shows sound ethical judgement under pressure", "Təzyiq altında düzgün etik mühakimə nümayiş etdirir", "Проявляет здравое этическое суждение под давлением"],
      ],
    },
    {
      label: ["Developing others", "Başqalarının inkişafı", "Развитие других"],
      items: [
        ["Track record of developing direct reports or colleagues", "Tabeliyində olanların və ya həmkarların inkişafında təcrübə", "Опыт развития подчинённых или коллег"],
        ["Previous mentoring or coaching experience", "Əvvəlki mentorluq və ya koçinq təcrübəsi", "Прежний опыт наставничества или коучинга"],
        ["Focuses on the mentee's growth rather than their own agenda", "Öz gündəmindən çox mentinin inkişafına fokuslanır", "Сосредоточен на росте подопечного, а не на собственной повестке"],
        ["Shares own failures and lessons learned", "Öz uğursuzluqlarını və çıxardığı dərsləri bölüşür", "Делится собственными неудачами и извлечёнными уроками"],
        ["Connects mentees with networks and opportunities", "Mentiləri şəbəkələr və imkanlarla əlaqələndirir", "Связывает подопечных с сетями контактов и возможностями"],
      ],
    },
    {
      label: ["Commitment and availability", "Öhdəlik və əlçatanlıq", "Вовлечённость и доступность"],
      items: [
        ["Can commit to at least three months of regular meetings", "Ən azı üç ay müntəzəm görüşlərə öhdəlik götürə bilir", "Может взять обязательство на минимум три месяца регулярных встреч"],
        ["Has realistic time alongside the current role", "Cari vəzifə ilə yanaşı real vaxtı var", "Располагает реалистичным временем наряду с текущей ролью"],
        ["Reliable in keeping and rescheduling appointments", "Görüşlərə riayət etmək və yenidən planlaşdırmaqda etibarlıdır", "Надёжен в соблюдении и переносе встреч"],
        ["Prepares for sessions and follows up on agreed actions", "Sessiyalara hazırlaşır və razılaşdırılmış addımları izləyir", "Готовится к сессиям и отслеживает согласованные действия"],
        ["Willing to complete progress reports on time", "İrəliləyiş hesabatlarını vaxtında təqdim etməyə hazırdır", "Готов вовремя заполнять отчёты о прогрессе"],
      ],
    },
    {
      label: ["Self-awareness and boundaries", "Özünüdərk və sərhədlər", "Самосознание и границы"],
      items: [
        ["Understands own strengths and development areas", "Öz güclü tərəflərini və inkişaf sahələrini anlayır", "Понимает свои сильные стороны и зоны развития"],
        ["Keeps mentoring separate from line management", "Mentorluğu xətti rəhbərlikdən ayırır", "Отделяет наставничество от линейного руководства"],
        ["Recognises when to refer a mentee to HR, safeguarding or a specialist", "Mentini HR-a, mühafizə xidmətinə və ya mütəxəssisə yönləndirməyin vaxtını tanıyır", "Понимает, когда направить подопечного в HR, службу защиты или к специалисту"],
        ["Avoids conflicts of interest with the mentee's reporting line", "Mentinin tabelik xətti ilə maraqların toqquşmasından çəkinir", "Избегает конфликта интересов с линией подчинения подопечного"],
        ["Reflects on own practice and keeps learning", "Öz təcrübəsini təhlil edir və öyrənməyə davam edir", "Анализирует свою практику и продолжает учиться"],
      ],
    },
  ],
};

export const SPARKLAB_SEED: RubricSeed = {
  code: "sparklab",
  version: 1,
  name: "SparkLab mentors (20 items)",
  bands: [{ min: 0, outcome: "reject" }, { min: 44, outcome: "borderline" }, { min: 56, outcome: "approve" }],
  sections: [
    {
      label: ["Domain and innovation expertise", "Sahə və innovasiya ekspertizası", "Профильная и инновационная экспертиза"],
      items: [
        ["Depth of expertise in a field relevant to idea teams", "İdeya komandaları üçün aktual sahədə ekspertizanın dərinliyi", "Глубина экспертизы в области, важной для команд-идей"],
        ["Has taken an idea from concept to product or service", "İdeyanı konsepsiyadan məhsul və ya xidmətə qədər çatdırıb", "Доводил идею от концепции до продукта или услуги"],
        ["Understands customer and market validation", "Müştəri və bazar təsdiqini başa düşür", "Понимает проверку гипотез на клиентах и рынке"],
        ["Aware of current technology and trends", "Cari texnologiya və trendlərdən xəbərdardır", "Знает актуальные технологии и тенденции"],
        ["Can judge feasibility and risk", "Həyata keçirilə bilənliyi və riski qiymətləndirə bilir", "Умеет оценивать реализуемость и риски"],
      ],
    },
    {
      label: ["Guiding teams through the phases", "Komandaları mərhələlərdən keçirmə", "Сопровождение команд по этапам"],
      items: [
        ["Can guide a team through the develop phase", "Komandanı hazırlıq (develop) mərhələsində istiqamətləndirə bilir", "Может вести команду на этапе разработки (develop)"],
        ["Can guide a team through the design phase", "Komandanı dizayn (design) mərhələsində istiqamətləndirə bilir", "Может вести команду на этапе проектирования (design)"],
        ["Can guide a team through the test phase", "Komandanı sınaq (test) mərhələsində istiqamətləndirə bilir", "Может вести команду на этапе тестирования (test)"],
        ["Helps teams prioritise and limit scope", "Komandalara prioritetləri müəyyən etməyə və əhatəni məhdudlaşdırmağa kömək edir", "Помогает командам расставлять приоритеты и ограничивать объём"],
        ["Encourages experimentation and learning from failure", "Eksperimentləri və uğursuzluqdan öyrənməni təşviq edir", "Поощряет эксперименты и обучение на ошибках"],
      ],
    },
    {
      label: ["Coaching and communication", "Koçinq və ünsiyyət", "Коучинг и коммуникация"],
      items: [
        ["Listens and asks open questions", "Dinləyir və açıq suallar verir", "Слушает и задаёт открытые вопросы"],
        ["Gives constructive feedback", "Konstruktiv əks əlaqə verir", "Даёт конструктивную обратную связь"],
        ["Works with the team lead and several members at once", "Komanda lideri və bir neçə üzvlə eyni vaxtda işləyir", "Работает одновременно с лидером команды и несколькими участниками"],
        ["Draws out quieter team members", "Sakit komanda üzvlərinin fikrini ortaya çıxarır", "Вовлекает более тихих участников команды"],
        ["Explains complex ideas simply", "Mürəkkəb ideyaları sadə izah edir", "Объясняет сложные идеи просто"],
      ],
    },
    {
      label: ["Commitment and conduct", "Öhdəlik və davranış", "Вовлечённость и поведение"],
      items: [
        ["Has time for the whole programme", "Bütün proqram üçün vaxtı var", "Располагает временем на всю программу"],
        ["Reliable in keeping appointments", "Görüşlərə riayətdə etibarlıdır", "Надёжен в соблюдении встреч"],
        ["Respects confidentiality and the team's ownership of its idea", "Məxfiliyə və komandanın ideya üzərində sahibliyinə hörmət edir", "Уважает конфиденциальность и права команды на свою идею"],
        ["Acts in line with Azerconnect Group values", "Azerconnect Group dəyərlərinə uyğun davranır", "Действует в соответствии с ценностями Azerconnect Group"],
        ["Keeps mentoring separate from funding or ownership decisions about the idea", "Mentorluğu ideya ilə bağlı maliyyə və ya sahiblik qərarlarından ayırır", "Отделяет наставничество от решений о финансировании или владении идеей"],
      ],
    },
  ],
};

export const RUBRIC_SEEDS: readonly RubricSeed[] = [LEADERSHIP_SEED, SPARKLAB_SEED];

/** Turns a seed into the stored definition (item/section codes `s1`, `s1i1`; message keys `vetting.rubric.<code>.v<version>.…`). */
export function seedDefinition(seed: RubricSeed): RubricDefinition {
  const base = `vetting.rubric.${seed.code}.v${seed.version}`;
  return {
    bands: seed.bands,
    sections: seed.sections.map((s, si) => ({
      code: `s${si + 1}`,
      label: s.label[0],
      labelKey: `${base}.s${si + 1}`,
      items: s.items.map((it, ii) => ({ code: `s${si + 1}i${ii + 1}`, label: it[0], labelKey: `${base}.s${si + 1}i${ii + 1}`, max: ITEM_MAX })),
    })),
  };
}

/** Message entries for a seed in the three languages. */
export function seedMessages(seed: RubricSeed): { en: Record<string, string>; az: Record<string, string>; ru: Record<string, string> } {
  const base = `vetting.rubric.${seed.code}.v${seed.version}`;
  const out = { en: {} as Record<string, string>, az: {} as Record<string, string>, ru: {} as Record<string, string> };
  seed.sections.forEach((s, si) => {
    const put = (key: string, v: L3) => { out.en[key] = v[0]; out.az[key] = v[1]; out.ru[key] = v[2]; };
    put(`${base}.s${si + 1}`, s.label);
    s.items.forEach((it, ii) => put(`${base}.s${si + 1}i${ii + 1}`, it));
  });
  return out;
}
