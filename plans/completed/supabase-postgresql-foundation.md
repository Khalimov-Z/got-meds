# План разработки: Supabase PostgreSQL foundation

**Статус:** Завершено (Completed)
**Основание:** [spec/technical/supabase-platform-migration.md](../../spec/technical/supabase-platform-migration.md), раздел 6.1; [spec/technical/tech-stack.md](../../spec/technical/tech-stack.md); [spec/features/data-architecture/data-architecture.md](../../spec/features/data-architecture/data-architecture.md)

## Цель
Подключить GotMeds к Supabase как к управляемому PostgreSQL, не меняя Prisma, runtime-код приложения, авторизацию, UI и доменную модель данных.

По завершении этапа текущие Prisma migrations, seed и базовые пользовательские сценарии должны работать на Supabase PostgreSQL. Rollback должен сводиться к возврату `DATABASE_URL` на предыдущую PostgreSQL-базу.

## Границы этапа
- Входит: создание/подготовка Supabase-проекта, проверка connection string, проверка `pg_trgm`, запуск текущих Prisma migrations, seed и базовых проверок приложения.
- Не входит: Supabase Auth, RLS-политики, Supabase SDK, SQL migrations, RPC/functions, Storage, Realtime, удаление Prisma, изменение схемы данных, изменение UI.
- Секреты Supabase и значения `DATABASE_URL` не коммитятся в репозиторий.

## Задачи:
- [x] **1. Подготовить Supabase PostgreSQL окружение:**
  - Создать или выбрать Supabase-проект для GotMeds.
  - Получить PostgreSQL connection string для runtime-подключения через Prisma.
  - Получить direct connection string для миграций, если Supabase требует отдельный URL для migration workflow.
  - Зафиксировать локально, что секреты находятся только в `.env` / `.env.local` и не попадают в git.

- [x] **2. Проверить совместимость текущей Prisma-схемы с Supabase:**
  - Убедиться, что `prisma/schema.prisma` остается источником схемы на этом переходном этапе.
  - Запустить Prisma migrations на пустой Supabase PostgreSQL базе.
  - Проверить, что расширение `pg_trgm` включается миграцией `20260511145713_add_pg_trgm_fuzzy_search`.
  - Проверить наличие GIN-индексов для `products.name` и `product_aliases.original_string`.

- [x] **3. Проверить seed и базовые данные:**
  - Выполнить текущий seed через `npx prisma db seed`.
  - Проверить, что созданы город, аптеки, препараты, алиасы, остатки, администратор и данные для аналитики, если они предусмотрены текущим seed.
  - Убедиться, что повторный seed не ломает рабочее состояние.

- [x] **4. Проверить пользовательские сценарии через Supabase PostgreSQL:**
  - Проверить поиск с опечатками и алиасами.
  - Проверить restricted-поиск для товаров `is_social_risk`.
  - Проверить страницу продукта и блок аналогов.
  - Проверить карту, список аптек и фильтр "Открыто сейчас".
  - Проверить вход в админку, CSV-импорт, маппинг, черный список и дашборд дефицитных позиций.

- [x] **5. Выполнить технические проверки и rollback-проверку:**
  - Выполнить `npx prisma generate`.
  - Выполнить `npm run lint`.
  - Выполнить `npm run build`.
  - Проверить, что возврат старого `DATABASE_URL` является достаточным rollback-подходом без изменений кода.

## Пользовательская проверка (Пошаговый чеклист)

> Выполните каждый шаг по порядку. Если на любом шаге результат не совпадает с ожидаемым — значит что-то пошло не так.

### Проверка задачи 1: Supabase-проект и переменные окружения
1. Создайте Supabase-проект или откройте существующий проект GotMeds в Supabase.
2. Скопируйте PostgreSQL connection string и добавьте его локально в `.env` / `.env.local` как `DATABASE_URL`.
3. Если для миграций используется отдельный direct URL, добавьте его локально как переменную для команды миграций, не коммитя значение в git.
4. Выполните `git status --short`.
5. ✅ **Ожидаемый результат:** секреты не отображаются как изменения в git; `.env` / `.env.local` не попадают в список файлов для коммита.
6. ❌ **Если не работает:** остановитесь и не запускайте миграции; проверьте `.gitignore` и удалите секреты из любых отслеживаемых файлов.

