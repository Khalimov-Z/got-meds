# Локальные проверки качества

Этот каталог хранит проверки из плана `plans/completed/phase-10-testing-quality.md`.

## Unit-тесты

```bash
npm run test:unit
```

Unit-тесты используют mock Supabase server client и не требуют реальной базы.

## Cypress E2E

Перед запуском нужна тестовая Supabase база с миграциями и `supabase/seed.sql`.

Для админского сценария задайте локальные переменные:

```bash
export GOTMEDS_E2E_ADMIN_EMAIL="admin@example.local"
export GOTMEDS_E2E_ADMIN_PASSWORD="test-password"
```

Тестовый пользователь должен существовать в Supabase Auth, а его `auth.users.id` должен быть связан с доменным администратором в таблице `admins.auth_user_id`.

Запуск:

```bash
npm run dev
npm run test:e2e
```

## Lighthouse

Lighthouse проверяет главную страницу и SEO-страницу товара из seed:

```bash
npm run build
npm run start
npm run test:lighthouse
```

По умолчанию проверяется `/product/20000000-0000-4000-8000-000000000001`. Для другого товара задайте `LHCI_PRODUCT_ID`.

Пороги:

- Performance >= 90
- SEO >= 95
- Accessibility >= 90

Отчеты сохраняются локально в `.lighthouseci/` и не публикуются наружу.
