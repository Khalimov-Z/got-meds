# Инфраструктура и качество

Этот файл хранит хронологию завершенных работ, которые относятся к структуре инструментов, проверкам, сборке, линтерам, Prisma-настройкам и качеству проекта.

## Формат записи

```md
## ГГГГ-ММ-ДД - Название завершенного плана

- План: `plans/completed/<имя-файла>.md`
- Сделано: что изменилось в инфраструктуре или проверках
- Влияние: как это влияет на надежность разработки
- Проверка: какие автоматические или ручные проверки выполнены
```

## Записи

## 2026-05-11 - Инициализация и слой данных

- План: [plans/completed/phase-1-init.md](../../plans/completed/phase-1-init.md)
- Сделано: инициализирован Next.js 16.2.6, настроены TypeScript, App Router, Vanilla CSS, Prisma 7, `.gitignore` для `.env` и шаблон планов разработки.
- Влияние: проект получил базовый технический каркас и правила планирования работ.
- Проверка: проверялись запуск приложения, подключение к базе и seed-данные.

## 2026-05-11 - Ядро поискового движка

- План: [plans/completed/phase-2-search-engine.md](../../plans/completed/phase-2-search-engine.md)
- Сделано: добавлен Prisma singleton для переиспользования `PrismaClient` в dev-режиме Next.js.
- Влияние: локальная разработка стала устойчивее к Hot Module Replacement.
- Проверка: endpoint поиска проверялся после добавления singleton.

## 2026-05-14 - Базовый интерфейс и интеграция поиска

- План: [plans/completed/phase-3-client-search-ui.md](../../plans/completed/phase-3-client-search-ui.md)
- Сделано: изменения интерфейса проверены линтером и production-сборкой.
- Влияние: поисковый интерфейс прошел базовую автоматическую проверку качества.
- Проверка: выполнены `npm run lint` и `npm run build`.

## 2026-05-16 - Страница препарата и карта аптек

- План: [plans/completed/phase-4-product-map.md](../../plans/completed/phase-4-product-map.md)
- Сделано: карта, страницы продукта и API аптек проверены линтером и production-сборкой.
- Влияние: расширение пользовательского сценария прошло базовую автоматическую проверку качества.
- Проверка: выполнены `npm run lint` и `npm run build`.

## 2026-05-19 - Админ-панель и импорт прайс-листов

- План: [plans/completed/phase-5-admin-import.md](../../plans/completed/phase-5-admin-import.md)
- Сделано: админ-панель, импорт и маппинг проверены линтером и production-сборкой.
- Влияние: операционный контур админки прошел базовую автоматическую проверку качества.
- Проверка: выполнены `npm run lint` и `npm run build`.

## 2026-05-19 - Изменение структуры проекта

- План: [plans/completed/project-structure-change.md](../../plans/completed/project-structure-change.md)
- Сделано: добавлены проверки целостности документации после переименования папок, устранены устаревшие ссылки на несуществующие документы, завершенные планы этапов 1 и 2 приведены к статусу `Completed`.
- Влияние: документация проекта стала согласованнее, а проверка перед публикацией лучше выявляет битые ссылки и несоответствия статусов.
- Проверка: выполнены поиск старых путей, проверка markdown-ссылок, проверка статусов и чекбоксов в `plans/completed/`, а также `npm run lint`.

## 2026-05-19 - Ограниченный поиск и черный список

- План: [plans/completed/restricted-search-blacklist.md](../../plans/completed/restricted-search-blacklist.md)
- Сделано: план разработки переведен в completed, изменения проверены линтером и production-сборкой перед push.
- Влияние: завершенная работа зафиксирована в дорожной карте и прошла базовый контроль качества.
- Проверка: выполнены `npm run lint`, `npm run build` и `git diff --check`.

## 2026-05-20 - Аналоги препаратов

- План: [plans/completed/phase-6-analogs.md](../../plans/completed/phase-6-analogs.md)
- Сделано: план разработки переведен в completed, обновлены спецификации и дорожная карта перед push.
- Влияние: этап аналогов завершен по SDD-процессу и связан с проверяемыми требованиями.
- Проверка: выполнены `npm run lint`, `npm run build`, повторный seed и пользовательская проверка в браузере.

