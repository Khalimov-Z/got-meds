# Данные

Этот файл хранит хронологию завершенных работ, которые относятся к модели данных, Prisma, PostgreSQL, миграциям, seed-данным и импорту остатков GotMeds.

## Формат записи

```md
## ГГГГ-ММ-ДД - Название завершенного плана

- План: `plans/completed/<имя-файла>.md`
- Сделано: что изменилось в данных
- Влияние: как это влияет на хранение, обновление или использование данных
- Проверка: как была проверена работа
```

## Записи

## 2026-05-11 - Инициализация и слой данных

- План: [plans/completed/phase-1-init.md](../../plans/completed/phase-1-init.md)
- Сделано: добавлена Prisma-схема с моделями `City`, `Pharmacy`, `Product`, `Inventory`, `ProductAlias` и enum-типами для аптек, товаров и статусов наличия.
- Влияние: проект получил основу для мультигородской структуры, справочника товаров, аптек и связей наличия.
- Проверка: таблицы и seed-данные проверялись через Prisma Studio.

## 2026-05-11 - Ядро поискового движка

- План: [plans/completed/phase-2-search-engine.md](../../plans/completed/phase-2-search-engine.md)
- Сделано: добавлена миграция `pg_trgm` и GIN-индексы на `products.name` и `product_aliases.original_string`.
- Влияние: база данных начала поддерживать быстрый нечеткий поиск по товарам и алиасам.
- Проверка: поисковые запросы с опечатками и алиасами вернули ожидаемые товары.

## 2026-05-19 - Админ-панель и импорт прайс-листов

- План: [plans/completed/phase-5-admin-import.md](../../plans/completed/phase-5-admin-import.md)
- Сделано: добавлены модели `Admin` и `UnmappedString`, расширен `ProductAlias` поддержкой ignored alias, добавлена миграция для админского входа, очереди маппинга и импорта прайсов.
- Влияние: данные остатков Tier 2 аптек можно обновлять через CSV, а нераспознанные строки сохраняются для ручного маппинга.
- Проверка: проверены загрузка CSV, full sync остатков, очередь нераспознанных строк, создание alias и игнорирование мусора.

## 2026-05-20 - Аналоги препаратов

- План: [plans/completed/phase-6-analogs.md](../../plans/completed/phase-6-analogs.md)
- Сделано: seed-данные расширены препаратом `Дротаверин` и остатками в Tier 2/3 аптеках для проверки пары аналогов с `Но-Шпа`.
- Влияние: локальная тестовая база содержит проверяемый положительный сценарий для подбора аналогов.
- Проверка: выполнен повторный `npx prisma db seed`, после чего подтверждена пара `Дротаверин` / `Но-Шпа`.

## 2026-05-20 - Аналитика нулевой выдачи

- План: [plans/completed/phase-7-zero-result-analytics.md](../../plans/completed/phase-7-zero-result-analytics.md)
- Сделано: добавлены модель `SearchLog`, связь с `City`, миграция `search_logs` и очистка логов в seed-скрипте.
- Влияние: база данных сохраняет стабилизированные запросы без результата для будущей аналитики неудовлетворенного спроса.
- Проверка: выполнены `npx prisma generate`, `npm run build` и пользовательская проверка записи в `search_logs`.

## 2026-05-20 - Дашборд дефицитных позиций

- План: [plans/completed/phase-8-admin-demand-dashboard.md](../../plans/completed/phase-8-admin-demand-dashboard.md)
- Сделано: существующие данные `search_logs` используются для агрегированного отчета по городу, периоду и похожим поисковым формулировкам.
- Влияние: накопленные события нулевой выдачи стали прикладным источником данных для админской аналитики без изменения схемы базы.
- Проверка: пользователь проверил отчет, выполнены `npm run lint` и `npm run build`.

## 2026-05-30 - Стратегия миграции на Supabase

- План: [plans/completed/supabase-migration-strategy-spec.md](../../plans/completed/supabase-migration-strategy-spec.md)
- Сделано: в спецификации данных закреплено целевое хранение в Supabase PostgreSQL, будущий перенос схемы на Supabase SQL migrations, требования к RLS и роль SQL functions/RPC для запросов рядом с данными.
- Влияние: доменная модель данных остается совместимой, а миграция схемы и seed будет выполняться отдельным этапом без немедленного удаления Prisma.
- Проверка: пользователь проверил стратегию, выполнен `git diff --check`.

## 2026-05-31 - Supabase PostgreSQL foundation

- План: [plans/completed/supabase-postgresql-foundation.md](../../plans/completed/supabase-postgresql-foundation.md)
- Сделано: текущие Prisma migrations применены к Supabase PostgreSQL, подтверждены расширение `pg_trgm`, GIN-индексы `idx_products_name_trgm` и `idx_product_aliases_original_string_trgm`, а seed выполнен дважды на новой базе.
- Влияние: Supabase PostgreSQL стал рабочим хранилищем переходного этапа без изменения Prisma-схемы, runtime data layer и доменной модели.
- Проверка: выполнены `npx prisma migrate deploy`, `npx prisma migrate status`, SQL-проверки расширения/индексов, двойной `npx prisma db seed` и проверка счетчиков seed-данных.

