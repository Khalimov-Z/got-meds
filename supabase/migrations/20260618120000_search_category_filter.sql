-- ==============================================
-- GotMeds — Миграция: Фильтрация по категории в поиске
-- ==============================================
-- Добавляет необязательный параметр p_category в функцию gotmeds_search_products.
-- Если p_category передан — возвращает все товары указанной категории.
-- Если передан вместе с p_query — fuzzy search с фильтром по категории.
-- Обратная совместимость: без p_category поведение не меняется.
--
-- Источник: spec/features/client-app/client-app-spec.md (строка 58)
-- ==============================================

CREATE OR REPLACE FUNCTION public."gotmeds_search_products"(
    "p_query" TEXT,
    "p_similarity_threshold" DOUBLE PRECISION DEFAULT 0.15,
    "p_limit" INTEGER DEFAULT 20,
    "p_category" TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    normalized_query TEXT := BTRIM(COALESCE(p_query, ''));
    normalized_category TEXT := NULLIF(BTRIM(UPPER(COALESCE(p_category, ''))), '');
    best_name TEXT;
    best_is_social_risk BOOLEAN := false;
    items JSONB := '[]'::JSONB;
BEGIN
    -- Если нет ни запроса, ни категории — пустой результат
    IF normalized_query = '' AND normalized_category IS NULL THEN
        RETURN jsonb_build_object(
            'restricted', false,
            'restricted_product_name', NULL,
            'items', '[]'::JSONB
        );
    END IF;

    -- Режим «только категория» (без текстового запроса)
    IF normalized_query = '' AND normalized_category IS NOT NULL THEN
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', cat_result.id,
                    'name', cat_result.name,
                    'category', cat_result.category,
                    'is_prescription', cat_result.is_prescription,
                    'image_url', cat_result.image_url,
                    'price_estimate', cat_result.price_estimate,
                    'similarity_score', 1.0
                )
                ORDER BY cat_result.name ASC
            ),
            '[]'::JSONB
        )
        INTO items
        FROM (
            SELECT
                p.id,
                p.name,
                p.category::TEXT AS category,
                p.is_prescription,
                p.image_url,
                p.price_estimate
            FROM products p
            WHERE p.category::TEXT = normalized_category
                AND p.is_social_risk = false
            ORDER BY p.name ASC
            LIMIT GREATEST(COALESCE(p_limit, 20), 0)
        ) cat_result;

        RETURN jsonb_build_object(
            'restricted', false,
            'restricted_product_name', NULL,
            'items', items
        );
    END IF;

    -- Режим «fuzzy search» (с текстовым запросом, с возможным фильтром по категории)

    -- Шаг 1: Определяем лучший результат для проверки social risk
    WITH search_results AS (
        SELECT
            p.id,
            p.name,
            p.is_social_risk,
            SIMILARITY(LOWER(p.name), LOWER(normalized_query)) AS similarity_score
        FROM products p
        WHERE SIMILARITY(LOWER(p.name), LOWER(normalized_query)) > p_similarity_threshold
            AND (normalized_category IS NULL OR p.category::TEXT = normalized_category)

        UNION ALL

        SELECT
            p.id,
            p.name,
            p.is_social_risk,
            SIMILARITY(LOWER(pa.original_string), LOWER(normalized_query)) AS similarity_score
        FROM product_aliases pa
        INNER JOIN products p ON p.id = pa.product_id
        WHERE pa.is_ignored = false
            AND pa.product_id IS NOT NULL
            AND SIMILARITY(LOWER(pa.original_string), LOWER(normalized_query)) > p_similarity_threshold
            AND (normalized_category IS NULL OR p.category::TEXT = normalized_category)
    )
    SELECT
        grouped.name,
        grouped.is_social_risk
    INTO best_name, best_is_social_risk
    FROM (
        SELECT
            sr.id,
            sr.name,
            sr.is_social_risk,
            MAX(sr.similarity_score) AS similarity_score
        FROM search_results sr
        GROUP BY sr.id, sr.name, sr.is_social_risk
    ) grouped
    ORDER BY grouped.similarity_score DESC, grouped.is_social_risk DESC
    LIMIT 1;

    IF COALESCE(best_is_social_risk, false) THEN
        RETURN jsonb_build_object(
            'restricted', true,
            'restricted_product_name', best_name,
            'items', '[]'::JSONB
        );
    END IF;

    -- Шаг 2: Собираем финальную выдачу
    WITH search_results AS (
        SELECT
            p.id,
            p.name,
            p.category::TEXT AS category,
            p.is_prescription,
            p.image_url,
            p.price_estimate,
            p.is_social_risk,
            SIMILARITY(LOWER(p.name), LOWER(normalized_query)) AS similarity_score
        FROM products p
        WHERE SIMILARITY(LOWER(p.name), LOWER(normalized_query)) > p_similarity_threshold
            AND (normalized_category IS NULL OR p.category::TEXT = normalized_category)

        UNION ALL

        SELECT
            p.id,
            p.name,
            p.category::TEXT AS category,
            p.is_prescription,
            p.image_url,
            p.price_estimate,
            p.is_social_risk,
            SIMILARITY(LOWER(pa.original_string), LOWER(normalized_query)) AS similarity_score
        FROM product_aliases pa
        INNER JOIN products p ON p.id = pa.product_id
        WHERE pa.is_ignored = false
            AND pa.product_id IS NOT NULL
            AND SIMILARITY(LOWER(pa.original_string), LOWER(normalized_query)) > p_similarity_threshold
            AND (normalized_category IS NULL OR p.category::TEXT = normalized_category)
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', limited.id,
                'name', limited.name,
                'category', limited.category,
                'is_prescription', limited.is_prescription,
                'image_url', limited.image_url,
                'price_estimate', limited.price_estimate,
                'similarity_score', limited.similarity_score
            )
            ORDER BY limited.similarity_score DESC
        ),
        '[]'::JSONB
    )
    INTO items
    FROM (
        SELECT
            sr.id,
            sr.name,
            sr.category,
            sr.is_prescription,
            sr.image_url,
            sr.price_estimate,
            MAX(sr.similarity_score) AS similarity_score
        FROM search_results sr
        WHERE sr.is_social_risk = false
        GROUP BY sr.id, sr.name, sr.category, sr.is_prescription, sr.image_url, sr.price_estimate
        ORDER BY MAX(sr.similarity_score) DESC
        LIMIT GREATEST(COALESCE(p_limit, 20), 0)
    ) limited;

    RETURN jsonb_build_object(
        'restricted', false,
        'restricted_product_name', NULL,
        'items', items
    );
END;
$$;

-- Обновляем REVOKE/GRANT для новой сигнатуры (4 параметра)
REVOKE EXECUTE ON FUNCTION public."gotmeds_search_products"(TEXT, DOUBLE PRECISION, INTEGER, TEXT) FROM PUBLIC;

DO $$
DECLARE
    restricted_role TEXT;
BEGIN
    FOREACH restricted_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = restricted_role) THEN
            EXECUTE FORMAT(
                'REVOKE EXECUTE ON FUNCTION public."gotmeds_search_products"(TEXT, DOUBLE PRECISION, INTEGER, TEXT) FROM %I',
                restricted_role
            );
        END IF;
    END LOOP;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public."gotmeds_search_products"(TEXT, DOUBLE PRECISION, INTEGER, TEXT) TO service_role;
    END IF;
END;
$$;
