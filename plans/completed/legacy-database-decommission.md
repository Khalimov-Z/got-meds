# План разработки: Legacy database decommission

**Статус:** Завершён (Completed)
**Основание:** [supabase-platform-migration.md](../../spec/technical/supabase-platform-migration.md), [tech-stack.md](../../spec/technical/tech-stack.md), [data-architecture.md](../../spec/features/data-architecture/data-architecture.md)

## Цель
Окончательно удалить legacy database-слой GotMeds после переноса схемы, seed, чтения, авторизации, RLS и админских мутаций на Supabase. По завершении в runtime-коде, пакетах, конфигурации, `.gitignore`, текущих инструкциях запуска и активных артефактах проекта не должно остаться Prisma-клиента, Prisma-схемы, Prisma-миграций, Prisma seed, прямого `pg`-подключения к старой PostgreSQL/Neon-базе и связанных больше не используемых библиотек.

В рамках этого плана папка `prisma/` удаляется полностью, а не архивируется. `prisma.config.ts` с legacy-комментарием `Neon PostgreSQL` удаляется вместе с прямым `pg`-подключением. Локальный `.env` не меняется по значениям: если `DATABASE_URL` уже указывает на Supabase, он сохраняется; удаляется или исправляется только вводящий в заблуждение комментарий про Neon/Nylon. Исторические записи в `plans/completed/` и `roadmap/` не переписываются, потому что они фиксируют уже выполненные этапы. Текущие спецификации, Supabase-инструкции и комментарии активных SQL-артефактов должны быть актуализированы так, чтобы не описывать Prisma, Neon/PostgreSQL или другой старый DB-слой как рабочий слой, seed-слой или rollback-слой проекта.

Не удаляется `pg_trgm`: это не legacy-библиотека приложения, а нужное расширение Supabase PostgreSQL для текущего fuzzy search.

## Задачи:
- [x] **1. Провести финальный аудит legacy database-остатков:**
  - Проверить, что в runtime-коде `src/` нет импортов `@prisma/*`, `PrismaClient`, `src/lib/prisma` и прямого использования Prisma-запросов.
  - Проверить, что в runtime-коде `src/` нет прямого подключения к старой PostgreSQL/Neon-базе через `pg.Pool`, `pg` или отдельные DB-клиенты вне Supabase SDK.
  - Зафиксировать текущие Prisma/legacy DB-артефакты для удаления: `src/lib/prisma.ts`, `prisma.config.ts`, папка `prisma/`, Prisma-блок в `package.json`, Prisma-зависимости, `pg`-зависимости, записи в `package-lock.json` и Prisma-блок в `.gitignore`.
  - Проверить связанные зависимости, которые использовались только Prisma/legacy seed-слоем: `@prisma/client`, `@prisma/adapter-pg`, `prisma`, `pg`, `@types/pg`, `dotenv`, `tsx`, `bcryptjs`, `@types/bcryptjs`.
  - Проверить локальные `.env` и `.env.local` только по именам переменных и комментариям без вывода секретных значений: комментарии про Neon/Nylon должны быть удалены или исправлены, Supabase-значения не должны меняться.
  - Не удалять зависимости, которые реально используются текущим Supabase/Next.js runtime-кодом.

- [x] **2. Удалить legacy DB-файлы, конфигурацию и зависимости:**
  - Удалить `src/lib/prisma.ts`.
  - Удалить `prisma.config.ts`.
  - Удалить папку `prisma/` вместе со схемой, Prisma migrations и Prisma seed.
  - Удалить Prisma-блок из `.gitignore`, включая комментарий `Prisma (будет использоваться позже)` и `prisma/*.db`.
  - Удалить из `package.json` Prisma seed-конфигурацию и все неиспользуемые после Supabase зависимости, включая прямой `pg`-драйвер и seed-only пакеты, если они больше не импортируются.
  - Обновить `package-lock.json` штатным npm-механизмом, чтобы lockfile больше не содержал удаленные top-level пакеты и их лишние транзитивные зависимости.
  - Не удалять Supabase-пакеты `@supabase/ssr` и `@supabase/supabase-js`, текущие Supabase env-переменные и SQL-артефакты `supabase/migrations/*` / `supabase/seed.sql`.
  - Удалить или исправить только legacy-комментарий про Neon/Nylon в локальном `.env`; не изменять Supabase `DATABASE_URL` и другие Supabase env-значения.

