-- ==============================================
-- GotMeds — Миграция: Включение pg_trgm и создание GIN-индексов
-- ==============================================
-- Этап 2: Ядро Поискового Движка
-- Включаем расширение pg_trgm для триграммного Fuzzy Search.
-- Создаём GIN-индексы для быстрого поиска по названиям товаров и алиасам.
-- ВНИМАНИЕ: Prisma не умеет управлять GIN-индексами на String-полях.
-- Эти индексы управляются вручную через SQL-миграции.
-- ==============================================

-- Включение расширения pg_trgm (поддерживается Neon, Supabase и стандартным PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN-индекс на поле products.name для быстрого Fuzzy Search по названию товара
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);

-- GIN-индекс на поле product_aliases.original_string для поиска по алиасам из 1С
CREATE INDEX idx_product_aliases_original_string_trgm ON product_aliases USING GIN (original_string gin_trgm_ops);