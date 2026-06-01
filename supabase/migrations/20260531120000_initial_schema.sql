-- ==============================================
-- GotMeds — начальная схема Supabase SQL
-- ==============================================
-- Источник: prisma/schema.prisma и prisma/migrations/*
-- Этап: Supabase SQL migrations and seed
-- Эта миграция воспроизводит текущую реализованную схему без изменения runtime-кода.
-- ==============================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ==============================================
-- Перечисления
-- ==============================================

CREATE TYPE "PharmacyTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');
CREATE TYPE "PharmacyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');
CREATE TYPE "ProductCategory" AS ENUM ('MEDICINE', 'EQUIPMENT', 'VITAMINS', 'MOTHER_AND_BABY');
CREATE TYPE "InventoryStatus" AS ENUM ('IN_STOCK', 'LIKELY_IN_STOCK');
CREATE TYPE "AdminRole" AS ENUM ('SUPERADMIN', 'CONTENT_MANAGER');

-- ==============================================
-- Таблицы
-- ==============================================

CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "center_latitude" DOUBLE PRECISION NOT NULL,
    "center_longitude" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'CONTENT_MANAGER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pharmacies" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "tier" "PharmacyTier" NOT NULL,
    "status" "PharmacyStatus" NOT NULL DEFAULT 'ACTIVE',
    "phone" TEXT,
    "whatsapp" TEXT,
    "working_hours" JSONB,
    "is_24_7" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pharmacies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "active_ingredient" TEXT,
    "form" TEXT,
    "dosage" TEXT,
    "is_prescription" BOOLEAN,
    "is_social_risk" BOOLEAN NOT NULL DEFAULT false,
    "price_estimate" DOUBLE PRECISION,
    "description" TEXT,
    "image_url" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory" (
    "pharmacy_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "status" "InventoryStatus" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" DOUBLE PRECISION,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("pharmacy_id","product_id")
);

CREATE TABLE "product_aliases" (
    "id" UUID NOT NULL,
    "original_string" TEXT NOT NULL,
    "product_id" UUID,
    "is_ignored" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_aliases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "unmapped_strings" (
    "id" UUID NOT NULL,
    "pharmacy_id" UUID NOT NULL,
    "raw_string" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unmapped_strings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "search_logs" (
    "id" UUID NOT NULL,
    "search_term" TEXT NOT NULL,
    "city_id" UUID NOT NULL,
    "user_latitude" DOUBLE PRECISION,
    "user_longitude" DOUBLE PRECISION,
    "results_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- ==============================================
-- Индексы
-- ==============================================

CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");
CREATE INDEX "unmapped_strings_pharmacy_id_idx" ON "unmapped_strings"("pharmacy_id");
CREATE INDEX "search_logs_city_id_created_at_idx" ON "search_logs"("city_id", "created_at");
CREATE INDEX "search_logs_search_term_idx" ON "search_logs"("search_term");

CREATE INDEX "idx_products_name_trgm" ON "products" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "idx_product_aliases_original_string_trgm" ON "product_aliases" USING GIN ("original_string" gin_trgm_ops);

-- ==============================================
-- Внешние ключи
-- ==============================================

ALTER TABLE "pharmacies"
    ADD CONSTRAINT "pharmacies_city_id_fkey"
    FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory"
    ADD CONSTRAINT "inventory_pharmacy_id_fkey"
    FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory"
    ADD CONSTRAINT "inventory_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_aliases"
    ADD CONSTRAINT "product_aliases_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "unmapped_strings"
    ADD CONSTRAINT "unmapped_strings_pharmacy_id_fkey"
    FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "search_logs"
    ADD CONSTRAINT "search_logs_city_id_fkey"
    FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
