# Общие типы данных проекта (Shared Types)

> **Статус:** Draft
> **Идентификатор:** TECH-TYPES-01
> **Название:** Единые TypeScript-типы
> **Тип:** Архитектурный документ
> **Родитель:** [tech-stack.md](./tech-stack.md)
> **Связанные:** [API-спецификация](./api-spec.md), [API аналогов](./analogs-api-spec.md), [Архитектура Данных](../features/data-architecture/data-architecture.md)

---

## ProductCategory
```typescript
export type ProductCategory = 'medicine' | 'equipment' | 'vitamins' | 'mother_and_baby';
```

## Product (сокращённый тип, используемый в API)
```typescript
export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  is_prescription: boolean;
  image_url: string;
  similarity_score: number;
  /** Включено в `searchProducts` и `getAnalogs` */
  price_estimate?: number;
  /** Признак ограничения (соцриск/чёрный список) */
  restricted?: boolean;
}
```
