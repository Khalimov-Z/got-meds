# План разработки: Supabase Auth and RLS

**Статус:** Завершено (Completed)
**Основание:** [spec/technical/supabase-platform-migration.md](../../spec/technical/supabase-platform-migration.md), раздел 6.4; [spec/technical/security-performance.md](../../spec/technical/security-performance.md), разделы 3.4-3.5; [spec/features/admin-panel/admin-panel-spec.md](../../spec/features/admin-panel/admin-panel-spec.md), раздел 1; [spec/features/data-architecture/data-architecture.md](../../spec/features/data-architecture/data-architecture.md), разделы 3.2-3.3; [spec/technical/api-spec.md](../../spec/technical/api-spec.md), разделы 1.1 и 3

## Цель
Перенести админскую авторизацию GotMeds с текущей серверной cookie/bcrypt-схемы на Supabase Auth, связать Auth users с доменными ролями администраторов `superadmin` и `content_manager`, включить Row Level Security для таблиц, доступных через Supabase API, и проверить, что публичный пользователь и неадминский Auth user не получают доступ к админским данным и операциям.

По завершении этапа админка должна входить через Supabase Auth, `requireAdmin()` должен проверять Supabase-сессию и доменную роль администратора, а RLS-политики должны закрывать чувствительные таблицы от `anon` и обычных `authenticated` пользователей. Prisma, текущие админские мутации, CSV-импорт, маппинг, CRUD аптек, черный список и rollback-слой не удаляются и не переписываются в рамках этого плана.

## Границы этапа
- Входит: добавление официального server-side Supabase Auth слоя для Next.js, если нужная зависимость отсутствует.
- Входит: настройка серверных Supabase Auth helpers для чтения/обновления сессии через cookies.
- Входит: перенос `loginAdmin`, `logoutAdmin`, `getCurrentAdmin` и `requireAdmin` на Supabase Auth с сохранением текущих UI-маршрутов `/admin`, `/admin/login` и формы входа.
- Входит: добавление связи между Supabase Auth user и доменным администратором через таблицу `admins` или профильную таблицу, совместимую с текущими ролями.
- Входит: Supabase SQL migration для RLS helper-функций, включения RLS и политик доступа.
- Входит: документация в `supabase/README.md` по созданию/связыванию тестового администратора Supabase Auth и проверке RLS.
- Не входит: перенос админских мутаций на Supabase SDK/RPC, включая CRUD аптек, CSV-импорт, маппинг alias, черный список и полное удаление Prisma.
- Не входит: создание пользовательских аккаунтов для клиентов, изменение клиентского UI, изменение доменной модели препаратов/аптек, Supabase Storage, Realtime и production-деплой.
- Не входит: физическое удаление legacy-полей и зависимостей, которые нужны seed/rollback-слою, если их безопасное удаление не описано отдельным планом.

## Задачи:
- [x] **1. Зафиксировать текущее состояние auth и подготовить Supabase Auth слой:**
  - Провести аудит `src/lib/admin/auth.ts`, страниц `/admin/*`, `src/lib/actions/admin.ts`, `src/lib/supabase-server.ts`, `prisma/schema.prisma` и текущих Supabase migrations.
  - Добавить server-side Supabase Auth helper для cookies и обновления сессии в Next.js.
  - Добавить зависимость для server-side Supabase Auth в Next.js, если ее нет в `package.json`.
  - Описать env-переменные для Auth: публичный URL/ключ Supabase и server-only service role key без коммита секретов.
  - Сохранить текущий service-role helper только на серверной границе.

- [x] **2. Связать Supabase Auth users с доменными администраторами:**
  - Создать Supabase SQL migration для связи Auth user с доменной ролью администратора.
  - Сохранить роли `superadmin` и `content_manager` как источник прав админки.
  - Поддержать миграционный сценарий: существующая запись `admins.email` связывается с Supabase Auth user по email, если такой user уже создан.
  - Обновить `prisma/schema.prisma` только в той части, которая нужна переходному runtime/rollback-слою.
  - Не удалять legacy `password_hash`, пока Prisma/seed/rollback-слой остаются в проекте.

- [x] **3. Перенести админскую сессию на Supabase Auth:**
  - Переписать `loginAdmin` на Supabase Auth email/password login.
  - После успешного Auth login проверять наличие связанного доменного администратора и роли; при отсутствии роли не выдавать доступ в админку.
  - Переписать `getCurrentAdmin` и `requireAdmin` так, чтобы они читали Supabase-сессию и возвращали текущий контракт `CurrentAdmin`.
  - Переписать `logoutAdmin` на Supabase sign out и очистку cookies.
  - Сохранить визуальное поведение `/admin/login`, `/admin` и внутренних страниц админки без редизайна.