- [x] **3. Актуализировать текущую документацию и спецификации под состояние без Prisma:**
  - Обновить `spec/technical/tech-stack.md`, чтобы Supabase SDK/RPC/Auth/RLS/SQL migrations были описаны как текущий data/backend слой, а Prisma не была описана как рабочий ORM.
  - Обновить `spec/features/data-architecture/data-architecture.md`, чтобы источником схемы и seed текущего состояния были Supabase SQL migrations и `supabase/seed.sql`.
  - Обновить `spec/technical/supabase-platform-migration.md`, чтобы финальный этап decommission был описан как выполняемый отдельным планом без сохранения Prisma/legacy DB rollback-слоя после завершения.
  - Обновить `spec/business-context.md`, если технологический стек там всё еще перечисляет Prisma как актуальный компонент.
  - Обновить `spec/technical/security-performance.md`, если админская защита всё еще описана как NextAuth-подход вместо текущего Supabase Auth.
  - Обновить `supabase/README.md` и комментарии активных Supabase SQL-артефактов, удалив инструкции и формулировки про Prisma, Neon/PostgreSQL или другой legacy DB-слой как текущий rollback/seed-слой.
  - Не переписывать исторические `plans/completed/` и `roadmap/` записи, кроме будущего обычного добавления результата этого плана при push.

- [x] **4. Проверить сборку проекта без Prisma:**
  - Выполнить поиск по активным файлам и убедиться, что Prisma, Neon/Nylon legacy-комментарии, Neon/PostgreSQL legacy-подключение и прямой `pg`-слой не остались в runtime, пакетах и текущих инструкциях.
  - Выполнить `npm run lint`.
  - Выполнить `npm run build`.
  - Выполнить `git diff --check`.
  - При необходимости запустить локальный dev-сервер и проверить ключевые сценарии через Supabase: главная, поиск, карта, страница продукта, админский вход и основные админские разделы.

## Пользовательская проверка (Пошаговый чеклист)

> Выполните каждый шаг по порядку. Если на любом шаге результат не совпадает с ожидаемым — значит что-то пошло не так.

### Проверка задачи 1: Legacy DB-файлы удалены
1. Выполните команду:
   ```bash
   test ! -e prisma && test ! -e prisma.config.ts && test ! -e src/lib/prisma.ts && echo "Prisma files removed"
   ```
2. Смотрите вывод терминала.
3. ✅ **Ожидаемый результат:** Терминал выводит `Prisma files removed`.
4. ❌ **Если не работает:** Проверьте, какой из путей еще существует: `prisma/`, `prisma.config.ts` или `src/lib/prisma.ts`, и удалите остаток только после проверки, что он больше не импортируется.

### Проверка задачи 2: Legacy DB-библиотеки удалены из зависимостей
1. Выполните команду:
   ```bash
   node -e "const p=require('./package.json'); const deps={...(p.dependencies||{}), ...(p.devDependencies||{})}; const names=['@prisma/client','@prisma/adapter-pg','prisma','pg','@types/pg','dotenv','tsx','bcryptjs','@types/bcryptjs']; const found=names.filter((name)=>deps[name]); if(found.length){throw new Error('Остались зависимости: '+found.join(', '));} console.log('Prisma dependencies removed');"
   ```
2. Смотрите вывод терминала.
3. ✅ **Ожидаемый результат:** Терминал выводит `Prisma dependencies removed`.
4. ❌ **Если не работает:** Проверьте, не используется ли найденный пакет в текущем `src/` или Supabase-инструкциях. Если не используется — удалить из `package.json` и обновить `package-lock.json`.

### Проверка задачи 3: В активном runtime и текущих инструкциях нет legacy DB-остатков
1. Выполните команду:
   ```bash
   rg -n "@prisma|PrismaClient|src/lib/prisma|prisma.config|prisma/schema|prisma/seed|prisma/\\*\\.db|npx prisma|Prisma Studio|Neon|Nylon|DIRECT_URL|pg\\.Pool|from ['\"]pg['\"]" .gitignore src package.json package-lock.json supabase spec/business-context.md spec/technical/tech-stack.md spec/technical/security-performance.md spec/features/data-architecture/data-architecture.md
   ```
