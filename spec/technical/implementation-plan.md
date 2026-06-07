# План реализации GotMeds (Phase 0 MVP)

> **Статус:** Draft
> **Идентификатор:** TECH-PLAN-01
> **Название:** Пошаговый план реализации MVP
> **Тип:** Архитектурный документ
> **Родитель:** [tech-stack.md](./tech-stack.md)
> **Связанные:** Все спецификации из `technical/` и `features/`

---

## 1️⃣ Инициализация проекта
- `npx -y create-next-app@latest ./` (Next.js 13+ с App Router, TypeScript).
- Установить зависимости текущего MVP: `@supabase/ssr`, `@supabase/supabase-js`, `papaparse`, `next`, `react`, `react-dom`.
- Добавить локальные Supabase env-переменные: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Для локальных SQL-проверок допускается `DATABASE_URL`, указывающий на Supabase PostgreSQL.

## 2️⃣ Настройка базы данных
- Создать Supabase SQL migrations согласно `spec/features/data-architecture/data-architecture.md` (таблицы **Products**, **Product_Aliases**, **Pharmacies**, **Inventory**, **Search_Logs**).
- Добавить поля `dosage`, `active_ingredient`, `price_estimate`, `is_social_risk` и enum‑значение `mother_and_baby`.
- Применить SQL-миграции из `supabase/migrations/` на чистой тестовой Supabase PostgreSQL базе.
- Подготовить `supabase/seed.sql` с тестовыми данными (аптеки Tier 1‑3, несколько препаратов).

## 3️⃣ Реализация ядра функций
### 3.1 Поиск препаратов
- Server Action `searchProducts(query: string)` → fuzzy‑search через `pg_trgm`.
- Обработка `restricted`‑флага и `is_social_risk`.

### 3.2 Получение аналогов
- Server Action `getAnalogs(productId: string)` (см. `spec/technical/analogs-api-spec.md`).

### 3.3 Карта аптек
- Функция `getPharmaciesByProduct` + lazy‑load Яндекс/2GIS‑скриптов.
- Фильтр «Открыто сейчас» и Tier‑фильтрация.

### 3.4 Запись аналитики
- `logZeroResultSearch` → записывает в `Search_Logs`.

## 4️⃣ Админ‑панель
- Защищённые роуты (`/admin/*`) через Supabase Auth session cookie, `requireAdmin()` и доменные роли администратора.
- CSV‑импорт `uploadPharmacyPrice` + маппинг алиасов (`createAlias`, `ignoreAlias`).
- Дашборд аналитики (неудовлетворённый спрос, топ‑препаратов).

## 5️⃣ UI/UX & SEO
- Дизайн‑система из `spec/technical/design-system.md` (glassmorphism, HSL‑палитра, микро‑анимации).
- Страница продукта `/product/[id]` (см. `spec/technical/seo-page-spec.md`) – SSR, динамические meta‑теги.
- PWA‑манифест и сервис‑воркер — согласно требованиям [security-performance.md](./security-performance.md).
- Доступность (ARIA, контраст, клавиатурная навигация) — проверяется в рамках Lighthouse-аудита и требований [security-performance.md](./security-performance.md).

## 6️⃣ Тестирование & Полировка
- Юнит‑тесты для Server Actions (Jest).
- E2E‑тесты Cypress (поиск, карта, админ‑загрузка CSV).
- Lighthouse‑аудит (Performance ≥ 90, SEO ≥ 95, Accessibility ≥ 90).

## 7️⃣ Деплой
- Pre-deploy readiness перед публичным запуском: rate limiting публичного поиска, пользовательские жалобы, проверка `sitemap.xml`, `.env.example`, lint/build/unit/E2E/Lighthouse по доступному окружению.
- Vercel (Frontend) + Supabase/PostgreSQL (DB) или собственный VPS.
- CI/CD pipeline (GitHub Actions) переносится в будущий отдельный план и не является обязательным условием текущего пробного деплоя. До внедрения CI/CD проверки выполняются локально по преддеплойному чеклисту.

---
**Файл:** `spec/technical/implementation-plan.md`
