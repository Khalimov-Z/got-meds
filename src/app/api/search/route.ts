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

/**
 * GET /api/search?q=<запрос>
 *
 * Тестовый эндпоинт для проверки поисковой функции.
 * Вызывает Server Action searchProducts и возвращает JSON-результат.
 */
export async function GET(request: NextRequest) {
  // Извлекаем query-параметр `q` из URL
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  // Валидация: параметр `q` обязателен
  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Параметр 'q' обязателен. Пример: /api/search?q=нурофен",
      },
      { status: 400 }
    );
  }

  // Вызов серверного действия поиска
  const result = await searchProducts(query);

  // Возвращаем результат с соответствующим HTTP-статусом
  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  });
}
