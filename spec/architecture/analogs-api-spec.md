# Спецификация API: Получение аналогов препарата

## Идентификатор
- **TECH-API-02**
- **Статус:** Draft

## Назначение
Определяет Server Action `getAnalogs(productId: string)` для получения списка аналогов выбранного препарата.

## Входные параметры
- `productId` – `string`, уникальный идентификатор продукта в таблице `Products`.

## Выходные данные (JSON)
```typescript
Array<{
  id: string;
  name: string;
  category: 'medicine' | 'equipment' | 'vitamins' | 'mother_and_baby';
  active_ingredient?: string; // При наличии
  form?: string;               // Таблетка, сироп и т.п.
  dosage?: string;            // Доза, например "200 мг"
  image_url: string;
}>;
```

## Поведение
- Ищет препараты с тем же активным веществом (`active_ingredient`).
- Исключает препараты, помеченные как `restricted` (см. `checkRestricted`).
- Сортирует результаты по релевантности (по совпадению дозировки и форме).

## Ошибки
- `404 Not Found` – если `productId` не найден.
- `500 Internal Server Error` – при сбое DB.

## Примечания
- Данный контракт используется в UI‑компоненте «Показать аналоги» (US‑1.3).
- Требуется наличие поля `active_ingredient` в схеме `Products`.
