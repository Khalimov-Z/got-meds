# Спецификация SEO‑страницы продукта

> **Статус:** Draft
> **Идентификатор:** TECH-SEO-01
> **Название:** SEO-страница карточки продукта
> **Тип:** Архитектурный документ
> **Родитель:** [security-performance.md](./security-performance.md)
> **Связанные:** [Клиентское приложение](../features/client-app/client-app-spec.md), [Архитектура Данных](../features/data-architecture/data-architecture.md), [API аналогов](./analogs-api-spec.md)

---

## Назначение
Определяет роут `/product/[id]` для отображения полной карточки продукта с динамическими мета‑тегами (SEO) и дополнительными данными.

## Маршрут
- **Path:** `/product/[id]`
- **Метод:** GET (Server Component с SSR)

## Данные, передаваемые при SSR (JSON)
```typescript
{
  id: string;
  name: string;
  category: 'medicine' | 'equipment' | 'vitamins' | 'mother_and_baby';
  dosage?: string;
  form?: string;
  active_ingredient?: string;
  image_url: string;
  price_estimate?: number; // примерная цена в руб.
  is_prescription: boolean;
  description: string;
}
```

## Динамические мета‑теги
- **title:** `Купить <name> в Гудермесе — наличие в аптеках, цены | где.таблетка`
- **description:** `Поиск препарата <name> в аптеках Гудермеса. Адреса дежурных аптек, цены и наличие на карте города.`
- **openGraph:** `og:title`, `og:description`, `og:image`, `og:url` – берутся из данных выше.

## Поведение
- При запросе генерируются мета‑теги на сервере, что обеспечивает SEO‑индексацию.
- Если продукт не найден → 404‑страница с рекомендациями.

## Связанные UI‑компоненты
- Компонент `ProductPage` (использует данные из Server Action `getProductDetails`).
- Кнопка «Показать аналоги» → использует `getAnalogs`.

## Примечания
- Требуется наличие полей `price_estimate` и `description` в таблице `Products`.
- SEO‑теги должны быть проверены через Lighthouse (Performance ≥ 90, SEO ≥ 95).