- [x] **4. Включить RLS и политики доступа:**
  - Создать SQL helper-функции для проверки текущей админской роли через `auth.uid()` и доменный профиль администратора.
  - Включить RLS для таблиц, которые доступны или могут стать доступны через Supabase API.
  - Разрешить публичное чтение только безопасных данных клиентского приложения.
  - Запретить `anon` и обычным `authenticated` пользователям чтение и изменение чувствительных таблиц: `admins`, `unmapped_strings`, `search_logs`, внутренних очередей и админских справочников.
  - Разрешить админские операции только пользователям с доменной ролью администратора.
  - Сохранить запрет `EXECUTE` для read layer RPC у `anon` и обычного `authenticated`, если функция должна вызываться только server-side через `service_role`.

- [x] **5. Проверить безопасность границ:**
  - Убедиться, что `service_role` ключ не используется в клиентских компонентах, публичном JavaScript и browser Supabase client.
  - Проверить, что обычный пользователь без Supabase Auth не попадает в `/admin/*`.
  - Проверить, что Supabase Auth user без доменного профиля администратора не получает доступ к админке.
  - Проверить, что `content_manager` и `superadmin` распознаются `requireAdmin()`.
  - Проверить, что restricted-поиск и публичные read-сценарии не изменили поведение после включения RLS.

- [x] **6. Выполнить регрессионную проверку приложения:**
  - Проверить вход и выход администратора.
  - Проверить `/admin`, `/admin/pharmacies`, `/admin/inventory-upload`, `/admin/mapping`, `/admin/blacklist` и `/admin/demand`.
  - Проверить публичные сценарии: поиск `нурофен`, alias `Нуроф таб 200мг`, restricted-запрос `диазепам`, страницу `Но-Шпа`, аналоги, карту и `/sitemap.xml`.
  - Проверить, что текущие админские мутации продолжают работать через существующий серверный слой и требуют `requireAdmin()`.

- [x] **7. Выполнить технические проверки:**
  - Выполнить установку зависимостей, если добавлена новая зависимость.
  - Выполнить `npx prisma generate`, если изменена Prisma-схема.
  - Выполнить `npm run lint`.
  - Выполнить `npm run build`.
  - Выполнить `git diff --check`.
  - Проверить, что Prisma не удален и остается для сценариев вне этапа 6.4 и rollback.

## Пользовательская проверка (Пошаговый чеклист)

> Выполните каждый шаг по порядку. Если на любом шаге результат не совпадает с ожидаемым — значит что-то пошло не так.

### Проверка задачи 1: Supabase Auth подготовлен
1. Откройте `package.json`, `src/lib/` и `supabase/README.md`.
2. Проверьте локальный `.env.local`: должны быть заданы Supabase URL, публичный ключ для Auth и server-only service role key; реальные значения не должны попадать в Git.
3. ✅ **Ожидаемый результат:** Auth helper работает только через серверную/cookie-границу, `service_role` остается server-only, секреты не закоммичены.
4. ❌ **Если не работает:** остановитесь; проверьте имена env-переменных, отсутствие секретов в diff и импорты server/client helper-ов.

### Проверка задачи 2: Администратор связан с Supabase Auth
1. Примените новую SQL-миграцию в тестовом Supabase project.
2. В Supabase Auth создайте тестового пользователя с email существующего администратора, например `admin@gotmeds.local`, и задайте пароль.
3. В Supabase SQL Editor выполните проверочный запрос из `supabase/README.md` для связи Auth user с записью `admins`.
4. ✅ **Ожидаемый результат:** у доменного администратора есть связь с Supabase Auth user, роль `superadmin` или `content_manager` сохранена.
5. ❌ **Если не работает:** проверьте email Auth user, подтверждение пользователя в Supabase Auth и SQL-связь с записью `admins`.

### Проверка задачи 3: Вход и выход администратора
1. Запустите приложение командой `npm run dev`.
2. Откройте `/admin/login`.
3. Войдите email/password пользователя из Supabase Auth.
4. Нажмите выход из админки.
5. ✅ **Ожидаемый результат:** успешный вход ведет на `/admin`, в шапке виден email администратора, выход возвращает на `/admin/login`.
6. ❌ **Если не работает:** проверьте Supabase Auth настройки password login, cookies, env-переменные и связь Auth user с доменным администратором.

### Проверка задачи 4: Защита админки
1. В приватном окне откройте `/admin`.
2. Попробуйте войти неверным паролем.
3. Создайте или используйте Supabase Auth user без записи в `admins` и попробуйте войти.
4. ✅ **Ожидаемый результат:** без сессии `/admin` ведет на `/admin/login`, неверный пароль показывает ошибку, пользователь без доменной роли не получает доступ в админку.
5. ❌ **Если не работает:** проверьте `requireAdmin()`, обработку ошибок login и проверку доменной роли.

