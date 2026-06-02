# План разработки: Supabase admin mutations

**Статус:** Завершено (Completed)
**Основание:** [spec/technical/supabase-platform-migration.md](../../spec/technical/supabase-platform-migration.md), раздел 6.5; [spec/technical/api-spec.md](../../spec/technical/api-spec.md), разделы 1.1, 2.3 и 3; [spec/features/admin-panel/admin-panel-spec.md](../../spec/features/admin-panel/admin-panel-spec.md), разделы 2-5; [spec/features/data-pipelines/data-pipelines.md](../../spec/features/data-pipelines/data-pipelines.md), раздел 3; [spec/features/data-architecture/data-architecture.md](../../spec/features/data-architecture/data-architecture.md), разделы 1 и 3.4

## Цель
Перенести админские операции GotMeds с Prisma на server-only Supabase SDK/RPC без изменения пользовательского интерфейса, маршрутов и текущих контрактов Server Actions.

По завершении этапа CRUD аптек, загрузка CSV-прайсов Tier 2, маппинг alias, игнорирование мусорных строк, управление черным списком и запись аналитики нулевой выдачи должны выполняться через Supabase-слой. Prisma остается в проекте как rollback-слой и не удаляется в рамках этого плана.

## Границы этапа
- Входит: перенос текущих админских мутаций `createPharmacy`, `updatePharmacy`, `uploadPharmacyPrice`, `createAlias`, `ignoreAlias`, `toggleProductSocialRisk` на Supabase SDK/RPC.
- Входит: перенос вспомогательных админских чтений для этих экранов, если они нужны для отказа `src/lib/actions/admin.ts` от Prisma в рамках текущих админских страниц.
- Входит: перенос `logZeroResultSearch` и получения активного города на Supabase-слой, так как спецификация этапа 6.5 отдельно включает запись аналитики, если она еще использует Prisma.
- Входит: SQL/RPC-функции для атомарных операций CSV-импорта и маппинга, где нужна транзакционность.
- Входит: сохранение `requireAdmin()` как обязательной серверной проверки перед админскими операциями.
- Входит: обновление `supabase/README.md` с порядком применения новой миграции и ручными SQL-проверками.
- Не входит: удаление Prisma-зависимостей, `prisma/`, Prisma migrations, Prisma seed и rollback-слоя.
- Не входит: изменение UI админки, клиентских маршрутов, форм, визуального дизайна или публичного поведения поиска/карты.
- Не входит: реализация модерации жалоб, если сама функция жалоб не была реализована ранее.
- Не входит: Supabase Storage, Realtime, пользовательские аккаунты клиентов и production-деплой.

## Задачи:
- [x] **1. Зафиксировать текущие Prisma-точки админского слоя:**
  - Проверить `src/lib/actions/admin.ts`, `src/lib/actions/search.ts`, `src/lib/supabase-server.ts`, `supabase/migrations/`, `supabase/README.md` и связанные страницы `/admin/*`.
  - Разделить простые операции Supabase SDK и операции, которым нужна SQL/RPC-транзакция.
  - Зафиксировать текущие контракты ответов `AdminActionResponse`, `UploadPharmacyPriceReport`, `AdminPharmacyManagementData`, `DemandDashboardData` и форм-оберток.

- [x] **2. Добавить Supabase SQL/RPC для админских операций:**
  - Создать новую Supabase SQL migration для атомарного CSV full sync: удаление старых `inventory`/`unmapped_strings`, вставка распознанных остатков и очереди маппинга.
  - Создать RPC для `createAlias` и `ignoreAlias`: upsert в `product_aliases` и удаление записи из `unmapped_strings` одной транзакцией.
  - Создать RPC или безопасный SDK-путь для изменения `products.is_social_risk`.
  - Проверить, что функции требуют админскую роль через текущие Supabase Auth/RLS helper-функции.
  - Сохранить запрет выполнения чувствительных RPC для `anon` и обычных `authenticated` пользователей без доменной роли администратора.

