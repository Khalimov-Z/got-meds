# Changelog: Этап 2 — Ядро Поискового Движка

**Дата:** 2026-05-11
**Ветка:** `feature/phase-2-search-engine`
**План:** [phase-2-search-engine.md](../plans/completed/phase-2-search-engine.md)

---

## Backend

### Новое
- **Расширение `pg_trgm`** — включено через SQL-миграцию для триграммного Fuzzy Search в PostgreSQL.
- **GIN-индексы** — созданы на `products.name` и `product_aliases.original_string` для ускорения нечёткого поиска.
- **Server Action `searchProducts(query)`** (`src/lib/actions/search.ts`):
  - Fuzzy Search по названиям товаров (`products.name`) через `SIMILARITY()`.
  - Fuzzy Search по алиасам из 1С (`product_aliases.original_string`).
  - Фильтрация запрещённых препаратов (`is_social_risk = true` — Чёрный список).
  - Минимальный порог схожести: `0.15`.
  - Максимум 20 результатов, сортировка по `similarity_score` (убывание).
  - Стандартизированный ответ: `{ success, data?, error? }`.
- **Тестовый API-эндпоинт** (`src/app/api/search/route.ts`):
  - `GET /api/search?q=<запрос>` — временный Route Handler для проверки поиска без UI.

## Data

### Новое
- **Миграция** `20260511145713_add_pg_trgm_fuzzy_search` — `CREATE EXTENSION pg_trgm` + GIN-индексы.

## Инфраструктура

### Новое
- **Prisma Singleton** (`src/lib/prisma.ts`) — паттерн для переиспользования PrismaClient при Hot Module Replacement в dev-режиме Next.js.

---

## Результаты тестирования

| Запрос | Ожидание | Результат |
|--------|----------|-----------|
| `?q=нурафен` | Нурофен (fuzzy) | ✅ score: 0.45 |
| `?q=Нуроф таб` | Нурофен (алиас) | ✅ score: 0.63 |
| `?q=диазепам` | Пусто (соцриск) | ✅ data: [] |
| `?q=хххххх` | Пусто (мусор) | ✅ data: [] |
| `?q=Парацетамол` | Точное совпадение | ✅ score: 1.0 |