## 2026-05-20 - Исправление поиска на странице карты

- План: [plans/completed/fix-map-search-refresh.md](../../plans/completed/fix-map-search-refresh.md)
- Сделано: багфикс карты оформлен отдельным планом и изолирован от незавершенного этапа аналитики нулевой выдачи.
- Влияние: изменения карты можно публиковать отдельно, не смешивая их с работой по `Search_Logs`.
- Проверка: выполнены `npm run lint`, `npm run build` и `git diff --check`.

## 2026-05-20 - Аналитика нулевой выдачи

- План: [plans/completed/phase-7-zero-result-analytics.md](../../plans/completed/phase-7-zero-result-analytics.md)
- Сделано: план этапа 7 переведен в completed, изменения восстановлены поверх свежего `main` после merge багфикса карты и проверены перед push.
- Влияние: этап опубликован изолированно от уже слитой ветки `fix-map-search-refresh` и соответствует SDD-процессу проекта.
- Проверка: выполнены `npx prisma generate`, `npm run lint`, `npm run build`, `git diff --check` и пользовательская проверка.

## 2026-05-20 - Дашборд дефицитных позиций

- План: [plans/completed/phase-8-admin-demand-dashboard.md](../../plans/completed/phase-8-admin-demand-dashboard.md)
- Сделано: план этапа 8 переведен в completed, дорожная карта обновлена перед push, изменения проверены линтером, production-сборкой и `git diff --check`.
- Влияние: завершение этапа оформлено по SDD-процессу и готово к Pull Request.
- Проверка: выполнены `npm run lint`, `npm run build`, `git diff --check` и пользовательская проверка.

## 2026-05-20 - CRUD аптек и статусы

- План: [plans/completed/phase-9-admin-pharmacy-crud.md](../../plans/completed/phase-9-admin-pharmacy-crud.md)
- Сделано: план этапа 9 переведен в completed, дорожная карта обновлена перед push, изменения проверены линтером, production-сборкой и `git diff --check`.
- Влияние: завершение этапа управления аптеками оформлено по SDD-процессу и готово к Pull Request.
- Проверка: выполнены `npm run lint`, `npm run build`, `git diff --check` и пользовательская проверка.

## 2026-05-23 - Редизайн главной страницы и графическая карта

- Планы: [plans/completed/homepage-graphic-map.md](../../plans/completed/homepage-graphic-map.md), [plans/completed/homepage-production-redesign.md](../../plans/completed/homepage-production-redesign.md), [plans/completed/sync-graphic-map-colors-and-layouts.md](../../plans/completed/sync-graphic-map-colors-and-layouts.md)
- Сделано: планы визуального этапа переведены в completed, дорожная карта обновлена перед push, глобальные бренд-цвета вынесены в `globals.css`, а дублирующая копия hero-изображения из `public/design/assets/` удалена.
- Влияние: этап оформлен по SDD-процессу, дизайн-ассет хранится в одном месте, а следующие визуальные работы могут опираться на глобальные переменные.
- Проверка: выполнены `npm run lint`, `npm run build`, `git diff --check` и пользовательская проверка главной страницы.

## 2026-05-28 - Визуальное обновление карты и внутренних страниц

- План: [plans/completed/internal-pages-visual-refresh.md](../../plans/completed/internal-pages-visual-refresh.md)
- Сделано: план визуального обновления переведен в completed, дорожная карта обновлена перед push, а спецификации синхронизированы с ограничением списка аптек в правой панели.
- Влияние: завершение этапа оформлено по SDD-процессу и связано с проверяемыми требованиями для карты, админки и страницы препарата.
- Проверка: выполнены `npm run lint`, `npm run build`, `git diff --check` и пользовательская проверка.

## 2026-05-30 - PWA и SEO-инфраструктура

- План: [plans/completed/pwa-seo-foundation.md](../../plans/completed/pwa-seo-foundation.md)
- Сделано: план PWA/SEO переведен в completed, добавлены service worker, PWA-иконки, site URL helper и обновлена дорожная карта перед push.
- Влияние: проект получил базовую PWA-инфраструктуру, offline fallback и оформленное завершение этапа по SDD-процессу.
- Проверка: выполнены `node --check public/sw.js`, `npm run lint`, `npm run build` и пользовательская проверка.

