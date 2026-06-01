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
