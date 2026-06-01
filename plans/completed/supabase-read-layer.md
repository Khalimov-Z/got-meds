# План разработки: Supabase read layer

**Статус:** Завершено (Completed)
**Основание:** [spec/technical/supabase-platform-migration.md](../../spec/technical/supabase-platform-migration.md), раздел 6.3; [spec/technical/api-spec.md](../../spec/technical/api-spec.md); [spec/technical/analogs-api-spec.md](../../spec/technical/analogs-api-spec.md); [spec/features/data-architecture/data-architecture.md](../../spec/features/data-architecture/data-architecture.md), раздел 3.4; [spec/technical/security-performance.md](../../spec/technical/security-performance.md); [spec/technical/seo-page-spec.md](../../spec/technical/seo-page-spec.md)

## Цель
Перенести публичные и аналитические read-сценарии GotMeds с Prisma runtime на server-only Supabase data layer без изменения пользовательского поведения, UI, авторизации, схемы доменных таблиц, write-сценариев и админских мутаций.

По завершении этапа поиск, страница продукта, аналоги, карта аптек, sitemap и чтение дашборда дефицита должны работать через Supabase SDK/RPC, а Prisma должен остаться только для переходных write/auth/admin-mutation сценариев и как rollback-слой до следующих утвержденных этапов.

## Границы этапа
- Входит: добавление server-only Supabase клиента и нужной зависимости, если она отсутствует.
- Входит: добавление SQL functions/RPC для сложных read-запросов: fuzzy search, карточка продукта, аналоги, аптеки для карты, sitemap-список продуктов и аналитика дефицита.
- Входит: перенос `searchProducts`, `getProductDetails`, `getAnalogs`, `getPharmaciesByProduct`, `sitemap.xml` и `getDemandDashboardData` на Supabase read layer с сохранением текущих контрактов ответа.
- Входит: проверка, что `service_role` не используется в браузере, клиентских компонентах и публичном JavaScript.
- Не входит: Supabase Auth, включение RLS-политик, удаление Prisma, переписывание `logZeroResultSearch`, CSV-импорта, маппинга, CRUD аптек, черного списка, админского входа и других write-сценариев.
- Не входит: изменение UI, доменной модели, production-данных, seed-данных и автоматический деплой.
- Prisma migrations, `prisma/schema.prisma`, `prisma/seed.ts` и текущие Prisma write-сценарии остаются в репозитории как переходный rollback-слой.
- Supabase URL и ключи не коммитятся в репозиторий.

## Задачи:
- [x] **1. Провести аудит read-сценариев и подготовить server-only Supabase слой:**
  - Зафиксировать текущие Prisma read-точки в `src/lib/actions/search.ts`, `src/lib/actions/products.ts`, `src/lib/actions/admin.ts` и `src/app/sitemap.ts`.
  - Проверить, какие Prisma-вызовы относятся к read layer 6.3, а какие должны остаться для write/auth/admin-mutation этапов.
  - Добавить зависимость Supabase SDK, если ее еще нет в `package.json`.
  - Создать серверный Supabase helper в `src/lib/` без экспорта секретов в клиентский код.
  - Описать необходимые переменные окружения без реальных значений секретов.

- [x] **2. Добавить SQL functions/RPC для read layer:**
  - Создать Supabase SQL migration с функцией fuzzy search по `products.name` и `product_aliases.original_string` через `pg_trgm`.
  - Перенести restricted-поведение: препарат с `is_social_risk = true` возвращает restricted-состояние и не попадает в обычную выдачу.
  - Создать функцию чтения карточки продукта, исключающую `is_social_risk = true`.
  - Создать функцию подбора аналогов с учетом `active_ingredient`, `category`, `form`, дозировки, наличия в активных Tier 2/Tier 3 аптеках и исключения `is_social_risk = true`.
  - Создать функцию выборки аптек по продукту с учетом активного города, статуса аптеки, Tier-фильтра, наличия, графика работы, `is_24_7`, координат и расстояния.
  - Создать функции или read-запросы для sitemap-списка публичных продуктов и дашборда дефицитных запросов.

