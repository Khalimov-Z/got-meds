# Спецификация API и Взаимодействия (Next.js)

> **Статус:** Draft
> **Идентификатор:** TECH-API-01
> **Название:** Контракты Данных и Серверные Действия
> **Тип:** Архитектурный документ
> **Родитель:** [tech-stack.md](./tech-stack.md)

---

## 1. Парадигма обмена данными

Так как мы используем Next.js (App Router), взаимодействие между Клиентом и Сервером (БД) строится по гибридной модели:

1. **Server Components (SSR/RSC):** Первичная загрузка страниц и базовый поиск выполняются прямо на сервере. Это гарантирует нулевую задержку отправки данных и идеальное SEO.
2. **Server Actions:** Мутации данных (сохранение жалоб, добавление аптек, логин админа) выполняются через асинхронные серверные функции (Server Actions), без написания традиционных REST API роутов.
3. **Route Handlers (`/api/*`):** Оставляем только для внешних вебхуков, парсеров и отдачи динамического списка аптек для карты (когда пользователь двигает карту).

---

## 2. Основные контракты (Server Actions & API)

### 2.1. Поиск препаратов (Fuzzy Search)
* **Функция:** `searchProducts(query: string)`
* **Входные данные:** строка запроса (например, "асперен").
* **Логика БД:** Использование `pg_trgm` (SIMILARITY) для поиска совпадений по `Products.name` и `Product_Aliases.original_string`.
* **Выходные данные (JSON):**
  ```typescript
  Array<{
    id: string;
    name: string;
    category: 'medicine' | 'equipment' | 'vitamins' | 'mother_and_baby';
    is_prescription: boolean;
    image_url: string;
    price_estimate?: number;     // Примерная цена (для Смарт-фильтра Tier 1)
    similarity_score: number;    // От 0 до 1
    restricted?: boolean;        // true = препарат заблокирован (соцриск)
  }>
  ```

### 2.2. Запрос аптек для карты (По координатам)
* **Эндпоинт / Функция:** `getPharmaciesByProduct(productId: string, lat?: number, lng?: number, isOpenNow: boolean)`
* **Логика БД:** 
  * Если `isOpenNow == true`, отсеивать закрытые аптеки (парсинг `working_hours`).
  * Применение смарт-фильтра Tier 1: если продукт дорогой или по рецепту, Tier 1 исключаются из ответа.
* **Выходные данные (JSON):**
  ```typescript
  Array<{
    pharmacy_id: string;
    name: string;
    address: string;                          // Адрес аптеки (business-context 3.3)
    coordinates: { lat: number, lng: number };
    tier: '1' | '2' | 'Chain';
    distance_meters: number;                  // Рассчитывается на уровне SQL (PostGIS или Haversine)
    status: 'in_stock' | 'likely_in_stock' | 'unknown';
    working_hours: any;
    is_24_7: boolean;                         // Флаг круглосуточности
    phone: string;
    whatsapp: string;
  }>
  ```

### 2.3. Запись аналитики (Неудовлетворенный спрос)
* **Функция (Server Action):** `logZeroResultSearch(searchTerm: string, cityId: string, lat?: number, lng?: number)`
* **Описание:** Запускается асинхронно в фоне, когда поиск ничего не нашел. Записывает данные в таблицу `Search_Logs` для B2B дашборда админов.

### 2.4. Отправка жалобы (От пользователя)
* **Функция (Server Action):** `submitPharmacyReport(pharmacyId: string, type: 'wrong_number'|'closed'|'fake_stock')`
* **Валидация:** Функция проверяет IP пользователя или Client ID через Redis/БД, чтобы не позволить отправить больше 1 жалобы на 1 аптеку в день.

---

## 3. Админ-панель (Защищенные действия)

* **Маппинг CSV:** `uploadPharmacyPrice(pharmacyId: string, fileData: Blob)`
  * Сбрасывает старые остатки в `Inventory`.
  * Возвращает список распознанных товаров и список `Unmapped_Strings`.
* **Привязка Алиаса:** `createAlias(unmappedStringId: string, productId: string)`
  * Переносит нераспознанную строку в таблицу `Product_Aliases`.
* **Игнорирование мусора:** `ignoreAlias(unmappedStringId: string)`
  * Создает запись в `Product_Aliases` с флагом `is_ignored = true`.

---

## 4. Обработка ошибок (Error Handling)
Все Server Actions должны возвращать стандартизированный ответ:
```typescript
{
  success: boolean;
  data?: any;
  error?: string; // Человекочитаемое сообщение (например, "Аптека не найдена")
}
```
