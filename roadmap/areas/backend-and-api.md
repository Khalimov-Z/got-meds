# Backend и API

Этот файл хранит хронологию завершенных работ, которые относятся к Server Actions, Route Handlers, серверным контрактам и интеграции с базой данных.

## Формат записи

```md
## ГГГГ-ММ-ДД - Название завершенного плана

- План: `plans/completed/<имя-файла>.md`
- Сделано: что изменилось на серверной стороне
- Влияние: какие серверные сценарии стали доступны
- Проверка: как была проверена работа
```

## Записи

## 2026-05-11 - Инициализация и слой данных

- План: [plans/completed/phase-1-init.md](../../plans/completed/phase-1-init.md)
- Сделано: подключен Prisma ORM v7 с driver adapter и создан `prisma.config.ts`.
- Влияние: серверная часть получила единый способ доступа к PostgreSQL через Prisma.
- Проверка: подключение к базе проверялось через Prisma Studio.

## 2026-05-11 - Ядро поискового движка

- План: [plans/completed/phase-2-search-engine.md](../../plans/completed/phase-2-search-engine.md)
- Сделано: добавлены Server Action `searchProducts(query)`, endpoint `GET /api/search` и Prisma singleton.
- Влияние: поиск стал доступен как серверная операция и как временный API-контракт для проверки без UI.
- Проверка: endpoint проверялся набором запросов с ожидаемыми JSON-ответами.

## 2026-05-16 - Страница препарата и карта аптек

- План: [plans/completed/phase-4-product-map.md](../../plans/completed/phase-4-product-map.md)
- Сделано: добавлены `getProductDetails(productId)`, `getPharmaciesByProduct(productId, lat, lng, isOpenNow)` и endpoint `GET /api/pharmacies`.
- Влияние: страницы продукта и карты получили серверные данные о препарате, аптеках, наличии, графике, контактах и расстоянии.
- Проверка: проверены SSR-страница продукта, карта, повторная загрузка аптек и действия карточки аптеки.

## 2026-05-19 - Админ-панель и импорт прайс-листов

- План: [plans/completed/phase-5-admin-import.md](../../plans/completed/phase-5-admin-import.md)
- Сделано: добавлены серверная авторизация администратора, middleware-защита `/admin/*`, `uploadPharmacyPrice`, `createAlias` и `ignoreAlias`.
- Влияние: администратор может безопасно входить, загружать CSV-прайсы, обновлять остатки и управлять маппингом строк.
- Проверка: проверены защищенные маршруты, вход, загрузка CSV, маппинг, игнорирование и повторное распознавание alias.

## 2026-05-19 - Ограниченный поиск и черный список

- План: [plans/completed/restricted-search-blacklist.md](../../plans/completed/restricted-search-blacklist.md)
- Сделано: расширен серверный контракт поиска restricted-флагом, добавлены admin actions для чтения товаров черного списка и переключения `is_social_risk`.
- Влияние: backend различает отсутствие результата и принудительное ограничение поиска, а админка может управлять ограничением без новой таблицы.
- Проверка: выполнены локальная проверка Server Action, `npm run lint` и `npm run build`.

## 2026-05-20 - Аналоги препаратов

- План: [plans/completed/phase-6-analogs.md](../../plans/completed/phase-6-analogs.md)
- Сделано: добавлен Server Action `getAnalogs(productId)` с фильтрацией по действующему веществу, категории, форме выпуска, restricted-флагу и наличию в активных аптеках Tier 2/3.
- Влияние: продуктовая страница получила серверный контракт для списка доступных и сопоставимых аналогов.
- Проверка: выполнены `npm run lint`, `npm run build` и ручная проверка сценариев аналогов.

## 2026-05-20 - Аналитика нулевой выдачи

- План: [plans/completed/phase-7-zero-result-analytics.md](../../plans/completed/phase-7-zero-result-analytics.md)
- Сделано: добавлены Server Actions `logZeroResultSearch` и `logZeroResultSearchForActiveCity` с валидацией запроса, активного города и координат.
- Влияние: клиентский поиск получил серверный контракт для фоновой записи нулевой выдачи без изменения публичного API поиска.
- Проверка: выполнены `npm run lint`, `npm run build` и пользовательская проверка записи в базе.

## 2026-05-20 - Дашборд дефицитных позиций

- План: [plans/completed/phase-8-admin-demand-dashboard.md](../../plans/completed/phase-8-admin-demand-dashboard.md)
- Сделано: добавлено серверное чтение отчета `getDemandDashboardData(cityId)` с проверкой администратора, агрегацией `search_logs` за 7 дней и объединением похожих запросов через `SIMILARITY`.
- Влияние: админка получила серверный контракт для топ-50 дефицитных запросов без новых публичных API.
- Проверка: выполнены `npm run lint`, `npm run build` и пользовательская проверка отчета.

## 2026-05-20 - CRUD аптек и статусы

- План: [plans/completed/phase-9-admin-pharmacy-crud.md](../../plans/completed/phase-9-admin-pharmacy-crud.md)
- Сделано: добавлены защищенные server actions `getPharmacyManagementData`, `createPharmacy` и `updatePharmacy` с валидацией города, координат, tier, статуса и графика работы.
- Влияние: серверная часть админки получила контракт для управления справочником аптек без физического удаления записей.
- Проверка: выполнены `npm run lint`, `npm run build` и пользовательская проверка создания/редактирования аптек.

## 2026-05-30 - PWA и SEO-инфраструктура

- План: [plans/completed/pwa-seo-foundation.md](../../plans/completed/pwa-seo-foundation.md)
- Сделано: добавлены metadata routes для `robots.txt`, `sitemap.xml` и PWA-манифеста, а sitemap формируется из таблицы товаров с исключением позиций социального риска.
- Влияние: серверная часть стала отдавать поисковикам актуальную карту публичных страниц и закрывать технические маршруты от индексации.
- Проверка: выполнены `npm run lint` и `npm run build`; при недоступной базе sitemap возвращает статические маршруты.

## 2026-05-30 - Стратегия миграции на Supabase

- План: [plans/completed/supabase-migration-strategy-spec.md](../../plans/completed/supabase-migration-strategy-spec.md)
- Сделано: в API-спецификации закреплен будущий Supabase data layer: Supabase SDK для простых операций, SQL functions/RPC для сложной бизнес-логики и Server Actions как серверная граница безопасности.
- Влияние: будущий перенос поиска, карты, аналогов, аналитики и админских операций получил единый контракт без немедленного переписывания runtime-кода.
- Проверка: пользователь проверил стратегию, выполнен `git diff --check`.

## 2026-05-31 - Supabase PostgreSQL foundation

- План: [plans/completed/supabase-postgresql-foundation.md](../../plans/completed/supabase-postgresql-foundation.md)
- Сделано: существующие Server Actions и route handler поиска проверены на Supabase PostgreSQL через текущий Prisma Client без переписывания серверных контрактов.
- Влияние: backend продолжает работать через прежний слой `Next.js -> Prisma -> PostgreSQL`, но PostgreSQL теперь размещен в Supabase как целевой managed-хостинг переходного этапа.
- Проверка: проверены поиск `нурофен`, алиас `Нуроф таб 200мг`, restricted-запрос `диазепам`, `getProductDetails`, `getAnalogs`, `getPharmaciesByProduct`, запись нулевой выдачи и `GET /api/search`.
