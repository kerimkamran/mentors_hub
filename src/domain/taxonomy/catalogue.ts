/**
 * Curated platform catalogue (FR-PRF-002): areas (top level) with topics, translated into en/az/ru, with synonyms
 * that people actually type. Copied into each organisation by ensureTaxonomy; an organisation may then rename,
 * hide or add rows (its "overrides"). Azerbaijani and Russian are provisional pending native review (glossary).
 */
export interface Syn { en?: string[]; az?: string[]; ru?: string[] }
export interface CatalogueTopic { key: string; en: string; az: string; ru: string; syn?: Syn }
export interface CatalogueArea extends CatalogueTopic { children: CatalogueTopic[] }

export const TAXONOMY_CATALOGUE: CatalogueArea[] = [
  {
    key: "leadership", en: "Leadership", az: "Liderlik", ru: "Лидерство",
    syn: { en: ["management", "managing people"], az: ["rəhbərlik", "idarəçilik"], ru: ["руководство", "управление людьми"] },
    children: [
      { key: "leading_teams", en: "Leading teams", az: "Komandaya rəhbərlik", ru: "Руководство командой", syn: { en: ["team management", "people management"], az: ["komanda idarəçiliyi"], ru: ["управление командой"] } },
      { key: "delegation", en: "Delegation", az: "Səlahiyyətlərin həvalə edilməsi", ru: "Делегирование", syn: { en: ["empowering others"], az: ["tapşırıq bölgüsü"], ru: ["передача полномочий"] } },
      { key: "change_management", en: "Change management", az: "Dəyişikliklərin idarə olunması", ru: "Управление изменениями", syn: { en: ["transformation"], az: ["transformasiya"], ru: ["трансформация"] } },
      { key: "strategic_thinking", en: "Strategic thinking", az: "Strateji düşüncə", ru: "Стратегическое мышление", syn: { en: ["strategy", "vision"], az: ["strategiya", "vizyon"], ru: ["стратегия", "видение"] } },
      { key: "decision_making", en: "Decision making", az: "Qərarvermə", ru: "Принятие решений", syn: { en: ["judgement"], az: ["qərar qəbulu"], ru: ["выбор решений"] } },
      { key: "developing_others", en: "Coaching and developing others", az: "Koçinq və başqalarının inkişafı", ru: "Коучинг и развитие других", syn: { en: ["coaching", "talent development"], az: ["koçinq", "işçilərin inkişafı"], ru: ["коучинг", "развитие сотрудников"] } },
    ],
  },
  {
    key: "communication", en: "Communication", az: "Kommunikasiya", ru: "Коммуникации",
    syn: { en: ["communicating", "soft skills"], az: ["ünsiyyət"], ru: ["общение", "мягкие навыки"] },
    children: [
      { key: "public_speaking", en: "Public speaking", az: "İctimai çıxış", ru: "Публичные выступления", syn: { en: ["presentations", "presenting"], az: ["təqdimat", "natiqlik"], ru: ["презентации", "ораторское мастерство"] } },
      { key: "business_writing", en: "Business writing", az: "İşgüzar yazı", ru: "Деловая переписка", syn: { en: ["emails", "reports"], az: ["e-poçt", "hesabat yazmaq"], ru: ["письма", "отчёты"] } },
      { key: "negotiation", en: "Negotiation", az: "Danışıqlar", ru: "Переговоры", syn: { en: ["bargaining"], az: ["razılaşma"], ru: ["ведение переговоров"] } },
      { key: "feedback", en: "Giving and receiving feedback", az: "Rəy vermək və rəy qəbul etmək", ru: "Обратная связь", syn: { en: ["feedback conversations"], az: ["geri bildirim"], ru: ["фидбэк"] } },
      { key: "stakeholders", en: "Stakeholder management", az: "Maraqlı tərəflərlə işləmək", ru: "Работа с заинтересованными сторонами", syn: { en: ["influencing", "stakeholder engagement"], az: ["təsir göstərmək"], ru: ["влияние", "стейкхолдеры"] } },
      { key: "cross_cultural", en: "Cross-cultural communication", az: "Mədəniyyətlərarası ünsiyyət", ru: "Межкультурная коммуникация", syn: { en: ["working across cultures"], az: ["beynəlxalq komanda"], ru: ["международная команда"] } },
    ],
  },
  {
    key: "career", en: "Career development", az: "Karyera inkişafı", ru: "Карьерное развитие",
    syn: { en: ["career growth"], az: ["karyera"], ru: ["карьера"] },
    children: [
      { key: "career_planning", en: "Career planning", az: "Karyera planlaşdırması", ru: "Планирование карьеры", syn: { en: ["career path"], az: ["karyera yolu"], ru: ["карьерный путь"] } },
      { key: "promotion", en: "Preparing for promotion", az: "Yüksəlişə hazırlıq", ru: "Подготовка к повышению", syn: { en: ["getting promoted"], az: ["vəzifə artımı"], ru: ["продвижение по службе"] } },
      { key: "new_role", en: "Moving into a new role", az: "Yeni vəzifəyə keçid", ru: "Переход на новую должность", syn: { en: ["first 90 days", "onboarding into a role"], az: ["ilk 90 gün"], ru: ["первые 90 дней"] } },
      { key: "networking", en: "Networking", az: "Peşəkar əlaqələr", ru: "Профессиональные связи", syn: { en: ["building relationships"], az: ["tanışlıqlar"], ru: ["нетворкинг"] } },
      { key: "personal_brand", en: "Personal brand", az: "Şəxsi brend", ru: "Личный бренд", syn: { en: ["visibility", "reputation"], az: ["nüfuz"], ru: ["репутация"] } },
      { key: "work_life_balance", en: "Work-life balance", az: "İş və həyat balansı", ru: "Баланс работы и личной жизни", syn: { en: ["wellbeing", "burnout"], az: ["tükənmə"], ru: ["выгорание"] } },
    ],
  },
  {
    key: "telecom", en: "Telecommunications and networks", az: "Telekommunikasiya və şəbəkələr", ru: "Телекоммуникации и сети",
    syn: { en: ["telecom", "telco"], az: ["telekom", "rabitə"], ru: ["телеком", "связь"] },
    children: [
      { key: "mobile_networks", en: "Mobile networks (4G/5G)", az: "Mobil şəbəkələr (4G/5G)", ru: "Мобильные сети (4G/5G)", syn: { en: ["radio access", "5G"], az: ["radio şəbəkə"], ru: ["радиодоступ"] } },
      { key: "fixed_broadband", en: "Fibre and broadband", az: "Optik lif və genişzolaqlı internet", ru: "Оптоволокно и широкополосный доступ", syn: { en: ["fiber", "FTTH"], az: ["optik şəbəkə"], ru: ["оптика", "интернет"] } },
      { key: "core_network", en: "Core network and transport", az: "Nüvə şəbəkəsi və nəqliyyat şəbəkəsi", ru: "Базовая сеть и транспорт", syn: { en: ["IP networks", "routing"], az: ["marşrutlaşdırma"], ru: ["маршрутизация"] } },
      { key: "network_operations", en: "Network operations", az: "Şəbəkənin istismarı", ru: "Эксплуатация сети", syn: { en: ["NOC", "network monitoring"], az: ["şəbəkə monitorinqi"], ru: ["мониторинг сети"] } },
      { key: "iot", en: "Internet of Things", az: "Əşyaların interneti", ru: "Интернет вещей", syn: { en: ["IoT", "M2M"], az: ["IoT"], ru: ["IoT"] } },
    ],
  },
  {
    key: "software", en: "Software engineering", az: "Proqram mühəndisliyi", ru: "Разработка программного обеспечения",
    syn: { en: ["programming", "development", "coding"], az: ["proqramlaşdırma", "inkişaf"], ru: ["программирование", "разработка"] },
    children: [
      { key: "architecture", en: "Software architecture", az: "Proqram arxitekturası", ru: "Архитектура программных систем", syn: { en: ["system design"], az: ["sistem dizaynı"], ru: ["проектирование систем"] } },
      { key: "web_development", en: "Web and mobile development", az: "Veb və mobil tətbiq hazırlanması", ru: "Веб- и мобильная разработка", syn: { en: ["frontend", "backend", "apps"], az: ["tətbiqlər"], ru: ["приложения"] } },
      { key: "devops", en: "DevOps and cloud", az: "DevOps və bulud texnologiyaları", ru: "DevOps и облачные технологии", syn: { en: ["CI/CD", "infrastructure", "kubernetes"], az: ["infrastruktur"], ru: ["инфраструктура", "облако"] } },
      { key: "quality_engineering", en: "Testing and quality", az: "Test və keyfiyyət", ru: "Тестирование и качество", syn: { en: ["QA", "test automation"], az: ["test avtomatlaşdırması"], ru: ["автоматизация тестирования"] } },
      { key: "engineering_management", en: "Engineering practices", az: "Mühəndislik təcrübələri", ru: "Инженерные практики", syn: { en: ["code review", "agile engineering"], az: ["kod icmalı"], ru: ["ревью кода"] } },
    ],
  },
  {
    key: "data", en: "Data and analytics", az: "Data və analitika", ru: "Данные и аналитика",
    syn: { en: ["data science", "BI"], az: ["məlumat analizi"], ru: ["аналитика данных"] },
    children: [
      { key: "data_analysis", en: "Data analysis and reporting", az: "Data təhlili və hesabatlılıq", ru: "Анализ данных и отчётность", syn: { en: ["dashboards", "excel", "SQL"], az: ["dashboard"], ru: ["дашборды"] } },
      { key: "machine_learning", en: "Machine learning and AI", az: "Maşın öyrənməsi və süni intellekt", ru: "Машинное обучение и ИИ", syn: { en: ["artificial intelligence", "ML"], az: ["Sİ", "AI"], ru: ["искусственный интеллект"] } },
      { key: "data_engineering", en: "Data engineering", az: "Data mühəndisliyi", ru: "Инженерия данных", syn: { en: ["pipelines", "data warehouse"], az: ["data anbarı"], ru: ["хранилище данных"] } },
      { key: "data_governance", en: "Data governance and privacy", az: "Dataya nəzarət və məxfilik", ru: "Управление данными и конфиденциальность", syn: { en: ["GDPR", "data protection"], az: ["şəxsi məlumatların qorunması"], ru: ["защита персональных данных"] } },
    ],
  },
  {
    key: "security", en: "Cybersecurity and IT", az: "Kibertəhlükəsizlik və İT", ru: "Кибербезопасность и ИТ",
    syn: { en: ["information security", "infosec"], az: ["informasiya təhlükəsizliyi"], ru: ["информационная безопасность"] },
    children: [
      { key: "security_operations", en: "Security operations", az: "Təhlükəsizlik əməliyyatları", ru: "Операции по безопасности", syn: { en: ["SOC", "incident response"], az: ["insidentə reaksiya"], ru: ["реагирование на инциденты"] } },
      { key: "risk_compliance", en: "Risk and compliance", az: "Risk və uyğunluq", ru: "Риски и комплаенс", syn: { en: ["governance", "audit"], az: ["audit"], ru: ["аудит"] } },
      { key: "it_service", en: "IT service management", az: "İT xidmətlərinin idarə olunması", ru: "Управление ИТ-услугами", syn: { en: ["ITIL", "service desk"], az: ["dəstək xidməti"], ru: ["сервис-деск", "поддержка"] } },
      { key: "enterprise_systems", en: "Enterprise systems", az: "Korporativ sistemlər", ru: "Корпоративные системы", syn: { en: ["ERP", "CRM", "Oracle"], az: ["ERP", "CRM"], ru: ["ERP", "CRM"] } },
    ],
  },
  {
    key: "product", en: "Product and innovation", az: "Məhsul və innovasiya", ru: "Продукт и инновации",
    syn: { en: ["product development", "innovating"], az: ["məhsulun hazırlanması"], ru: ["разработка продукта"] },
    children: [
      { key: "product_management", en: "Product management", az: "Məhsulun idarə olunması", ru: "Управление продуктом", syn: { en: ["roadmap", "product owner"], az: ["yol xəritəsi"], ru: ["дорожная карта"] } },
      { key: "design_thinking", en: "Design thinking", az: "Dizayn təfəkkürü", ru: "Дизайн-мышление", syn: { en: ["user research", "UX"], az: ["istifadəçi tədqiqatı"], ru: ["исследование пользователей"] } },
      { key: "startups", en: "Ideas and prototypes", az: "İdeyalar və prototiplər", ru: "Идеи и прототипы", syn: { en: ["startup", "MVP", "pitching an idea"], az: ["startap"], ru: ["стартап"] } },
      { key: "innovation_practice", en: "Running experiments", az: "Təcrübələrin aparılması", ru: "Проведение экспериментов", syn: { en: ["hypothesis testing", "pilots"], az: ["pilot layihələr"], ru: ["пилотные проекты"] } },
    ],
  },
  {
    key: "projects", en: "Project and process management", az: "Layihə və proses idarəçiliyi", ru: "Управление проектами и процессами",
    syn: { en: ["project management", "PMO"], az: ["layihə idarəçiliyi"], ru: ["проектное управление"] },
    children: [
      { key: "agile", en: "Agile and Scrum", az: "Agile və Scrum", ru: "Agile и Scrum", syn: { en: ["sprints", "kanban"], az: ["çevik metodologiya"], ru: ["гибкие методологии"] } },
      { key: "planning", en: "Planning and prioritisation", az: "Planlaşdırma və prioritetləşdirmə", ru: "Планирование и приоритизация", syn: { en: ["time management", "scheduling"], az: ["vaxtın idarə olunması"], ru: ["тайм-менеджмент"] } },
      { key: "process_improvement", en: "Process improvement", az: "Proseslərin təkmilləşdirilməsi", ru: "Улучшение процессов", syn: { en: ["lean", "six sigma", "efficiency"], az: ["səmərəlilik"], ru: ["бережливое производство", "эффективность"] } },
      { key: "vendor_management", en: "Vendor and contract management", az: "Podratçı və müqavilə idarəçiliyi", ru: "Управление поставщиками и контрактами", syn: { en: ["procurement", "suppliers"], az: ["satınalma"], ru: ["закупки"] } },
    ],
  },
  {
    key: "business", en: "Business and finance", az: "Biznes və maliyyə", ru: "Бизнес и финансы",
    syn: { en: ["commercial", "economics"], az: ["kommersiya", "iqtisadiyyat"], ru: ["коммерция", "экономика"] },
    children: [
      { key: "budgeting", en: "Budgeting and financial planning", az: "Büdcələşdirmə və maliyyə planlaşdırması", ru: "Бюджетирование и финансовое планирование", syn: { en: ["forecasting", "P&L"], az: ["proqnozlaşdırma"], ru: ["прогнозирование"] } },
      { key: "business_cases", en: "Business cases and investment", az: "Biznes əsaslandırma və investisiya", ru: "Бизнес-кейсы и инвестиции", syn: { en: ["ROI", "business case"], az: ["investisiya qərarı"], ru: ["окупаемость"] } },
      { key: "market_strategy", en: "Market and competitor analysis", az: "Bazar və rəqib təhlili", ru: "Анализ рынка и конкурентов", syn: { en: ["competition", "market research"], az: ["bazar araşdırması"], ru: ["исследование рынка"] } },
      { key: "regulation", en: "Regulation and public affairs", az: "Tənzimləmə və dövlət orqanları ilə əlaqələr", ru: "Регулирование и взаимодействие с госорганами", syn: { en: ["regulator", "government relations"], az: ["tənzimləyici orqan"], ru: ["регулятор"] } },
    ],
  },
  {
    key: "customer", en: "Customer experience and sales", az: "Müştəri təcrübəsi və satış", ru: "Клиентский опыт и продажи",
    syn: { en: ["customers", "commercial"], az: ["müştərilər", "abunəçilər"], ru: ["клиенты", "абоненты"] },
    children: [
      { key: "customer_experience", en: "Customer experience", az: "Müştəri təcrübəsi", ru: "Клиентский опыт", syn: { en: ["CX", "customer journey", "NPS"], az: ["müştəri yolu"], ru: ["путь клиента"] } },
      { key: "sales", en: "Sales and account management", az: "Satış və korporativ müştərilərlə iş", ru: "Продажи и работа с ключевыми клиентами", syn: { en: ["B2B", "selling", "key accounts"], az: ["korporativ satış"], ru: ["корпоративные продажи"] } },
      { key: "marketing", en: "Marketing and brand", az: "Marketinq və brend", ru: "Маркетинг и бренд", syn: { en: ["campaigns", "digital marketing"], az: ["kampaniyalar"], ru: ["кампании"] } },
      { key: "customer_support", en: "Customer care", az: "Müştəri xidmətləri", ru: "Обслуживание клиентов", syn: { en: ["call centre", "complaints"], az: ["çağrı mərkəzi"], ru: ["колл-центр"] } },
    ],
  },
  {
    key: "people", en: "People and culture", az: "İnsan resursları və korporativ mədəniyyət", ru: "Персонал и корпоративная культура",
    syn: { en: ["HR", "human resources"], az: ["HR", "kadr"], ru: ["HR", "кадры"] },
    children: [
      { key: "hiring", en: "Hiring and onboarding", az: "İşə qəbul və adaptasiya", ru: "Подбор и адаптация персонала", syn: { en: ["recruitment", "interviewing"], az: ["işə götürmə"], ru: ["рекрутинг", "собеседования"] } },
      { key: "performance", en: "Performance conversations", az: "Fəaliyyətin müzakirəsi", ru: "Разговоры об эффективности", syn: { en: ["appraisal", "goal setting"], az: ["qiymətləndirmə söhbəti"], ru: ["оценка эффективности"] } },
      { key: "inclusion", en: "Inclusion and diversity", az: "Inklüzivlik və müxtəliflik", ru: "Инклюзивность и разнообразие", syn: { en: ["DEI", "diversity"], az: ["bərabər imkanlar"], ru: ["равные возможности"] } },
      { key: "engagement", en: "Engagement and culture", az: "Cəlbolunma və mədəniyyət", ru: "Вовлечённость и культура", syn: { en: ["motivation", "team spirit"], az: ["motivasiya"], ru: ["мотивация"] } },
    ],
  },
];