- [x] **3. Перевести runtime read-функции на Supabase:**
  - Переподключить `searchProducts` на Supabase RPC без изменения API-ответа.
  - Переподключить `getProductDetails`, `getAnalogs` и `getPharmaciesByProduct` на Supabase RPC без изменения UI-контрактов.
  - Переподключить `src/app/sitemap.ts` на Supabase read layer с сохранением fallback-поведения при недоступной базе.
  - Переподключить чтение данных `/admin/demand` на Supabase read layer, сохранив текущую проверку `requireAdmin()`.
  - Не менять `logZeroResultSearch`, админские мутации, auth и CSV/mapping write-сценарии в рамках этого плана.

- [x] **4. Проверить безопасность server-only границы:**
  - Убедиться, что Supabase service role ключ используется только в серверном коде.
  - Убедиться, что клиентские компоненты не импортируют серверный Supabase helper.
  - Проверить, что публичный frontend не получает прямой доступ к чувствительным таблицам.
  - Проверить, что restricted-запросы по-прежнему не логируются как дефицит.

- [x] **5. Выполнить регрессионную проверку пользовательских сценариев:**
  - Проверить поиск `нурофен` и alias `Нуроф таб 200мг`.
  - Проверить restricted-запрос `диазепам`.
  - Проверить страницу продукта `Но-Шпа`, блок аналогов и SEO/sitemap.
  - Проверить карту аптек, фильтр "Открыто сейчас", fallback без координат и сортировку по расстоянию при координатах.
  - Проверить `/admin/demand` под админским доступом.

- [x] **6. Выполнить технические проверки:**
  - Выполнить `npm install`, если добавлена новая зависимость.
  - Выполнить `npx prisma generate`, если текущий переходный Prisma-слой затронут типами или зависимостями.
  - Выполнить `npm run lint`.
  - Выполнить `npm run build`.
  - Выполнить `git diff --check`.
  - Проверить, что Prisma не удален и остается для сценариев вне этапа 6.3.

## Пользовательская проверка (Пошаговый чеклист)

> Выполните каждый шаг по порядку. Если на любом шаге результат не совпадает с ожидаемым — значит что-то пошло не так.

### Проверка задачи 1: Supabase read layer подготовлен
1. Откройте `package.json` и новые файлы Supabase helper в `src/lib/`.
2. Проверьте `.env.local` локально: должны быть заданы Supabase URL и серверный ключ, но реальные значения не должны попадать в Git.
3. ✅ **Ожидаемый результат:** Supabase SDK доступен серверному коду, секреты не закоммичены, клиентские компоненты не импортируют server-only helper.
4. ❌ **Если не работает:** остановитесь; проверьте переменные окружения и импорты server/client до запуска приложения.

### Проверка задачи 2: SQL/RPC функции применены
1. В тестовой Supabase базе примените новую SQL-миграцию из `supabase/migrations/`.
2. В Supabase SQL Editor проверьте наличие функций поиска, карточки продукта, аналогов, аптек и аналитики дефицита.
3. ✅ **Ожидаемый результат:** миграция выполняется без ошибок, функции существуют и используют текущие таблицы без изменения доменной схемы.
4. ❌ **Если не работает:** сохраните SQL-ошибку, не применяйте миграцию к production и верните этап на доработку.

### Проверка задачи 3: Поиск и restricted-сценарии
1. Запустите приложение командой `npm run dev`.
2. Откройте главную страницу и выполните поиск `нурофен`.
3. Выполните поиск alias `Нуроф таб 200мг`.
4. Выполните restricted-запрос `диазепам`.
5. ✅ **Ожидаемый результат:** обычный поиск и alias возвращают прежнюю выдачу, `диазепам` показывает restricted-состояние и не попадает в аналитику дефицита.
6. ❌ **Если не работает:** проверьте RPC fuzzy search, `pg_trgm`, mapping категорий и restricted-логику.