## 2026-06-01 - Supabase SQL migrations and seed

- План: [plans/completed/supabase-sql-migrations-and-seed.md](../../plans/completed/supabase-sql-migrations-and-seed.md)
- Сделано: добавлена SQL-миграция `supabase/migrations/20260531120000_initial_schema.sql` с enum, таблицами, foreign keys, unique constraints, GIN-индексами и `pg_trgm`, а также `supabase/seed.sql` с тестовым набором из `prisma/seed.ts`.
- Влияние: чистая тестовая Supabase PostgreSQL база воспроизводится SQL-артефактами без изменения текущей Prisma-схемы и production-данных.
- Проверка: пользователь применил SQL-миграцию и seed через Supabase SQL Editor, проверил `pg_trgm`, таблицы, GIN-индексы, счетчики `cities=1`, `pharmacies=3`, `products=16`, `product_aliases=5`, `inventory=24`, `admins=1` и флаг `is_social_risk` для `Диазепам`.

## 2026-06-01 - Supabase read layer

- План: [plans/completed/supabase-read-layer.md](../../plans/completed/supabase-read-layer.md)
- Сделано: добавлена SQL-миграция `supabase/migrations/20260601120000_read_layer_functions.sql` с RPC-функциями чтения для существующих таблиц без изменения доменной схемы.
- Влияние: публичные и аналитические read-сценарии читают данные через Supabase SQL functions/RPC, а Prisma остается переходным rollback-слоем для write/auth/admin-mutation сценариев.
- Проверка: пользователь применил RPC-миграцию в тестовом Supabase project, подтвердил наличие функций `gotmeds_%` в схеме `public`, работу `gotmeds_search_products` и права выполнения только для `service_role`.

## 2026-06-02 - Supabase Auth and RLS

- План: [plans/completed/supabase-auth-rls.md](../../plans/completed/supabase-auth-rls.md)
- Сделано: добавлено поле `admins.auth_user_id` в Prisma-схему и Supabase SQL-миграцию, создана связь с `auth.users`, helper-функции проверки доменной роли администратора и RLS-политики для таблиц GotMeds.
- Влияние: доменная модель администраторов связана с Supabase Auth, публичное чтение ограничено безопасными данными, а чувствительные таблицы закрыты от `anon` и обычных `authenticated` пользователей.
- Проверка: пользователь подтвердил проверку связки Supabase Auth user с администратором и RLS-политик; выполнены `npx prisma generate`, `npm run lint`, `npm run build` и `git diff --check`.

## 2026-06-02 - Supabase admin mutations

- План: [plans/completed/supabase-admin-mutations.md](../../plans/completed/supabase-admin-mutations.md)
- Сделано: добавлена SQL-миграция `20260602120000_admin_mutations.sql` с RPC для атомарного CSV full sync, маппинга alias, игнорирования строк и переключения `products.is_social_risk`; UUID-первичные ключи SQL-схемы приведены к Prisma `@default(uuid())`.
- Влияние: админские изменения данных выполняются через Supabase SDK/RPC рядом с данными, а Prisma остается rollback/seed-слоем до отдельного этапа.
- Проверка: пользователь проверил применение миграции, RPC-права, создание аптек, замену `inventory`/`unmapped_strings`, записи `product_aliases`, флаг `is_social_risk` и `search_logs`; выполнены `npm run lint`, `npm run build` и `git diff --check`.

## 2026-06-02 - Legacy database decommission

- План: [plans/completed/legacy-database-decommission.md](../../plans/completed/legacy-database-decommission.md)
- Сделано: удалены Prisma-схема, Prisma migrations и Prisma seed; текущие источники схемы и тестовых данных закреплены за Supabase SQL migrations и `supabase/seed.sql`.
- Влияние: данные GotMeds больше не имеют отдельного legacy seed/rollback-слоя в `prisma/`; рабочим слоем остается Supabase PostgreSQL с SQL-артефактами проекта.
- Проверка: пользователь подтвердил ручную Supabase-проверку; выполнены `npm run lint`, `npm run build` и `git diff --check`.

## 2026-06-07 - Pre-deploy readiness

- План: [plans/completed/pre-deploy-readiness.md](../../plans/completed/pre-deploy-readiness.md)
- Сделано: добавлена Supabase SQL-миграция для `pharmacy_reports`, enum-статусов и RPC модерации жалоб; seed расширен тестовыми данными для проверки пользовательской жалобы на аптеку.
- Влияние: база поддерживает пользовательские сообщения об ошибках аптек и защищенную админскую обработку этих сообщений без расширения клиентской авторизации.
- Проверка: выполнены `npm run test:unit`, `npm run build` и `git diff --check`; миграция описана в Supabase-инструкции для ручной проверки.
