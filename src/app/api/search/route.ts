// ==============================================
// GotMeds — Тестовый API-эндпоинт: Поиск препаратов
// ==============================================
// Этап 2: Ядро Поискового Движка
// Временный Route Handler для проверки работы Fuzzy Search без UI.
// Принимает GET-запрос с query-параметром `q`.
//
// Пример: GET /api/search?q=нурафен
//
// Источник: spec/technical/api-spec.md
// ==============================================

import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/actions/search";
import { applyPublicApiRateLimit } from "@/lib/public-api-rate-limit";

/**
 * GET /api/search?q=<запрос>
 *
 * Тестовый эндпоинт для проверки поисковой функции.
 * Вызывает Server Action searchProducts и возвращает JSON-результат.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = applyPublicApiRateLimit(request, "api-search");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Извлекаем query-параметры из URL
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const category = searchParams.get("category");

  // Валидация: нужен хотя бы один параметр — q или category
  if ((!query || query.trim().length === 0) && (!category || category.trim().length === 0)) {
    return NextResponse.json(
      {
        success: false,
        error: "Параметр 'q' или 'category' обязателен. Пример: /api/search?q=нурофен или /api/search?category=equipment",
      },
      { status: 400 }
    );
  }

  // Вызов серверного действия поиска (с необязательным фильтром по категории)
  const result = await searchProducts(query ?? "", category ?? undefined);

  // Возвращаем результат с соответствующим HTTP-статусом
  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  });
}
