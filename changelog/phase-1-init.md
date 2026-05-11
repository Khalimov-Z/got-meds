# Changelog: Этап 1 — Инициализация и Слой Данных

**Дата:** 2026-05-11
**Ветка:** `feature/phase-1-init`
**План:** [phase-1-init.md](../plans/completed/phase-1-init.md)

---

## Frontend
- Инициализирован **Next.js 16.2.6** (App Router, TypeScript, `src/` директория).
- Удалён Tailwind CSS — настроен **Vanilla CSS** с дизайн-токенами (CSS-переменные).
- Создана стартовая страница-заглушка (`src/app/page.tsx`) с заголовком GotMeds.
- Настроены SEO-метаданные в корневом layout (`lang="ru"`, title, description).

## Backend / Data
- Подключён **Prisma ORM v7** с driver adapter (`@prisma/adapter-pg`).
- Подключена облачная БД **Neon PostgreSQL 17**.
- Создан файл конфигурации `prisma.config.ts` (формат Prisma 7).
- Файл `.env` с `DATABASE_URL` добавлен в `.gitignore`.

## Data (Схема БД)
- Создана Prisma-схема (`prisma/schema.prisma`) с 5 моделями:
  - `City` — города (мультигородская архитектура).
  - `Pharmacy` — аптеки (3 Tier, график, координаты).
  - `Product` — справочник товаров (лекарства, медтехника, БАДы).
  - `Inventory` — наличие товаров в аптеках (Many-to-Many).
  - `ProductAlias` — алиасы маппинга из 1С.
- Созданы 4 enum: `PharmacyTier`, `PharmacyStatus`, `ProductCategory`, `InventoryStatus`.
- Выполнена первичная миграция `init_phase1`.

## Data (Seed-скрипт)
- Создан seed-скрипт (`prisma/seed.ts`) с тестовыми данными:
  - 1 город (Гудермес).
  - 3 аптеки (Tier 1, Tier 2, Tier 3).
  - 15 препаратов (разные категории, включая `is_social_risk`).
  - 5 алиасов (включая 1 игнорируемый).
  - 22 записи наличия (IN_STOCK + LIKELY_IN_STOCK).

## Инфраструктура
- Создан шаблон планов (`plans/TEMPLATE.md`) с обязательным разделом пользовательской проверки.
- Добавлено **Правило 6** в `AGENTS.md` — обязательный чеклист проверки в каждом плане.
