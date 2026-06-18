# Хронология дорожной карты

Этот файл хранит общий хронологический список завершенных планов разработки GotMeds.

Новые записи добавляются после завершения разработки и проверки владельцем проекта, до `commit`, `push` и создания pull request.

Записи добавляются в конец файла, чтобы порядок шел от старых работ к новым.

## Формат записи

```md
## ГГГГ-ММ-ДД - Название завершенного плана

- План: `plans/completed/<имя-файла>.md`
- Области: данные, frontend и дизайн, backend и API
- Сделано: краткое описание завершенной работы
- Проверка: краткое описание выполненной проверки
- Pull request: ссылка или номер pull request, если он уже известен; если pull request еще не создан, указать `будет создан после push`
```

## Записи

## 2026-06-10 - Публичный бренд и мобильная полировка UI

- План: [plans/completed/ui-brand-and-mobile-polish.md](../plans/completed/ui-brand-and-mobile-polish.md)
- Области: frontend и дизайн, админ-панель и безопасность
- Сделано: синхронизирован публичный бренд `где.таблетка` в клиентских и административных экранах, бренд-блок получил переход на главную `/`, уточнен заголовок обучающего блока, подправлены компактность кнопок админки, mobile chips и мобильная кнопка поиска на карте.
- Проверка: пользователь проверил интерфейс вручную; выполнены `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-05-11 - Инициализация и слой данных

- План: [plans/completed/phase-1-init.md](../plans/completed/phase-1-init.md)
- Области: данные, backend и API, frontend и дизайн, SEO и аналитика, инфраструктура и качество, структура проекта
- Сделано: создан стартовый Next.js-контур GotMeds, подключены Prisma и PostgreSQL, добавлена Prisma-схема с городами, аптеками, товарами, остатками и алиасами, создан seed-скрипт с тестовыми данными и шаблон планов разработки.
- Проверка: проверялись запуск сайта, подключение к базе, наличие таблиц и тестовых данных через Prisma Studio.
- Pull request: будет создан после push

## 2026-05-11 - Ядро поискового движка

- План: [plans/completed/phase-2-search-engine.md](../plans/completed/phase-2-search-engine.md)
- Области: данные, поиск и бизнес-логика, backend и API, инфраструктура и качество
- Сделано: включен `pg_trgm`, добавлены GIN-индексы, реализован `searchProducts(query)` с fuzzy search по товарам и алиасам, фильтрацией социального риска и тестовым endpoint `GET /api/search`.
- Проверка: проверены запросы с опечатками, алиасами, точным совпадением, запрещенным препаратом и мусорным запросом.
- Pull request: будет создан после push

## 2026-05-14 - Базовый интерфейс и интеграция поиска

- План: [plans/completed/phase-3-client-search-ui.md](../plans/completed/phase-3-client-search-ui.md)
- Области: frontend и дизайн, поиск и бизнес-логика, backend и API, SEO и аналитика, инфраструктура и качество
- Сделано: главная страница заменена рабочим поисковым интерфейсом, добавлен компонент `SearchExperience`, состояния загрузки, результата, пустого ответа и ошибки, быстрые категории, юридический дисклеймер и адаптивная desktop-компоновка.
- Проверка: проверены сценарии поиска на главной странице, пустое состояние, обработка ошибки API, desktop-компоновка, `npm run lint` и `npm run build`.
- Pull request: будет создан после push

## 2026-05-16 - Страница препарата и карта аптек

- План: [plans/completed/phase-4-product-map.md](../plans/completed/phase-4-product-map.md)
- Области: backend и API, frontend и дизайн, карта и аптеки, поиск и бизнес-логика, SEO и аналитика, инфраструктура и качество
- Сделано: добавлены SSR-страница препарата, страница карты, серверные действия для деталей препарата и аптек, endpoint `GET /api/pharmacies`, интерактивная карта, карточки аптек, статусы наличия, фильтр «Открыто сейчас», расчет расстояния и действия связи с аптекой.
- Проверка: проверены переходы из поиска, metadata страницы продукта, карта, список аптек, отказ GPS, ручной выбор точки, карточка аптеки, `npm run lint` и `npm run build`.
- Pull request: будет создан после push

## 2026-05-19 - Админ-панель и импорт прайс-листов

- План: [plans/completed/phase-5-admin-import.md](../plans/completed/phase-5-admin-import.md)
- Области: данные, backend и API, frontend и дизайн, админ-панель и безопасность, инфраструктура и качество
- Сделано: добавлена защищенная админ-панель, админская авторизация, модели `Admin` и `UnmappedString`, загрузка CSV-прайсов Tier 2 аптек, full sync остатков, очередь нераспознанных строк, ручное связывание и игнорирование alias, страницы `/admin`, `/admin/login`, `/admin/inventory-upload` и `/admin/mapping`.
- Проверка: проверены защита `/admin`, вход администратора, загрузка CSV, замещение остатков, маппинг, игнорирование мусора, повторная загрузка через alias, ссылка администратора на главной, `npm run lint` и `npm run build`.
- Pull request: будет создан после push

## 2026-05-19 - Изменение структуры проекта

- План: [plans/completed/project-structure-change.md](../plans/completed/project-structure-change.md)
- Области: структура проекта, инфраструктура и качество
- Сделано: папка технических спецификаций переименована в `spec/technical/`, старый журнал изменений заменен на `roadmap/` с общей хронологией и областями, завершенные планы переведены на новые ссылки, обновлены `AGENTS.md` и проектный skill, удалены логические хвосты в завершенных планах и техническом плане реализации.
- Проверка: выполнены проверки отсутствия старых путей, проверка markdown-ссылок, проверка завершенных статусов в `plans/completed/` и `npm run lint`.
- Pull request: будет создан после push

## 2026-05-19 - Ограниченный поиск и черный список

- План: [plans/completed/restricted-search-blacklist.md](../plans/completed/restricted-search-blacklist.md)
- Области: поиск и бизнес-логика, backend и API, frontend и дизайн, карта и аптеки, админ-панель и безопасность, инфраструктура и качество
- Сделано: добавлен restricted-сценарий поиска для товаров `is_social_risk`, специальная заглушка ограниченного поиска на главной и `/map`, защищенный раздел `/admin/blacklist` для управления черным списком и визуальное выравнивание бренда/контролов админки.
- Проверка: проверены restricted-запрос `диазепам`, обычный запрос `нурафен`, пользовательская проверка в браузере, `npm run lint` и `npm run build`.
- Pull request: будет создан после push

## 2026-05-20 - Аналоги препаратов

- План: [plans/completed/phase-6-analogs.md](../plans/completed/phase-6-analogs.md)
- Области: данные, поиск и бизнес-логика, backend и API, frontend и дизайн, SEO и аналитика, инфраструктура и качество
- Сделано: добавлен `getAnalogs(productId)`, уточнены спецификации аналогов по действующему веществу, категории и форме выпуска, добавлен раскрывающийся блок аналогов на странице препарата и тестовая пара `Но-Шпа` / `Дротаверин` в seed-данных.
- Проверка: проверены `Но-Шпа` -> `Дротаверин`, `Дротаверин` -> `Но-Шпа`, отсутствие `Нурофен Детский` в аналогах взрослого `Нурофен`, повторный seed, `npm run lint` и `npm run build`.
- Pull request: будет создан после push

## 2026-05-20 - Исправление поиска на странице карты

- План: [plans/completed/fix-map-search-refresh.md](../plans/completed/fix-map-search-refresh.md)
- Области: карта и аптеки, frontend и дизайн, инфраструктура и качество
- Сделано: поиск через верхнюю строку `/map` теперь пересоздает внутреннее состояние карты при смене query/препарата, сбрасывая старые аптеки, выбранную аптеку и GPS/fallback-состояние.
- Проверка: пользователь проверил повторный поиск внутри карты, выполнены `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-05-20 - Аналитика нулевой выдачи

