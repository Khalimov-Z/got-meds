# Supabase SQL migrations and seed

Эта папка хранит SQL-артефакты переходного этапа Supabase:

- `migrations/20260531120000_initial_schema.sql` — SQL-эквивалент текущей реализованной Prisma-схемы и существующих Prisma migrations.
- `migrations/20260601120000_read_layer_functions.sql` — RPC-функции чтения для этапа Supabase read layer.
- `seed.sql` — тестовый набор данных, перенесенный из `prisma/seed.ts`.

Prisma остается рабочим rollback-слоем и переходным runtime-слоем для сценариев, которые еще не входят в текущий этап миграции. Этап read layer переводит публичные и аналитические чтения на server-only Supabase SDK/RPC, но не удаляет Prisma, не переводит write-сценарии, не включает Supabase Auth и не настраивает RLS.

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
3. Выполните содержимое `supabase/migrations/20260601120000_read_layer_functions.sql`.
4. Выполните содержимое `supabase/seed.sql`.

Через `psql`, если он установлен локально:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260531120000_initial_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260601120000_read_layer_functions.sql
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

## Проверка RPC read layer

Для server-only read layer задайте локально серверные переменные:

```bash
SUPABASE_URL="https://project-ref.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="server-only-service-role-key"
```

Эти значения не коммитятся в репозиторий. `SUPABASE_SERVICE_ROLE_KEY` используется только в server-only helper и не должен попадать в клиентские компоненты или публичный JavaScript.

Проверка функций в Supabase SQL Editor:

```sql
select proname
from pg_proc
where proname in (
  'gotmeds_search_products',
  'gotmeds_get_product_details',
  'gotmeds_get_product_analogs',
  'gotmeds_get_pharmacies_by_product',
  'gotmeds_get_sitemap_product_ids',
  'gotmeds_get_demand_dashboard'
)
order by proname;
```

Ожидаемый результат: все шесть RPC-функций присутствуют.

Проверка закрытого публичного доступа:

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'gotmeds_%'
order by p.proname;
```

Ожидаемый результат: `anon_can_execute = false`, `authenticated_can_execute = false`, `service_role_can_execute = true` для read layer функций.

## Пользовательская приемка

Проверка приложения не дублируется в этом runbook. Для текущего этапа используйте пользовательский чеклист в `plans/active/supabase-read-layer.md`; после завершения этапа — соответствующий файл в `plans/completed/`.

## Rollback

Если SQL-миграция или seed не проходят на чистой тестовой базе, не применяйте их к рабочей базе. До исправления SQL-артефактов источником схемы остаются `prisma/schema.prisma`, `prisma/migrations/*` и `prisma/seed.ts`.
