// ==============================================
// GotMeds — Инициализация Prisma Client (Singleton)
// ==============================================
// Используется во всех серверных компонентах и Server Actions.
// Паттерн Singleton предотвращает создание множества подключений
// при Hot Reload в режиме разработки (Next.js).
// ==============================================

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Расширяем глобальный тип для хранения экземпляра Prisma
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Создаёт новый экземпляр PrismaClient с driver adapter для PostgreSQL.
 * Используется PrismaPg адаптер (Prisma 7+) для прямого подключения через pg.
 */
function createPrismaClient(): PrismaClient {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/**
 * Экспортируемый экземпляр Prisma.
 * В production создаётся один раз.
 * В development переиспользуется через globalThis, чтобы избежать
 * утечки подключений при Hot Module Replacement.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
