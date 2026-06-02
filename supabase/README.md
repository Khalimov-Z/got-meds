# Supabase SQL migrations and seed

Эта папка хранит SQL-артефакты переходного этапа Supabase:

- `migrations/20260531120000_initial_schema.sql` — SQL-эквивалент текущей реализованной Prisma-схемы и существующих Prisma migrations.
- `migrations/20260601120000_read_layer_functions.sql` — RPC-функции чтения для этапа Supabase read layer.
- `migrations/20260601143000_auth_rls.sql` — связь администраторов с Supabase Auth и RLS-политики для этапа Supabase Auth and RLS.
- `seed.sql` — тестовый набор данных, перенесенный из `prisma/seed.ts`.

Prisma остается рабочим rollback-слоем и переходным runtime-слоем для сценариев, которые еще не входят в текущий этап миграции. Этап read layer переводит публичные и аналитические чтения на server-only Supabase SDK/RPC. Этап Auth/RLS переводит вход в админку на Supabase Auth и включает RLS, но не переносит админские мутации и не удаляет Prisma.

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
4. Выполните содержимое `supabase/migrations/20260601143000_auth_rls.sql`.
5. Выполните содержимое `supabase/seed.sql`.

Через `psql`, если он установлен локально:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260531120000_initial_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260601120000_read_layer_functions.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260601143000_auth_rls.sql
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

Для server-only read layer и Supabase Auth задайте локально переменные:

```bash
SUPABASE_URL="https://project-ref.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="server-only-service-role-key"
NEXT_PUBLIC_SUPABASE_URL="https://project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="publishable-or-legacy-anon-key"
```

Эти значения не коммитятся в репозиторий. `SUPABASE_SERVICE_ROLE_KEY` используется только в server-only helper и не должен попадать в клиентские компоненты или публичный JavaScript. Для старых проектов допускается legacy anon key в `NEXT_PUBLIC_SUPABASE_ANON_KEY`, но основной вариант для Auth — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

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

## Проверка Supabase Auth and RLS

После применения `20260601143000_auth_rls.sql` создайте тестового пользователя в Supabase Dashboard: `Authentication` -> `Users` -> `Add user`.

Для локального seed-администратора по умолчанию используется email `admin@gotmeds.local`. Если в вашем Supabase project администратор использует другой email, сначала убедитесь, что один и тот же email есть в `Authentication` -> `Users` и в `public.admins.email`. Пароль задается в Supabase Auth отдельно; legacy `password_hash` остается в таблице `admins` только для rollback-слоя и больше не используется при входе в админку.

Свяжите Auth user с доменным администратором:

```sql
-- Замените admin@example.com на email администратора из Supabase Auth,
-- который совпадает с public.admins.email.
update public.admins as admins
set auth_user_id = users.id
from auth.users as users
where lower(admins.email) = lower(users.email)
  and lower(admins.email) = lower('admin@example.com');

select
  email,
  role,
  auth_user_id is not null as has_auth_user
from public.admins
where lower(email) = lower('admin@example.com');
```

Ожидаемый результат: `has_auth_user = true`, роль `SUPERADMIN` или `CONTENT_MANAGER`.

Проверьте, что RLS включен:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'cities',
    'admins',
    'pharmacies',
    'products',
    'inventory',
    'product_aliases',
    'unmapped_strings',
    'search_logs'
  )
order by tablename;
```

Ожидаемый результат: у всех таблиц `rowsecurity = true`.

Проверьте наличие политик:

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and policyname like 'gotmeds_%'
order by tablename, policyname;
```

Ожидаемый результат: политики публичного чтения есть только для безопасных таблиц, а чувствительные таблицы закрыты админскими политиками.

Проверьте права ролей:

```sql
select
  has_table_privilege('anon', 'public.admins', 'SELECT') as anon_can_read_admins,
  has_table_privilege('authenticated', 'public.admins', 'SELECT') as authenticated_can_read_admins,
  has_function_privilege('anon', 'public.gotmeds_is_admin()', 'EXECUTE') as anon_can_call_is_admin,
  has_function_privilege('authenticated', 'public.gotmeds_is_admin()', 'EXECUTE') as authenticated_can_call_is_admin;
```

Ожидаемый результат: `anon_can_read_admins = false`, `authenticated_can_read_admins = true`, `anon_can_call_is_admin = false`, `authenticated_can_call_is_admin = true`. Чтение `admins` для `authenticated` дополнительно ограничено RLS: неадминский пользователь без записи `admins.auth_user_id` не увидит доменный профиль администратора.

Проверка приложения:

1. Запустите `npm run dev`.
2. Откройте `/admin/login`.
3. Войдите email/password пользователя из Supabase Auth, связанного с `admins.auth_user_id`.
4. Откройте `/admin`, `/admin/pharmacies`, `/admin/inventory-upload`, `/admin/mapping`, `/admin/blacklist` и `/admin/demand`.
5. В приватном окне откройте `/admin`.

Ожидаемый результат: связанный администратор входит в админку, выход возвращает на `/admin/login`, приватное окно без сессии редиректится на `/admin/login`, пользователь Supabase Auth без доменной роли получает отказ.

## Пользовательская приемка

Проверка приложения не дублируется полностью в этом runbook. Для текущего этапа используйте пользовательский чеклист в `plans/active/supabase-auth-rls.md`; после завершения этапа — соответствующий файл в `plans/completed/`.

## Rollback

Если SQL-миграция или seed не проходят на чистой тестовой базе, не применяйте их к рабочей базе. До исправления SQL-артефактов источником схемы остаются `prisma/schema.prisma`, `prisma/migrations/*` и `prisma/seed.ts`.