## 2026-05-30 - Стратегия миграции на Supabase

- План: [plans/completed/supabase-migration-strategy-spec.md](../../plans/completed/supabase-migration-strategy-spec.md)
- Сделано: добавлена техническая стратегия поэтапной Supabase-миграции и обновлены связанные спецификации без изменения кода приложения.
- Влияние: дальнейшая миграция будет идти маленькими утвержденными планами с rollback-критериями, а Prisma закреплена как переходный слой до финального этапа удаления.
- Проверка: пользователь проверил стратегию, выполнен `git diff --check`.

## 2026-05-31 - Supabase PostgreSQL foundation

- План: [plans/completed/supabase-postgresql-foundation.md](../../plans/completed/supabase-postgresql-foundation.md)
- Сделано: завершенный план перенесен в `plans/completed/`, зафиксированы параметры локального Supabase `DATABASE_URL` без коммита секретов и проверен переход на Supabase Session pooler с SSL-параметрами.
- Влияние: проект получил проверенный foundation-этап Supabase-миграции с rollback-подходом через возврат `DATABASE_URL` без изменений кода.
- Проверка: выполнены `npx prisma generate`, `npm run lint`, `npm run build`, runtime-проверка Server Actions, проверка локального API поиска и `git diff --check`.

## 2026-06-01 - Supabase SQL migrations and seed

- План: [plans/completed/supabase-sql-migrations-and-seed.md](../../plans/completed/supabase-sql-migrations-and-seed.md)
- Сделано: добавлена папка `supabase/` с SQL-миграцией, SQL-seed и русскоязычной инструкцией проверки; активный план переведен в `plans/completed/` после пользовательской проверки.
- Влияние: следующий этап Supabase-миграции можно проверять через Supabase SQL Editor, `psql` или Supabase CLI без коммита секретов и без изменения production-базы.
- Проверка: выполнены `npx prisma generate`, `npm run lint`, `npm run build`, `git diff --check`; пользователь дополнительно подтвердил ручную проверку SQL-артефактов и runtime-проверку приложения.

## 2026-06-01 - Supabase read layer

- План: [plans/completed/supabase-read-layer.md](../../plans/completed/supabase-read-layer.md)
- Сделано: активный план переведен в `plans/completed/`, добавлена зависимость `@supabase/supabase-js`, обновлена инструкция `supabase/README.md` и дорожная карта перед push.
- Влияние: этап read layer оформлен по SDD-процессу, секреты остаются только в локальном `.env.local`, а Prisma сохранен для сценариев вне этапа 6.3.
- Проверка: выполнены `npx prisma generate`, `npm run lint`, `npm run build`, `git diff --check`; пользователь дополнительно подтвердил ручные проверки Supabase RPC и приложения.

## 2026-06-02 - Supabase Auth and RLS

- План: [plans/completed/supabase-auth-rls.md](../../plans/completed/supabase-auth-rls.md)
- Сделано: активный план переведен в `plans/completed/`, добавлена зависимость `@supabase/ssr`, обновлена инструкция `supabase/README.md` по Auth/RLS и дорожная карта перед push.
- Влияние: этап Auth/RLS оформлен по SDD-процессу, env-переменные описаны без коммита секретов, Prisma сохранен для runtime/rollback-сценариев вне этапа 6.4.
- Проверка: выполнены `npx prisma generate`, `npm run lint`, `npm run build`, `git diff --check`; пользователь дополнительно подтвердил ручные проверки Supabase Auth, RLS и приложения.

## 2026-06-02 - Supabase admin mutations

- План: [plans/completed/supabase-admin-mutations.md](../../plans/completed/supabase-admin-mutations.md)
- Сделано: активный план переведен в `plans/completed/`, обновлены `supabase/README.md` и дорожная карта перед push; Prisma сохранен как rollback/seed-слой до отдельного Prisma decommission.
- Влияние: этап admin mutations оформлен по SDD-процессу, а проверочные SQL-сценарии Supabase и ручная приемка зафиксированы в проектной документации.
- Проверка: выполнены `npm run lint`, `npm run build`, `git diff --check`; пользователь дополнительно подтвердил ручные проверки миграции, админских операций и аналитики.
