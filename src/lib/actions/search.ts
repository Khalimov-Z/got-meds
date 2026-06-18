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

import { getSupabaseServerClient } from "@/lib/supabase-server";

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

/** Стандартизированный ответ логирования нулевой выдачи */
export interface LogZeroResultSearchResponse {
  success: boolean;
  error?: string;
}

// --- Константы ---

/** Минимальный порог триграммной схожести (ниже — считаем нерелевантным) */
const SIMILARITY_THRESHOLD = 0.15;

/** Максимальное количество результатов в выдаче */
const MAX_RESULTS = 20;

/** Минимальная длина запроса, который имеет смысл писать в аналитику */
const MIN_ZERO_RESULT_SEARCH_LENGTH = 3;

// --- Маппинг категорий из БД enum в API-формат ---

const CATEGORY_MAP: Record<string, SearchResultItem["category"]> = {
  MEDICINE: "medicine",
  EQUIPMENT: "equipment",
  VITAMINS: "vitamins",
  MOTHER_AND_BABY: "mother_and_baby",
};

type SearchProductsRpcItem = {
  id: string;
  name: string;
  category: string;
  is_prescription: boolean | null;
  image_url: string | null;
  price_estimate: number | null;
  similarity_score: number | string;
};

type SearchProductsRpcPayload = {
  restricted?: boolean;
  restricted_product_name?: string | null;
  items?: SearchProductsRpcItem[];
};

function isFiniteCoordinate(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

async function getActiveCityId() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("cities")
    .select("id")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

export async function logZeroResultSearch(
  searchTerm: string,
  cityId: string,
  lat?: number,
  lng?: number
): Promise<LogZeroResultSearchResponse> {
  try {
    const normalizedSearchTerm = searchTerm?.trim();
    const normalizedCityId = cityId?.trim();

    if (!normalizedSearchTerm) {
      return { success: false, error: "Поисковый запрос обязателен" };
    }

    if (normalizedSearchTerm.length < MIN_ZERO_RESULT_SEARCH_LENGTH) {
      return { success: true };
    }

    if (!normalizedCityId) {
      return { success: false, error: "Город обязателен" };
    }

    const supabase = getSupabaseServerClient();
    const { data: city, error: cityError } = await supabase
      .from("cities")
      .select("id")
      .eq("id", normalizedCityId)
      .eq("is_active", true)
      .maybeSingle<{ id: string }>();

    if (cityError || !city) {
      return { success: false, error: "Город не найден" };
    }

    const { error: insertError } = await supabase
      .from("search_logs")
      .insert({
        search_term: normalizedSearchTerm,
        city_id: city.id,
        user_latitude: isFiniteCoordinate(lat) ? lat : null,
        user_longitude: isFiniteCoordinate(lng) ? lng : null,
        results_count: 0,
      });

    if (insertError) {
      throw insertError;
    }

    return { success: true };
  } catch (error) {
    console.error("❌ Ошибка логирования нулевой выдачи:", error);
    return {
      success: false,
      error: "Не удалось записать аналитику поиска.",
    };
  }
}

export async function logZeroResultSearchForActiveCity(
  searchTerm: string,
  lat?: number,
  lng?: number
): Promise<LogZeroResultSearchResponse> {
  const activeCityId = await getActiveCityId();

  if (!activeCityId) {
    return { success: false, error: "Активный город не найден" };
  }

  return logZeroResultSearch(searchTerm, activeCityId, lat, lng);
}

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
export async function searchProducts(query: string, category?: string): Promise<SearchResponse> {
  try {
    // Валидация входных данных
    const trimmedQuery = query?.trim() ?? "";
    const trimmedCategory = category?.trim() || null;

    // Если нет ни запроса, ни категории — пустой результат
    if (trimmedQuery.length === 0 && !trimmedCategory) {
      return { success: true, data: [] };
    }

    const searchTerm = trimmedQuery;
    const supabase = getSupabaseServerClient();

    const { data: payload, error } = await supabase.rpc("gotmeds_search_products", {
      p_query: searchTerm,
      p_similarity_threshold: SIMILARITY_THRESHOLD,
      p_limit: MAX_RESULTS,
      p_category: trimmedCategory,
    });

    if (error) {
      throw error;
    }

    const searchPayload = payload as SearchProductsRpcPayload | null;

    if (searchPayload?.restricted) {
      return {
        success: true,
        data: [],
        restricted: true,
        restricted_product_name: searchPayload.restricted_product_name ?? undefined,
      };
    }

    const results = Array.isArray(searchPayload?.items) ? searchPayload.items : [];
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
