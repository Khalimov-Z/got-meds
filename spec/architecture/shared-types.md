# Shared типы для проекта

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