2. Смотрите список совпадений.
3. ✅ **Ожидаемый результат:** Команда не находит совпадений в `.gitignore`, `src/`, `package.json`, `package-lock.json`, `supabase/`, `business-context.md`, `tech-stack.md`, `security-performance.md` и `data-architecture.md`.
4. ❌ **Если не работает:** Каждое найденное совпадение нужно классифицировать: активный остаток удалить или переписать; историческое упоминание в завершенных планах и roadmap не трогать.

### Проверка задачи 4: Локальные env не содержат legacy-комментарий
1. Проверьте локальные `.env` и `.env.local` по комментариям и именам переменных, не публикуя значения секретов.
2. Выполните команду:
   ```bash
   awk '/^#/ {print FILENAME ":" FNR ":" $0} /^[A-Za-z_][A-Za-z0-9_]*=/ {split($0, a, "="); print FILENAME ":" FNR ":" a[1]}' .env .env.local 2>/dev/null
   ```
3. Убедитесь, что комментариев про Neon/Nylon нет, а Supabase-переменные и Supabase `DATABASE_URL`, если он нужен для SQL-проверок, сохранены.
4. ✅ **Ожидаемый результат:** В локальных env нет комментариев про Neon/Nylon; Supabase env-значения не изменены.
5. ❌ **Если не работает:** Не удаляйте Supabase-переменные. Исправьте только legacy-комментарий или код, который всё еще требует старый DB-слой.

### Проверка задачи 5: Проект собирается без legacy DB-слоя
1. Выполните команды:
   ```bash
   npm run lint
   npm run build
   git diff --check
   ```
2. Смотрите вывод терминала.
3. ✅ **Ожидаемый результат:** Все три команды завершаются без ошибок.
4. ❌ **Если не работает:** Сначала исправьте ошибку lint/build/diff-check, затем повторите весь чеклист с первого шага.

### Проверка задачи 6: Ручная проверка Supabase-сценариев
1. Запустите приложение:
   ```bash
   npm run dev
   ```
2. Откройте в браузере главную страницу, выполните поиск, перейдите на карту, откройте страницу продукта, войдите в `/admin` и проверьте основные админские разделы.
3. ✅ **Ожидаемый результат:** Пользовательские и админские сценарии работают через Supabase без ошибок, связанных с Prisma или отсутствующими пакетами.
4. ❌ **Если не работает:** Зафиксируйте конкретный URL, действие и текст ошибки, затем проверьте соответствующий Supabase helper, RPC или env-переменную.

### Итоговый критерий: Этап завершён, если
- [x] `prisma/`, `prisma.config.ts` и `src/lib/prisma.ts` удалены.
- [x] В `.gitignore` нет Prisma/legacy DB-блока.
- [x] В `package.json` и `package-lock.json` нет Prisma, прямого `pg`-драйвера и связанных больше не используемых пакетов.
- [x] Текущие спецификации и Supabase-инструкции не описывают Prisma, Neon/PostgreSQL или другой legacy DB-слой как рабочий слой, seed-слой или rollback-слой.
- [x] В runtime-коде `src/` нет Prisma-импортов, Prisma-запросов, `pg.Pool` и прямого старого DB-подключения.
- [x] Локальный `.env` не содержит legacy-комментарий про Neon/Nylon; Supabase env-значения не изменены.
- [x] `npm run lint`, `npm run build` и `git diff --check` проходят без ошибок.
- [x] Пользователь вручную проверил ключевые Supabase-сценарии и подтвердил, что legacy DB-слой больше не нужен как fallback.

## Итог реализации

- Удалены `prisma/`, `prisma.config.ts` и `src/lib/prisma.ts`.
- Удалены legacy DB-зависимости и seed-конфигурация из `package.json`; `package-lock.json` обновлен через npm.
- Удален Prisma-блок из `.gitignore`.
- В локальном `.env` исправлен только комментарий: значение Supabase `DATABASE_URL` не менялось.
- Обновлены текущие спецификации и Supabase runbook под состояние без legacy DB-слоя.
- Проверки агента: `npm run lint` прошел с двумя существующими предупреждениями, `npm run build` прошел успешно, повторный build с сетевым доступом подтвердил генерацию sitemap без `fetch failed`, `git diff --check` прошел успешно.
- Пользователь подтвердил ручную проверку и попросил выполнить push.