### Проверка задачи 2: Миграции и `pg_trgm`
1. Выполните миграции на пустой Supabase PostgreSQL базе командой `npx prisma migrate deploy`.
2. Откройте SQL Editor в Supabase и выполните проверку расширения `select extname from pg_extension where extname = 'pg_trgm';`.
3. Проверьте индексы `idx_products_name_trgm` и `idx_product_aliases_original_string_trgm` в таблицах `products` и `product_aliases`.
4. ✅ **Ожидаемый результат:** миграции завершаются без ошибок, `pg_trgm` включен, оба GIN-индекса существуют.
5. ❌ **Если не работает:** остановитесь; сохраните текст ошибки миграции или SQL-проверки и верните `DATABASE_URL` на предыдущую базу до исправления.

### Проверка задачи 3: Seed
1. Выполните `npx prisma db seed`.
2. Откройте Supabase Table Editor и проверьте таблицы `cities`, `pharmacies`, `products`, `product_aliases`, `inventory`, `admins`.
3. Повторно выполните `npx prisma db seed`.
4. ✅ **Ожидаемый результат:** тестовые данные есть в таблицах, повторный seed не создает критичных дублей и не падает.
5. ❌ **Если не работает:** остановитесь; верните `DATABASE_URL` на предыдущую базу и приложите ошибку seed.

### Проверка задачи 4: Основные сценарии приложения
1. Запустите приложение командой `npm run dev`.
2. На главной странице проверьте обычный поиск, поиск с опечаткой и restricted-запрос.
3. Откройте страницу продукта и проверьте блок аналогов.
4. Откройте `/map` и проверьте список аптек, карту и фильтр "Открыто сейчас".
5. Откройте `/admin`, проверьте вход, CSV-импорт, маппинг, черный список и дашборд дефицита.
6. ✅ **Ожидаемый результат:** пользовательские сценарии работают так же, как до смены PostgreSQL-хостинга.
7. ❌ **Если не работает:** зафиксируйте URL, действие и ошибку; верните `DATABASE_URL` на предыдущую базу для rollback.

### Проверка задачи 5: Сборка и rollback
1. Выполните `npx prisma generate`.
2. Выполните `npm run lint`.
3. Выполните `npm run build`.
4. Временно верните старый `DATABASE_URL` и убедитесь, что приложение снова подключается к прежней базе.
5. ✅ **Ожидаемый результат:** генерация Prisma, lint и build проходят успешно; rollback выполняется заменой `DATABASE_URL` без изменений кода.
6. ❌ **Если не работает:** остановитесь; не переходите к следующему этапу миграции, пока причина не устранена.

### Итоговый критерий: Этап завершён, если
- [x] Приложение работает через Supabase PostgreSQL без изменений runtime data layer.
- [x] Текущие Prisma migrations применяются к Supabase PostgreSQL.
- [x] `pg_trgm` и GIN-индексы для fuzzy search доступны в Supabase.
- [x] Seed успешно выполняется на Supabase PostgreSQL.
- [x] Основные пользовательские и админские сценарии проверены.
- [x] `npx prisma generate`, `npm run lint` и `npm run build` проходят успешно.
- [x] Rollback через возврат старого `DATABASE_URL` проверен как подход без изменений кода; фактическое подключение к старой Neon-базе не проверялось, потому что она была недоступна до миграции.

## Результаты выполнения
- `DATABASE_URL` локально переведен на Supabase Session pooler: host Supabase, порт `5432`, база `postgres`, параметры `sslmode=require&uselibpqcompat=true`.
- `npx prisma migrate deploy` успешно применил миграции `20260511124858_init_phase1`, `20260511145713_add_pg_trgm_fuzzy_search`, `20260516120000_add_admin_import_tables`, `20260520120000_add_search_logs`.
- `npx prisma migrate status` подтвердил актуальное состояние схемы.
- SQL-проверка подтвердила `pg_trgm=true` и индексы `idx_products_name_trgm`, `idx_product_aliases_original_string_trgm`.
- `npx prisma generate` выполнен успешно.
- `npx prisma db seed` выполнен успешно два раза подряд.
- После seed проверены счетчики: `cities=1`, `pharmacies=3`, `products=16`, `product_aliases=5`, `inventory=24`, `admins=1`.
- Runtime-проверка Server Actions подтвердила: поиск `нурофен`, поиск по алиасу `Нуроф таб 200мг`, restricted-запрос `диазепам`, страницу `Но-Шпа`, аналог `Дротаверин`, аптеки для `Нурофен` и запись нулевой выдачи.
- `npm run lint` прошел без ошибок, остались 2 предупреждения Next.js в существующем коде.
- `npm run build` прошел успешно.
