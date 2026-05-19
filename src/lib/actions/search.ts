// ==============================================
// GotMeds — Серверное действие: Поиск препаратов (Fuzzy Search)
// ==============================================
// Этап 2: Ядро Поискового Движка
// Реализует Fuzzy Search по названиям товаров и алиасам из 1С
// с использованием расширения pg_trgm (PostgreSQL).
//
// Источники:
// - spec/features/search-engine/search-engine.md
// - spec/technical/api-spec.md (контракт searchProducts)
// ==============================================

"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// --- Типы (согласно api-spec.md, раздел 2.1) ---

/** Элемент результата поиска */
export interface SearchResultItem {
  id: string;
  name: string;
  category: "medicine" | "equipment" | "vitamins" | "mother_and_baby";
  is_prescription: boolean;
  image_url: string;
  price_estimate: number | null;
  similarity_score: number;
  /** true = препарат заблокирован (соцриск). Всегда false в выдаче, т.к. соцриск фильтруется. */
  restricted: boolean;
}

/** Стандартизированный ответ (согласно api-spec.md, раздел 4) */
export interface SearchResponse {
  success: boolean;
  data?: SearchResultItem[];
  restricted?: boolean;
  restricted_product_name?: string;
  error?: string;
}

// --- Константы ---

/** Минимальный порог триграммной схожести (ниже — считаем нерелевантным) */
const SIMILARITY_THRESHOLD = 0.15;

/** Максимальное количество результатов в выдаче */
const MAX_RESULTS = 20;

// --- Маппинг категорий из Prisma enum в API-формат ---

const CATEGORY_MAP: Record<string, SearchResultItem["category"]> = {
  MEDICINE: "medicine",
  EQUIPMENT: "equipment",
  VITAMINS: "vitamins",
  MOTHER_AND_BABY: "mother_and_baby",
};

// --- Основная функция поиска ---

/**
 * Поиск препаратов с поддержкой опечаток (Fuzzy Search).
 *
 * Алгоритм:
 * 1. Ищет по `products.name` через триграммную схожесть (SIMILARITY).
 * 2. Ищет по `product_aliases.original_string` и подтягивает связанный продукт.
 * 3. Объединяет результаты, выбирает лучший score для каждого продукта.
 * 4. Фильтрует: исключает препараты с `is_social_risk = true`.
 * 5. Сортирует по убыванию similarity_score.
 *
 * @param query — строка поискового запроса (например, "нурафен", "аспирин 500мг")
 * @returns стандартизированный ответ с массивом найденных препаратов
 */
export async function searchProducts(query: string): Promise<SearchResponse> {
  try {
    // Валидация входных данных
    const trimmedQuery = query?.trim();
    if (!trimmedQuery || trimmedQuery.length === 0) {
      return { success: true, data: [] };
    }

    // Защита от SQL-инъекций: Prisma.$queryRaw использует параметризованные запросы
    const searchTerm = trimmedQuery;

    const [bestMatch] = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        is_social_risk: boolean;
        similarity_score: number;
      }>
    >(
      Prisma.sql`
        WITH search_results AS (
          SELECT
            p.id,
            p.name,
            p.is_social_risk,
            SIMILARITY(LOWER(p.name), LOWER(${searchTerm})) AS similarity_score
          FROM products p
          WHERE SIMILARITY(LOWER(p.name), LOWER(${searchTerm})) > ${SIMILARITY_THRESHOLD}

          UNION ALL

          SELECT
            p.id,
            p.name,
            p.is_social_risk,
            SIMILARITY(LOWER(pa.original_string), LOWER(${searchTerm})) AS similarity_score
          FROM product_aliases pa
          INNER JOIN products p ON pa.product_id = p.id
          WHERE pa.is_ignored = false
            AND pa.product_id IS NOT NULL
            AND SIMILARITY(LOWER(pa.original_string), LOWER(${searchTerm})) > ${SIMILARITY_THRESHOLD}
        )
        SELECT
          id,
          name,
          is_social_risk,
          MAX(similarity_score) AS similarity_score
        FROM search_results
        GROUP BY id, name, is_social_risk
        ORDER BY similarity_score DESC, is_social_risk DESC
        LIMIT 1
      `
    );

    if (bestMatch?.is_social_risk) {
      return {
        success: true,
        data: [],
        restricted: true,
        restricted_product_name: bestMatch.name,
      };
    }

    // --- SQL-запрос с триграммным поиском ---
    // Объединяем поиск по products.name и product_aliases.original_string
    // через UNION, затем группируем по product_id и берём максимальный score.
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        category: string;
        is_prescription: boolean | null;
        image_url: string | null;
        price_estimate: number | null;
        is_social_risk: boolean;
        similarity_score: number;
      }>
    >(
      Prisma.sql`
        WITH search_results AS (
          -- Поиск по названию продукта
          SELECT
            p.id,
            p.name,
            p.category::text,
            p.is_prescription,
            p.image_url,
            p.price_estimate,
            p.is_social_risk,
            SIMILARITY(LOWER(p.name), LOWER(${searchTerm})) AS similarity_score
          FROM products p
          WHERE SIMILARITY(LOWER(p.name), LOWER(${searchTerm})) > ${SIMILARITY_THRESHOLD}

          UNION ALL

          -- Поиск по алиасам (синонимы из 1С)
          SELECT
            p.id,
            p.name,
            p.category::text,
            p.is_prescription,
            p.image_url,
            p.price_estimate,
            p.is_social_risk,
            SIMILARITY(LOWER(pa.original_string), LOWER(${searchTerm})) AS similarity_score
          FROM product_aliases pa
          INNER JOIN products p ON pa.product_id = p.id
          WHERE pa.is_ignored = false
            AND pa.product_id IS NOT NULL
            AND SIMILARITY(LOWER(pa.original_string), LOWER(${searchTerm})) > ${SIMILARITY_THRESHOLD}
        )
        -- Группируем по продукту, берём максимальный score
        SELECT
          id,
          name,
          category,
          is_prescription,
          image_url,
          price_estimate,
          is_social_risk,
          MAX(similarity_score) AS similarity_score
        FROM search_results
        -- Фильтрация социально-рискованных препаратов (Чёрный список)
        WHERE is_social_risk = false
        GROUP BY id, name, category, is_prescription, image_url, price_estimate, is_social_risk
        ORDER BY similarity_score DESC
        LIMIT ${MAX_RESULTS}
      `
    );

    // --- Маппинг результатов в API-формат ---
    const data: SearchResultItem[] = results.map((row) => ({
      id: row.id,
      name: row.name,
      category: CATEGORY_MAP[row.category] || "medicine",
      is_prescription: row.is_prescription ?? false,
      image_url: row.image_url ?? "",
      price_estimate: row.price_estimate,
      similarity_score: Math.round(Number(row.similarity_score) * 100) / 100,
      restricted: false, // Всегда false, т.к. is_social_risk уже отфильтрован
    }));

    return { success: true, data };
  } catch (error) {
    console.error("❌ Ошибка поиска препаратов:", error);
    return {
      success: false,
      error: "Произошла ошибка при поиске. Попробуйте позже.",
    };
  }
}