export interface CatalogueInterest { key: string; en: string; az: string; ru: string }

export const INTEREST_CATALOGUE: CatalogueInterest[] = [
  { key: "reading", en: "Reading", az: "Kitab oxumaq", ru: "Чтение" },
  { key: "running", en: "Running", az: "Qaçış", ru: "Бег" },
  { key: "football", en: "Football", az: "Futbol", ru: "Футбол" },
  { key: "chess", en: "Chess", az: "Şahmat", ru: "Шахматы" },
  { key: "travel", en: "Travel", az: "Səyahət", ru: "Путешествия" },
  { key: "photography", en: "Photography", az: "Fotoqrafiya", ru: "Фотография" },
  { key: "music", en: "Music", az: "Musiqi", ru: "Музыка" },
  { key: "cooking", en: "Cooking", az: "Yemək bişirmək", ru: "Кулинария" },
  { key: "volunteering", en: "Volunteering", az: "Könüllülük", ru: "Волонтёрство" },
  { key: "hiking", en: "Hiking", az: "Dağ gəzintiləri", ru: "Походы" },
  { key: "cycling", en: "Cycling", az: "Velosiped sürmək", ru: "Велоспорт" },
  { key: "yoga", en: "Yoga and wellbeing", az: "Yoqa və sağlam həyat", ru: "Йога и здоровый образ жизни" },
  { key: "gaming", en: "Video games", az: "Video oyunlar", ru: "Видеоигры" },
  { key: "film", en: "Film and series", az: "Kino və seriallar", ru: "Кино и сериалы" },
  { key: "art", en: "Art and museums", az: "İncəsənət və muzeylər", ru: "Искусство и музеи" },
  { key: "theatre", en: "Theatre", az: "Teatr", ru: "Театр" },
  { key: "startups", en: "Startups", az: "Startaplar", ru: "Стартапы" },
  { key: "gadgets", en: "Technology and gadgets", az: "Texnologiya və qadcetlər", ru: "Технологии и гаджеты" },
  { key: "languages", en: "Learning languages", az: "Dil öyrənmək", ru: "Изучение языков" },
  { key: "board_games", en: "Board games", az: "Stolüstü oyunlar", ru: "Настольные игры" },
  { key: "writing", en: "Writing", az: "Yazıçılıq", ru: "Писательство" },
  { key: "swimming", en: "Swimming", az: "Üzgüçülük", ru: "Плавание" },
  { key: "tennis", en: "Tennis", az: "Tennis", ru: "Теннис" },
  { key: "gardening", en: "Gardening", az: "Bağçılıq", ru: "Садоводство" },
  { key: "history", en: "History and culture", az: "Tarix və mədəniyyət", ru: "История и культура" },
];