- План: [plans/completed/phase-7-zero-result-analytics.md](../plans/completed/phase-7-zero-result-analytics.md)
- Области: данные, поиск и бизнес-логика, backend и API, frontend и дизайн, админ-панель и безопасность, SEO и аналитика, инфраструктура и качество
- Сделано: добавлены `SearchLog` и таблица `search_logs`, Server Action `logZeroResultSearch`, антишум-логирование стабильной пустой выдачи на главной странице и уточнения спецификаций по live-search.
- Проверка: пользователь проверил сценарий, выполнены `npx prisma generate`, `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-05-20 - Дашборд дефицитных позиций

- План: [plans/completed/phase-8-admin-demand-dashboard.md](../plans/completed/phase-8-admin-demand-dashboard.md)
- Области: данные, backend и API, frontend и дизайн, админ-панель и безопасность, SEO и аналитика, инфраструктура и качество
- Сделано: добавлен защищенный раздел `/admin/demand`, серверная агрегация `search_logs` за 7 дней, топ-50 дефицитных запросов по городу, объединение похожих формулировок через `SIMILARITY`, счетчик нулевой выдачи на `/admin` и адаптивная таблица отчета.
- Проверка: пользователь проверил страницу и адаптивность, выполнены `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-05-20 - CRUD аптек и статусы