### Проверка задачи 5: RLS закрывает чувствительные данные
1. В Supabase SQL Editor выполните проверочные запросы из `supabase/README.md` по RLS, политикам и правам `anon`/`authenticated`/`service_role`.
2. Проверьте, что read layer RPC по-прежнему не исполняются ролями `anon` и обычной `authenticated`.
3. ✅ **Ожидаемый результат:** RLS включен на нужных таблицах, чувствительные таблицы закрыты для `anon` и неадминских пользователей, админские политики завязаны на доменную роль.
4. ❌ **Если не работает:** не переходите к production; сохраните SQL-ошибку, проверьте helper-функции `auth.uid()` и политики.

### Проверка задачи 6: Регрессия публичных сценариев
1. На главной странице выполните поиск `нурофен`.
2. Выполните поиск alias `Нуроф таб 200мг`.
3. Выполните restricted-запрос `диазепам`.
4. Откройте страницу `Но-Шпа`, блок аналогов, карту и `/sitemap.xml`.
5. ✅ **Ожидаемый результат:** публичное поведение не изменилось; restricted-препарат не попадает в обычную выдачу и аналитику дефицита.
6. ❌ **Если не работает:** проверьте RLS-политики публичного чтения, service-role read layer и RPC-права.

### Проверка задачи 7: Админские сценарии после Auth/RLS
1. Под админским пользователем откройте `/admin/pharmacies`, `/admin/inventory-upload`, `/admin/mapping`, `/admin/blacklist` и `/admin/demand`.
2. Выполните по одному безопасному действию в тестовой базе: открыть списки, проверить форму, выполнить тестовое изменение только на тестовых данных.
3. ✅ **Ожидаемый результат:** страницы доступны только после Supabase Auth login, текущие серверные действия продолжают работать и требуют `requireAdmin()`.
4. ❌ **Если не работает:** проверьте, не была ли случайно перенесена или сломана админская mutation-логика вне границ этапа 6.4.

### Проверка задачи 8: Сборка и качество
1. Выполните `npm run lint`.
2. Выполните `npm run build`.
3. Выполните `git diff --check`.
4. ✅ **Ожидаемый результат:** lint, build и проверка diff проходят успешно.
5. ❌ **Если не работает:** этап не считается завершенным; исправьте ошибку и повторите проверки.

### Итоговый критерий: Этап завершён, если
- [x] Админский вход работает через Supabase Auth.
- [x] `requireAdmin()` возвращает текущий контракт администратора на основе Supabase-сессии и доменной роли.
- [x] Supabase Auth user без доменной роли администратора не получает доступ к `/admin/*`.
- [x] RLS включен и чувствительные таблицы закрыты от `anon` и обычных `authenticated` пользователей.
- [x] Read layer RPC сохраняют server-only границу и не становятся публичным каналом доступа к данным.
- [x] Публичные сценарии поиска, продукта, аналогов, карты и sitemap работают без изменения UI/поведения.
- [x] Prisma не удален и админские мутации не перенесены вне утвержденного этапа.
- [x] `npm run lint`, `npm run build` и `git diff --check` проходят успешно.

## Результаты выполнения
- Добавлена зависимость `@supabase/ssr` для server-side Supabase Auth в Next.js.
- Созданы `src/lib/supabase-auth-config.ts` и `src/lib/supabase-auth-server.ts` для cookie-based Supabase Auth client без использования `service_role` в browser-контексте.
- `middleware.ts` переведен с legacy cookie-проверки на Supabase Auth `getClaims()` для защиты `/admin/*` и обновления auth cookies.
- `src/lib/admin/auth.ts` переведен на Supabase Auth email/password: `loginAdmin`, `logoutAdmin`, `getCurrentAdmin` и `requireAdmin` сохраняют текущий UI-контракт админки.
- Добавлена связь `admins.auth_user_id` с Supabase Auth user в `prisma/schema.prisma` и SQL-миграции.
- Создана Supabase SQL-миграция `supabase/migrations/20260601143000_auth_rls.sql` с RLS helper-функциями, включением RLS и политиками для публичных и чувствительных таблиц.
- Обновлен `supabase/README.md`: добавлены env-переменные Auth, порядок применения миграции, связывание тестового администратора и SQL-проверки RLS.
- Prisma не удален, legacy `password_hash` оставлен для rollback/seed-слоя, админские мутации не переносились.
- Выполнены `npx prisma generate`, `npm run lint`, `npm run build` и `git diff --check`.
- `npm run lint` прошел с двумя существующими предупреждениями: custom font в `src/app/layout.tsx` и `<img>` на странице продукта.
- `npm run build` прошел успешно; при генерации `sitemap.xml` сработал ожидаемый fallback `fetch failed` из-за локальной недоступности Supabase во время build.
- Ручная проверка Supabase Auth user, RLS-политик в SQL Editor и входа в админку подтверждена пользователем перед push.
