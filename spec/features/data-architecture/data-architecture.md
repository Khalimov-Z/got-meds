# Архитектура Данных и БД (Фаза 0)

> **Статус:** Draft
> **Идентификатор:** FEAT-DATA-01
> **Название:** Схема Базы Данных (ER-модель)
> **Тип:** Техническая спецификация
> **Родитель:** [business-context.md](../../business-context.md)
> **Связанные:** Все остальные спецификации зависят от этого документа.
> **Технология БД:** Реляционная база данных (рекомендуется PostgreSQL).

---

## 1. Основные сущности (Таблицы)

### 1.1. Администраторы (Admins)
*Для доступа к Админ-панели платформы. Пользователи (клиенты) в Фазе 0 не имеют учетных записей.*
* `id`: UUID
* `email`: Строка (Уникальный)
* `password_hash`: Строка (Хэш пароля)
* `role`: Enum (`superadmin`, `content_manager`)
* `created_at`: Timestamp

### 1.2. Города (Cities)
*Базовая таблица для мультигородского масштабирования.*
* `id`: UUID
* `name`: Название города (например, "Гудермес")
* `center_coordinates`: Latitude, Longitude (центр города для карты по умолчанию)
* `is_active`: Boolean (открыт ли город для поиска)

### 1.3. Аптеки (Pharmacies)
* `id`: UUID
* `city_id`: Ссылка на таблицу Cities (FK)
* `name`: Название
* `address`: Строка
* `coordinates`: Latitude, Longitude (для расчета расстояний)
* `tier`: Enum (1 - Киоск, 2 - Крупная частная, 'Chain' - Сетевая)
* `status`: Enum (`active`, `paused`, `closed`) — позволяет скрыть аптеку (например, ремонт), не удаляя её историю.
* `phone`: Строка
* `whatsapp`: Строка
* `working_hours`: JSONB (график работы по дням недели с учетом перерывов. Например: `{"mon": "08:00-20:00", "tue":...}`)
* `is_24_7`: Boolean (флаг для ночного фильтра)

### 1.4. Справочник Товаров (Products)
*Эталонная база, спарсенная с Apteka.ru. Включает лекарства, медтехнику, БАДы.*
* `id`: UUID
* `name`: Полное правильное название
* `category`: Enum (`medicine`, `equipment`, `vitamins`, `mother_and_baby`)
* `active_ingredient`: Действующее вещество (только для категории medicine, Nullable)
* `form`: Форма выпуска (таблетки, сироп, ампулы — Nullable)
* `is_prescription`: Boolean (Nullable)
* `is_social_risk`: Boolean (флаг для "Черного списка". Если `true` — товар скрыт из поиска)
* `price_estimate`: Примерная цена (для определения "базовости" препарата)
* `image_url`: Ссылка на фото упаковки

### 1.5. Наличие (Inventory)
*Связующая таблица (Many-to-Many). Используется ТОЛЬКО для сетевых (Chain) и крупных частных (Tier 2) аптек.*
* `pharmacy_id`: Ссылка на аптеку (FK)
* `product_id`: Ссылка на товар (FK)
* `status`: Enum (`in_stock`, `likely_in_stock`) — для Tier 1 статус "неизвестно" генерируется на лету и в БД не хранится.
* `updated_at`: Дата и время последнего обновления
* `price`: Опционально (если сеть отдает точную цену)

### 1.6. Алиасы маппинга (Product_Aliases)
*Словарь синонимов и сокращений из 1С.*
* `original_string`: Исходное название из 1С частной аптеки (например, "Нуроф таб")
* `product_id`: Ссылка на эталонный товар (FK, Nullable)
* `is_ignored`: Boolean — если `true`, алгоритм игнорирует эту строку при маппинге (применяется для "мусорных" товаров вроде пакетов)

### 1.7. Жалобы пользователей (Pharmacy_Reports)
* `id`: UUID
* `pharmacy_id`: Ссылка на аптеку (FK)
* `report_type`: Enum (`wrong_number`, `closed`, `fake_stock`)
* `user_ip`: Строка (IP или Device ID для защиты от спама)
* `status`: Enum (`new`, `in_progress`, `resolved`) — статус рассмотрения модератором
* `created_at`: Timestamp

### 1.8. Логи поиска и дефицита (Search_Logs)
*Трекинг запросов для аналитики спроса и дефицита.*
* `id`: UUID
* `search_term`: Введенный пользователем текст
* `city_id`: Ссылка на город (FK)
* `user_latitude`: Float (Nullable, координаты пользователя для аналитики спроса по районам)
* `user_longitude`: Float (Nullable)
* `results_count`: Integer (количество найденных аптек, 0 = тотальный дефицит)
* `created_at`: Timestamp

### 1.9. Очередь нераспознанных товаров (Unmapped_Strings)
*Временная таблица для строк из CSV, которые алгоритм не смог привязать автоматически.*
* `id`: UUID
* `pharmacy_id`: Ссылка на аптеку, откуда пришел файл (FK)
* `raw_string`: Исходная нераспознанная строка (например, "Ну-фен детск")
* `created_at`: Timestamp

## 2. Связи (ER Model)
* Один `City` имеет много `Pharmacies` и много `Search_Logs`.
* Одна `Pharmacy` имеет много `Inventory`, много `Pharmacy_Reports` и много `Unmapped_Strings`.
* Один `Product` имеет много `Inventory` и много `Product_Aliases`.
