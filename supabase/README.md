# Supabase SQL migrations and seed

Эта папка хранит SQL-артефакты переходного этапа Supabase:

- `migrations/20260531120000_initial_schema.sql` — SQL-эквивалент текущей реализованной Prisma-схемы и существующих Prisma migrations.
- `seed.sql` — тестовый набор данных, перенесенный из `prisma/seed.ts`.

Prisma остается рабочим runtime-слоем и rollback-слоем до отдельных следующих этапов миграции. Этот этап не удаляет Prisma, не переводит приложение на Supabase SDK/RPC, не включает Supabase Auth и не настраивает RLS.

## Важное ограничение

`seed.sql` очищает тестовые таблицы через `TRUNCATE ... CASCADE`. Запускайте его только на отдельной пустой тестовой Supabase PostgreSQL базе или проекте.

Не запускайте `seed.sql` на production-базе и на базе с ручными данными, которые нужно сохранить.

## Аудит схемы

SQL-миграция переносит текущую реализованную Prisma-схему:

- `cities`;
- `admins`;
- `pharmacies`;
- `products`;
- `inventory`;
- `product_aliases`;
- `unmapped_strings`;
- `search_logs`.

Зафиксированное расхождение со спецификацией: `spec/features/data-architecture/data-architecture.md` описывает будущую таблицу `Pharmacy_Reports` и enum для жалоб, но текущая `prisma/schema.prisma` и runtime-код ее пока не реализуют. Эта SQL-миграция не добавляет `pharmacy_reports`, потому что этап 6.2 стратегии ограничен переносом существующей Prisma-схемы. Добавление жалоб требует отдельного утвержденного плана или обновления текущего плана до изменения схемы.

## Применение на чистой тестовой базе

Через Supabase SQL Editor:

1. Откройте отдельный тестовый Supabase project.
2. Выполните содержимое `supabase/migrations/20260531120000_initial_schema.sql`.
3. Выполните содержимое `supabase/seed.sql`.

Через `psql`, если он установлен локально:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260531120000_initial_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
```

`DATABASE_URL` должен указывать на чистую тестовую базу. Значение переменной не коммитится в репозиторий.

## Проверка расширения и индексов

```sql
select extname
from pg_extension
where extname = 'pg_trgm';
```

Ожидаемый результат: одна строка `pg_trgm`.

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_products_name_trgm',
    'idx_product_aliases_original_string_trgm',
    'admins_email_key',
    'unmapped_strings_pharmacy_id_idx',
    'search_logs_city_id_created_at_idx',
    'search_logs_search_term_idx'
  )
order by indexname;
```

Ожидаемый результат: все шесть индексов присутствуют.

## Проверка таблиц и внешних ключей

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'cities',
    'admins',
    'pharmacies',
    'products',
    'inventory',
    'product_aliases',
    'unmapped_strings',
    'search_logs'
  )
order by table_name;
```

Ожидаемый результат: все восемь таблиц присутствуют.

```sql
select conname
from pg_constraint
where contype = 'f'
  and conname in (
    'pharmacies_city_id_fkey',
    'inventory_pharmacy_id_fkey',
    'inventory_product_id_fkey',
    'product_aliases_product_id_fkey',
    'unmapped_strings_pharmacy_id_fkey',
    'search_logs_city_id_fkey'
  )
order by conname;
```

Ожидаемый результат: все шесть внешних ключей присутствуют.

## Проверка seed-данных

```sql
select 'cities' as table_name, count(*) from cities
union all select 'pharmacies', count(*) from pharmacies
union all select 'products', count(*) from products
union all select 'product_aliases', count(*) from product_aliases
union all select 'inventory', count(*) from inventory
union all select 'admins', count(*) from admins
order by table_name;
```

Ожидаемые счетчики:

- `admins = 1`;
- `cities = 1`;
- `inventory = 24`;
- `pharmacies = 3`;
- `product_aliases = 5`;
- `products = 16`.

```sql
select name, is_social_risk
from products
where name in ('Нурофен', 'Диазепам', 'Но-Шпа', 'Дротаверин')
order by name;
```

Ожидаемый результат: товары существуют, а `Диазепам` имеет `is_social_risk = true`.

## Проверка через приложение

1. Укажите локальный `DATABASE_URL` на тестовую Supabase базу, созданную SQL-миграцией.
2. Выполните `npx prisma generate`.
3. Запустите `npm run dev`.
4. Проверьте поиск `нурофен`, алиас `Нуроф таб 200мг`, restricted-запрос `диазепам`, страницу `Но-Шпа` и карту аптек.

Ожидаемый результат: текущий Prisma runtime работает с SQL-созданной базой без изменения поведения приложения.

## Rollback

Если SQL-миграция или seed не проходят на чистой тестовой базе, не применяйте их к рабочей базе. До исправления SQL-артефактов источником схемы остаются `prisma/schema.prisma`, `prisma/migrations/*` и `prisma/seed.ts`.