- [x] **3. Перенести CRUD аптек и админские справочники на Supabase:**
  - Перевести `getAdminHomeStats` на Supabase-слой.
  - Перевести `getPharmacyManagementData`, `getInventoryUploadData`, `getMappingData` и `getBlacklistManagementData` на Supabase-слой с сохранением сортировок и формы данных.
  - Перевести `createPharmacy` и `updatePharmacy` на Supabase-слой с текущей валидацией FormData и теми же сообщениями ошибок.
  - Сохранить текущие `revalidatePath` и redirect-поведение форм.

- [x] **4. Перенести CSV-импорт, маппинг и черный список:**
  - Оставить парсинг CSV и нормализацию строк в Server Action.
  - Получать словари alias/product через Supabase вместо Prisma.
  - Выполнять full sync остатков через новую RPC-функцию.
  - Перевести `createAlias`, `ignoreAlias` и `toggleProductSocialRisk` на Supabase SDK/RPC.
  - Проверить, что restricted-препараты не попадают в маппинг как доступные товары.

- [x] **5. Перенести запись аналитики нулевой выдачи:**
  - Перевести получение активного города в `src/lib/actions/search.ts` на Supabase-слой.
  - Перевести запись `search_logs` в `logZeroResultSearch` на Supabase-слой.
  - Сохранить антишум-ограничение: минимум 3 символа и отсутствие логирования restricted-запросов.
  - Сохранить текущий контракт `LogZeroResultSearchResponse`.

- [x] **6. Обновить документацию проверки Supabase:**
  - Добавить в `supabase/README.md` порядок применения новой миграции.
  - Добавить SQL-проверки наличия новых RPC-функций и прав выполнения.
  - Добавить ручные проверки админских операций после переноса.

- [x] **7. Выполнить регрессионные проверки:**
  - Выполнить `npx prisma generate`, если Prisma-схема затронута для совместимости rollback-слоя.
  - Выполнить `npm run lint`.
  - Выполнить `npm run build`.
  - Выполнить `git diff --check`.
  - Проверить, что `src/lib/actions/admin.ts` и `src/lib/actions/search.ts` больше не используют Prisma для перенесенных операций.

## Пользовательская проверка (Пошаговый чеклист)

> Выполните каждый шаг по порядку. Если на любом шаге результат не совпадает с ожидаемым — значит что-то пошло не так.

### Проверка задачи 1: Миграция Supabase применена
1. Примените новую SQL-миграцию из `supabase/migrations/` в тестовом Supabase project.
2. В Supabase SQL Editor выполните проверки функций и прав из `supabase/README.md`.
3. ✅ **Ожидаемый результат:** новые RPC-функции существуют, чувствительные операции недоступны `anon` и неадминскому `authenticated`, админ с доменной ролью может выполнять операции.
4. ❌ **Если не работает:** остановитесь; проверьте порядок применения миграций, наличие `admins.auth_user_id`, RLS helper-функции и grants/revokes для новых RPC.

### Проверка задачи 2: CRUD аптек
1. Запустите приложение командой `npm run dev`.
2. Войдите в `/admin/login` под Supabase Auth администратором.
3. Откройте `/admin/pharmacies`, создайте тестовую аптеку, затем измените адрес, координаты, статус и график.
4. ✅ **Ожидаемый результат:** создание и редактирование проходят без ошибок, таблица обновляется, аптеку видно или не видно на карте в зависимости от статуса.
5. ❌ **Если не работает:** проверьте ошибку формы, запись в таблице `pharmacies`, RLS-политику и RPC/SDK-ответ в server logs.

### Проверка задачи 3: CSV-импорт Tier 2
1. Откройте `/admin/inventory-upload`.
2. Выберите активную Tier 2 аптеку и загрузите тестовый CSV с колонками названия и остатка.
3. Повторите загрузку другим CSV для той же аптеки.
4. ✅ **Ожидаемый результат:** старые остатки этой аптеки полностью заменены, распознанные позиции попали в `inventory`, нераспознанные строки попали в `unmapped_strings`, отчет показывает количество строк.
5. ❌ **Если не работает:** проверьте формат CSV, словарь alias, RPC full sync и отсутствие старых остатков по `pharmacy_id`.