- План: [plans/completed/phase-9-admin-pharmacy-crud.md](../plans/completed/phase-9-admin-pharmacy-crud.md)
- Области: backend и API, frontend и дизайн, карта и аптеки, админ-панель и безопасность, инфраструктура и качество
- Сделано: добавлен защищенный раздел `/admin/pharmacies`, серверные действия создания и редактирования аптек, таблица справочника, формы управления координатами, tier, статусами, контактами и графиком работы, переход с `/admin` и мобильная группировка карточек аптек с понятной кнопкой редактирования.
- Проверка: пользователь проверил создание, редактирование и мобильную верстку раздела аптек, выполнены `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-05-23 - Редизайн главной страницы и графическая карта

- Планы: [plans/completed/homepage-graphic-map.md](../plans/completed/homepage-graphic-map.md), [plans/completed/homepage-production-redesign.md](../plans/completed/homepage-production-redesign.md), [plans/completed/sync-graphic-map-colors-and-layouts.md](../plans/completed/sync-graphic-map-colors-and-layouts.md)
- Области: frontend и дизайн, поиск и бизнес-логика, SEO и аналитика, инфраструктура и качество
- Сделано: создана HTML-графическая карта главной страницы, рабочая главная `/` переведена на новый desktop/mobile дизайн с аптечным hero-фоном, glassmorphism-поиском, fixed-header, новым логотипом, анимированной кардиограммой и глобальными бренд-цветами `#316276` / `#1e4d5f`; дублирующий hero-ассет удален.
- Проверка: пользователь принял desktop и mobile вид главной страницы, выполнены `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-05-28 - Визуальное обновление карты и внутренних страниц

- План: [plans/completed/internal-pages-visual-refresh.md](../plans/completed/internal-pages-visual-refresh.md)
- Области: frontend и дизайн, карта и аптеки, админ-панель и безопасность, SEO и аналитика, инфраструктура и качество
- Сделано: обновлены визуальные состояния `/map`, карточек аптек, правой панели «Аптеки рядом», внутренних страниц админки и блока аналогов на странице препарата; добавлены SVG-иконки, компактные кнопки, нейтральные hover-состояния, ограничение списка аптек четырьмя ближайшими и внутренний скролл полного списка.
- Проверка: пользователь проверил карту, админку и страницу препарата по чеклисту, выполнены `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-05-30 - PWA и SEO-инфраструктура

- План: [plans/completed/pwa-seo-foundation.md](../plans/completed/pwa-seo-foundation.md)
- Области: frontend и дизайн, backend и API, SEO и аналитика, инфраструктура и качество
- Сделано: добавлены PWA-манифест, иконки, регистрация service worker, offline-экран с повторной проверкой соединения, `robots.txt`, `sitemap.xml`, базовый Open Graph route для продукта и общие site metadata.
- Проверка: пользователь проверил PWA-манифест и offline-сценарий в браузере, выполнены `node --check public/sw.js`, `npm run lint` и `npm run build`.
- Pull request: будет создан после push