### Проверка задачи 4: Продукт, аналоги, карта и sitemap
1. Откройте страницу продукта `Но-Шпа`.
2. Проверьте блок аналогов.
3. Перейдите на карту из продукта или через `/map?q=но-шпа`.
4. Проверьте фильтр "Открыто сейчас", fallback без координат и сортировку при разрешенных координатах.
5. Откройте `/sitemap.xml`.
6. ✅ **Ожидаемый результат:** страница продукта, аналоги, карта и sitemap работают как до переноса, без визуальных изменений.
7. ❌ **Если не работает:** сравните ответ RPC с прежним Prisma-контрактом и проверьте расчет графика/расстояния.

### Проверка задачи 5: Дашборд дефицита
1. Войдите в админку.
2. Откройте `/admin/demand`.
3. Проверьте фильтр города, счетчик запросов за 7 дней и топ дефицитных позиций.
4. ✅ **Ожидаемый результат:** страница доступна только администратору и показывает те же агрегированные данные, что до переноса.
5. ❌ **Если не работает:** проверьте `requireAdmin()`, RPC агрегации `search_logs` и период 7 дней.

### Проверка задачи 6: Сборка и качество
1. Выполните `npm run lint`.
2. Выполните `npm run build`.
3. Выполните `git diff --check`.
4. ✅ **Ожидаемый результат:** lint, build и проверка diff проходят успешно.
5. ❌ **Если не работает:** этап не считается завершенным; исправьте ошибку и повторите проверки.

### Итоговый критерий: Этап завершён, если
- [x] Поиск, карточка продукта, аналоги, карта, sitemap и `/admin/demand` читают данные через Supabase read layer.
- [x] Пользовательское поведение и UI не изменились.
- [x] Restricted-препараты по-прежнему скрыты из обычной выдачи и не логируются как дефицит.
- [x] Supabase service role ключ не попадает в клиентский код.
- [x] Prisma не удален и остается только для сценариев вне этапа 6.3 и rollback.
- [x] `npm run lint`, `npm run build` и `git diff --check` проходят успешно.

## Результаты выполнения
- Добавлена зависимость `@supabase/supabase-js`.
- Создан server-only helper `src/lib/supabase-server.ts`, который использует только `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`.
- Создана SQL-миграция `supabase/migrations/20260601120000_read_layer_functions.sql` с RPC-функциями для поиска, карточки продукта, аналогов, аптек по продукту, sitemap и дашборда дефицита.
- RPC-функции создаются явно в схеме `public`, закрывают `EXECUTE` для `PUBLIC`, `anon` и `authenticated`, затем выдают доступ `service_role`, если такая роль есть в Supabase project.
- `searchProducts`, `getProductDetails`, `getAnalogs`, `getPharmaciesByProduct`, `sitemap.xml` и `getDemandDashboardData` переведены на Supabase read layer.
- `logZeroResultSearch`, админские мутации, CSV-импорт, маппинг, CRUD аптек, черный список, auth и Prisma rollback-слой не менялись в рамках этапа 6.3.
- Обновлена инструкция `supabase/README.md` для применения RPC-миграции и настройки server-only env.
- Выполнены `npm run lint`, `npm run build`, `npx prisma generate` и `git diff --check`.
- `npm run build` прошел успешно; при генерации `sitemap.xml` сработал ожидаемый fallback, потому что локально не заданы `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`.
- Пользователь применил RPC-миграцию в тестовом Supabase project, проверил функции `gotmeds_%` в схеме `public` и права `anon=false`, `authenticated=false`, `service_role=true`.
- Пользователь проверил поиск `нурофен`, alias `Нуроф таб 200мг`, restricted-запрос `диазепам` без роста `search_logs`, страницу `Но-Шпа`, аналоги, карту, sitemap и `/admin/demand`.
