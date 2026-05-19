-- ==============================================
-- GotMeds — Миграция: администраторы и очередь маппинга CSV
-- ==============================================
-- Этап 5: Админ-панель и импорт прайс-листов.
-- Добавляет учетные записи администраторов и временную очередь
-- строк из CSV, которые требуют ручного маппинга.
-- ==============================================

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPERADMIN', 'CONTENT_MANAGER');

-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'CONTENT_MANAGER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unmapped_strings" (
    "id" UUID NOT NULL,
    "pharmacy_id" UUID NOT NULL,
    "raw_string" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unmapped_strings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "unmapped_strings_pharmacy_id_idx" ON "unmapped_strings"("pharmacy_id");

-- AddForeignKey
ALTER TABLE "unmapped_strings" ADD CONSTRAINT "unmapped_strings_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