## 2026-05-30 - Стратегия миграции на Supabase

- План: [plans/completed/supabase-migration-strategy-spec.md](../plans/completed/supabase-migration-strategy-spec.md)
- Области: данные, backend и API, админ-панель и безопасность, инфраструктура и качество
- Сделано: создана техническая стратегия поэтапного перехода с `Next.js -> Prisma -> PostgreSQL` на Supabase Platform, обновлены спецификации стека, данных, API, безопасности и админ-панели; зафиксировано правило, что Prisma удаляется только финальным отдельным планом после проверки функционального паритета.
- Проверка: пользователь проверил стратегию, выполнен `git diff --check`, код приложения, зависимости, `prisma/` и `.env` не изменялись.
- Pull request: будет создан после push

## 2026-05-31 - Supabase PostgreSQL foundation

- План: [plans/completed/supabase-postgresql-foundation.md](../plans/completed/supabase-postgresql-foundation.md)
- Области: данные, backend и API, инфраструктура и качество
- Сделано: GotMeds подключен к Supabase PostgreSQL через текущий Prisma-слой без изменения runtime-кода, UI, авторизации и доменной модели; применены текущие Prisma migrations, проверены `pg_trgm`, GIN-индексы, seed и базовые сценарии приложения.
- Проверка: пользователь проверил Supabase-подключение и SQL-проверки, выполнены `npx prisma migrate deploy`, `npx prisma migrate status`, `npx prisma generate`, двойной `npx prisma db seed`, runtime-проверка Server Actions, `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-06-01 - Supabase SQL migrations and seed

- План: [plans/completed/supabase-sql-migrations-and-seed.md](../plans/completed/supabase-sql-migrations-and-seed.md)
- Области: данные, backend и API, инфраструктура и качество
- Сделано: создана Supabase SQL-миграция начальной схемы GotMeds, SQL-seed с тестовым набором из Prisma seed и инструкция проверки `supabase/README.md`; Prisma migrations и `prisma/seed.ts` сохранены как rollback-слой.
- Проверка: пользователь проверил миграцию и seed на отдельном тестовом Supabase project, подтвердил `pg_trgm`, таблицы, GIN-индексы, счетчики seed-данных и работу Prisma runtime с SQL-созданной базой; выполнены `npx prisma generate`, `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-06-01 - Supabase read layer

- План: [plans/completed/supabase-read-layer.md](../plans/completed/supabase-read-layer.md)
- Области: данные, backend и API, поиск и бизнес-логика, карта и аптеки, админ-панель и безопасность, SEO и аналитика, инфраструктура и качество
- Сделано: добавлен server-only Supabase helper, RPC-функции чтения для поиска, карточки продукта, аналогов, аптек, sitemap и дашборда дефицита; `searchProducts`, `getProductDetails`, `getAnalogs`, `getPharmaciesByProduct`, `sitemap.xml` и `getDemandDashboardData` переведены на Supabase SDK/RPC без изменения UI-контрактов.
- Проверка: пользователь применил RPC-миграцию в тестовом Supabase project, подтвердил функции `gotmeds_%` в схеме `public`, права `anon=false`, `authenticated=false`, `service_role=true`, проверил поиск, alias, restricted-сценарий, страницу `Но-Шпа`, аналоги, карту, sitemap и `/admin/demand`; выполнены `npx prisma generate`, `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-06-02 - Supabase Auth and RLS

- План: [plans/completed/supabase-auth-rls.md](../plans/completed/supabase-auth-rls.md)
- Области: данные, backend и API, админ-панель и безопасность, инфраструктура и качество
- Сделано: админская авторизация переведена на Supabase Auth, добавлен cookie-based server auth layer, `requireAdmin()` проверяет Supabase-сессию и доменную роль администратора, а SQL-миграция связывает `admins.auth_user_id` с `auth.users` и включает RLS-политики для публичных и чувствительных таблиц.
- Проверка: пользователь подтвердил ручную проверку Supabase Auth, RLS-политик и админских сценариев; выполнены `npx prisma generate`, `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-06-02 - Supabase admin mutations