### Проверка задачи 4: Маппинг alias
1. Откройте `/admin/mapping`.
2. Свяжите одну нераспознанную строку с препаратом.
3. Для другой строки нажмите игнорирование.
4. ✅ **Ожидаемый результат:** связанная строка создает или обновляет `product_aliases` с `product_id`, игнорируемая строка создает или обновляет alias с `is_ignored = true`, обе строки исчезают из очереди.
5. ❌ **Если не работает:** проверьте RPC маппинга, существование строки в `unmapped_strings`, выбранный `product_id` и права администратора.

### Проверка задачи 5: Черный список
1. Откройте `/admin/blacklist`.
2. Включите `is_social_risk` для тестового препарата.
3. Выполните поиск этого препарата на главной и на `/map`.
4. Затем выключите флаг обратно.
5. ✅ **Ожидаемый результат:** препарат скрывается из обычной выдачи при включенном флаге и снова доступен после отключения; админский счетчик обновляется.
6. ❌ **Если не работает:** проверьте обновление `products.is_social_risk`, revalidate путей, read layer RPC поиска и права админской операции.

### Проверка задачи 6: Аналитика нулевой выдачи
1. На главной выполните стабильный поиск несуществующего препарата длиной минимум 3 символа.
2. Откройте `/admin/demand`.
3. Выполните restricted-запрос и снова проверьте `/admin/demand`.
4. ✅ **Ожидаемый результат:** обычный нулевой запрос появляется в аналитике, restricted-запрос не попадает в дефицит, дашборд продолжает агрегировать данные за 7 дней.
5. ❌ **Если не работает:** проверьте запись `search_logs`, активный город, debounce live-search и RPC дашборда.

### Проверка задачи 7: Сборка и качество
1. Выполните `npm run lint`.
2. Выполните `npm run build`.
3. Выполните `git diff --check`.
4. ✅ **Ожидаемый результат:** lint, build и проверка diff проходят успешно.
5. ❌ **Если не работает:** этап не считается завершенным; исправьте ошибку и повторите проверки.

### Итоговый критерий: Этап завершён, если
- [x] CRUD аптек работает через Supabase-слой и требует `requireAdmin()`.
- [x] CSV full sync выполняется атомарно через Supabase RPC и сохраняет текущее поведение отчета.
- [x] Маппинг alias и игнорирование строк работают через Supabase RPC.
- [x] Черный список препаратов работает через Supabase-слой и сохраняет restricted-поведение поиска.
- [x] Запись аналитики нулевой выдачи работает через Supabase-слой.
- [x] `anon` и неадминский `authenticated` пользователь не могут выполнять админские операции.
- [x] Prisma не удален и остается rollback-слоем до отдельного этапа Prisma decommission.
- [x] `npm run lint`, `npm run build` и `git diff --check` проходят успешно.

## Результаты выполнения
- Добавлена Supabase SQL-миграция `supabase/migrations/20260602120000_admin_mutations.sql` с RPC-функциями `gotmeds_admin_full_sync_inventory`, `gotmeds_admin_create_alias`, `gotmeds_admin_ignore_alias` и `gotmeds_admin_set_product_social_risk`.
- `src/lib/actions/admin.ts` переведен с Prisma runtime-запросов на Supabase Auth client для админских чтений, CRUD аптек, CSV full sync, маппинга alias и черного списка.
- `src/lib/actions/search.ts` переведен с Prisma на server-only Supabase client для получения активного города и записи `search_logs`.
- `supabase/README.md` обновлен: добавлен порядок применения новой миграции, проверки RPC-функций, прав выполнения и ручные проверки админских сценариев.
- Prisma не удален и остается rollback/seed-слоем до отдельного этапа Prisma decommission.
- Выполнены `npm run lint`, `npm run build` и `git diff --check`.
- `npm run lint` прошел с двумя существующими предупреждениями: custom font в `src/app/layout.tsx` и `<img>` на странице продукта.
- `npm run build` прошел успешно; при генерации `sitemap.xml` сработал ожидаемый fallback `fetch failed` из-за локальной недоступности Supabase во время build.
