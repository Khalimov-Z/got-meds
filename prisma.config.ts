// ==============================================
// GotMeds — Конфигурация Prisma ORM (v7)
// ==============================================
// В Prisma 7 строка подключения к БД вынесена из schema.prisma в этот файл.
// ==============================================

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // Путь к файлу схемы
  schema: "prisma/schema.prisma",

  // Настройки миграций и seed
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },

  // Подключение к БД (Neon PostgreSQL)
  datasource: {
    url: env("DATABASE_URL"),
  },
});