- План: [plans/completed/supabase-admin-mutations.md](../plans/completed/supabase-admin-mutations.md)
- Области: данные, backend и API, поиск и бизнес-логика, карта и аптеки, админ-панель и безопасность, SEO и аналитика, инфраструктура и качество
- Сделано: админские операции CRUD аптек, CSV full sync, маппинг alias, игнорирование строк, черный список и запись аналитики нулевой выдачи переведены с Prisma runtime-запросов на Supabase SDK/RPC; добавлена SQL-миграция админских RPC и сохранен Prisma rollback/seed-слой.
- Проверка: пользователь проверил Supabase migration/RPC-права, CRUD аптек, CSV full sync, маппинг alias, черный список, аналитику нулевой выдачи; выполнены `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-06-02 - Legacy database decommission

- План: [plans/completed/legacy-database-decommission.md](../plans/completed/legacy-database-decommission.md)
- Области: данные, backend и API, админ-панель и безопасность, инфраструктура и качество
- Сделано: удалены Prisma runtime-слой, `prisma/`, `prisma.config.ts`, `src/lib/prisma.ts`, legacy DB-зависимости и seed-конфигурация; текущие спецификации и Supabase-инструкции синхронизированы с состоянием без legacy database fallback.
- Проверка: пользователь подтвердил ручную проверку ключевых Supabase-сценариев; выполнены `npm run lint`, `npm run build` и `git diff --check`.
- Pull request: будет создан после push

## 2026-06-02 - Phase 10 Testing & Quality Foundation

- План: [plans/completed/phase-10-testing-quality.md](../plans/completed/phase-10-testing-quality.md)
- Области: инфраструктура и качество, frontend и дизайн, backend и API, поиск и бизнес-логика, карта и аптеки, админ-панель и безопасность, SEO и аналитика
- Сделано: добавлены Jest unit-тесты Server Actions, Cypress E2E-сценарии MVP, LHCI-конфигурация с порогами качества, npm-скрипты `test:unit`, `test:e2e`, `test:lighthouse`, `test:quality`, fixture CSV для E2E, а также точечные UI-фиксы иконок и предупреждения ошибки входа администратора.
- Проверка: пользователь проверил исправления интерфейса; выполнены `npm run lint`, `npm run build`, `npm run test:unit` и `git diff --check`.
- Pull request: будет создан после push

## 2026-06-07 - Pre-deploy readiness

- План: [plans/completed/pre-deploy-readiness.md](../plans/completed/pre-deploy-readiness.md)
- Области: данные, поиск и бизнес-логика, backend и API, frontend и дизайн, карта и аптеки, админ-панель и безопасность, SEO и аналитика, инфраструктура и качество
- Сделано: спецификации синхронизированы перед пробным деплоем, CI/CD вынесен в будущий отдельный этап, добавлен rate limiting публичных API, реализованы пользовательские жалобы на аптеку и админская модерация, подготовлен `.env.example`, уточнены Supabase-инструкции, исправлен ложный `404` на SSR-странице продукта при временной ошибке Supabase.
- Проверка: выполнены `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:lighthouse` и `git diff --check`; `npm run test:e2e` не запускался из-за отсутствия тестовых админских Supabase credentials.
- Pull request: будет создан после push

## 2026-06-10 - Фирменный логотип и публичное имя приложения

- План: [plans/completed/brand-logo-and-public-app-name.md](../plans/completed/brand-logo-and-public-app-name.md)
- Области: frontend и дизайн, админ-панель и безопасность, SEO и аналитика, инфраструктура и качество
- Сделано: публичный бренд `где.таблетка` закреплен в спецификациях, добавлен новый pin-логотип с таблеткой, локально подключен `Montserrat` для брендового текста, обновлены PWA-иконки, browser/PWA metadata, SEO-суффиксы и статичное выделение `где.таблетка` в заголовке обучающего блока.
- Проверка: пользователь проверил интерфейс вручную; выполнены `npm run lint`, `npm run build` с сетевым доступом для существующего `Hanken Grotesk`, `git diff --check` и локальная HTTP-проверка title/manifest.
- Pull request: будет создан после push

## 2026-06-16 - Отказоустойчивость импорта и управление синонимами

- План: [plans/completed/mapping-and-pipeline-resilience.md](../plans/completed/mapping-and-pipeline-resilience.md)
- Области: данные, backend и API, frontend и дизайн, админ-панель и безопасность, инфраструктура и качество
- Сделано: внедрена валидация безопасного порога (threshold) снижения остатков в `uploadPharmacyPrice` (блокировка при падении > 50% при условии > 10 товаров в базе), добавлен чекбокс «Принудительная загрузка» (флаг `forceUpload`) в форму загрузки прайс-листов, создана страница управления синонимами `/admin/aliases` со списком, пагинацией, поиском по оригинальной строке и препарату, реализован Server Action удаления ошибочных синонимов с RLS-защитой для модерации ошибок ручного маппинга.
- Проверка: пользователь проверил защиту импорта и управление синонимами вручную; выполнены `npm run lint`, `npm run build` и `npm run test:unit`.
- Pull request: будет создан после push

## 2026-06-16 - Расширение черного списка и повышение безопасности

- План: [plans/completed/blacklist-and-safety-polish.md](../plans/completed/blacklist-and-safety-polish.md)
- Области: данные, backend и API, frontend и дизайн, админ-панель и безопасность, SEO и аналитика, инфраструктура и качество
- Сделано: расширены правила черного списка для исключения заблокированных товаров из аналогов, карты аптек, sitemap и поиска; создана SQL-миграция для расширения RPC `gotmeds_get_product_details` (поле `is_social_risk`), обновлена логика `getProductDetails`, `getAnalogs` и `getPharmaciesByProduct`; реализована restricted-страница продукта с `noindex` мета-тегом для SEO-безопасности; обновлены регламенты SLA аптек, 152-ФЗ (логирование поиска) и маппинга в спецификациях.
- Проверка: пользователь проверил блокировку продукта, аналоги, карту и мета-теги с помощью тестового UUID Диазепама; выполнены unit-тесты (`npm run test:unit`), проверка линтера (`npm run lint`) и сборка (`npm run build`).
- Pull request: будет создан после push

## 2026-06-18 - Сотрудничество с аптеками и онлайн-онбординг

- План: [plans/completed/pharmacy-cooperation-onboarding.md](../plans/completed/pharmacy-cooperation-onboarding.md)
- Области: данные, backend и API, frontend и дизайн, админ-панель и безопасность, инфраструктура и качество
- Сделано: Создана SQL-миграция для таблицы `partner_requests` с RLS и RPC-функциями; реализованы Server Actions для отправки и обработки заявок; добавлен адаптивный B2B-блок сотрудничества на главную страницу с динамической подстройкой высоты; создана страница `/partner` с формой обратной связи и SLA; реализована страница модерации `/admin/partner-requests` для администраторов; исправлен баг посимвольного фолбека кириллицы в заголовках и логотипе путем подключения subsets `cyrillic-ext` для `Hanken Grotesk`; обновлены спецификации B2B-блока.
- Проверка: Проведены ручные проверки формы `/partner`, страницы модерации и синхронизации высот; выполнены unit-тесты (`npm run test:unit`), проверка линтера (`npm run lint`) и сборка (`npm run build`).
- Pull request: будет создан после push


## 2026-06-18 - Оптимизация страницы продукта и README для миграций

- План: [plans/completed/product-page-layout-migrations-readme.md](../plans/completed/product-page-layout-migrations-readme.md)
- Области: frontend и дизайн, backend и API, инфраструктура и качество
- Сделано: Улучшено распределение вертикального пространства на странице продукта (shell переведен на flexbox, disclaimerBlock прижат к низу, увеличены отступы productHero); добавлен ResizeObserver для динамического вычисления высоты результатов поиска на главной странице для исключения пустой белой зоны; упрощен supabase/README.md с удалением устаревающих проверок схемы данных.
- Проверка: Выполнены ручные проверки верстки страницы продукта и главной страницы с результатами, а также выполнена успешная сборка проекта (npm run build).
- Pull request: будет создан после push
