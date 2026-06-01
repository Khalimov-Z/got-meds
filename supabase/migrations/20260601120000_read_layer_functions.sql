-- ==============================================
-- GotMeds — Supabase read layer RPC
-- ==============================================
-- Источник: spec/technical/supabase-platform-migration.md, раздел 6.3
-- Этап: Supabase read layer
-- Эта миграция добавляет только функции чтения и не меняет доменную схему.
-- ==============================================

CREATE OR REPLACE FUNCTION public."gotmeds_search_products"(
    "p_query" TEXT,
    "p_similarity_threshold" DOUBLE PRECISION DEFAULT 0.15,
    "p_limit" INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    normalized_query TEXT := BTRIM(COALESCE(p_query, ''));
    best_name TEXT;
    best_is_social_risk BOOLEAN := false;
    items JSONB := '[]'::JSONB;
BEGIN
    IF normalized_query = '' THEN
        RETURN jsonb_build_object(
            'restricted', false,
            'restricted_product_name', NULL,
            'items', '[]'::JSONB
        );
    END IF;

    WITH search_results AS (
        SELECT
            p.id,
            p.name,
            p.is_social_risk,
            SIMILARITY(LOWER(p.name), LOWER(normalized_query)) AS similarity_score
        FROM products p
        WHERE SIMILARITY(LOWER(p.name), LOWER(normalized_query)) > p_similarity_threshold

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

CREATE OR REPLACE FUNCTION public."gotmeds_get_product_details"("p_product_id" UUID)
RETURNS TABLE(
    "id" UUID,
    "name" TEXT,
    "category" TEXT,
    "active_ingredient" TEXT,
    "form" TEXT,
    "dosage" TEXT,
    "is_prescription" BOOLEAN,
    "price_estimate" DOUBLE PRECISION,
    "description" TEXT,
    "image_url" TEXT
)
LANGUAGE SQL
STABLE
AS $$
    SELECT
        p.id,
        p.name,
        p.category::TEXT AS category,
        p.active_ingredient,
        p.form,
        p.dosage,
        p.is_prescription,
        p.price_estimate,
        p.description,
        p.image_url
    FROM products p
    WHERE p.id = p_product_id
        AND p.is_social_risk = false
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_get_product_analogs"("p_product_id" UUID)
RETURNS TABLE(
    "id" UUID,
    "name" TEXT,
    "category" TEXT,
    "active_ingredient" TEXT,
    "form" TEXT,
    "dosage" TEXT,
    "image_url" TEXT
)
LANGUAGE SQL
STABLE
AS $$
    WITH source_product AS (
        SELECT
            p.id,
            p.category,
            NULLIF(BTRIM(p.active_ingredient), '') AS active_ingredient,
            p.form,
            p.dosage
        FROM products p
        WHERE p.id = p_product_id
            AND p.is_social_risk = false
        LIMIT 1
    )
    SELECT
        candidate.id,
        candidate.name,
        candidate.category::TEXT AS category,
        candidate.active_ingredient,
        candidate.form,
        candidate.dosage,
        candidate.image_url
    FROM source_product source
    INNER JOIN products candidate
        ON candidate.id <> source.id
        AND candidate.is_social_risk = false
        AND candidate.category = source.category
        AND LOWER(BTRIM(candidate.active_ingredient)) = LOWER(source.active_ingredient)
        AND (
            (source.form IS NULL AND candidate.form IS NULL)
            OR (
                source.form IS NOT NULL
                AND candidate.form IS NOT NULL
                AND LOWER(candidate.form) = LOWER(source.form)
            )
        )
    WHERE source.active_ingredient IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM inventory i
            INNER JOIN pharmacies ph ON ph.id = i.pharmacy_id
            INNER JOIN cities c ON c.id = ph.city_id
            WHERE i.product_id = candidate.id
                AND i.status IN ('IN_STOCK'::"InventoryStatus", 'LIKELY_IN_STOCK'::"InventoryStatus")
                AND ph.status = 'ACTIVE'::"PharmacyStatus"
                AND ph.tier IN ('TIER_2'::"PharmacyTier", 'TIER_3'::"PharmacyTier")
                AND c.is_active = true
        )
    ORDER BY
        CASE
            WHEN source.dosage IS NOT NULL AND candidate.dosage = source.dosage THEN 0
            ELSE 1
        END,
        candidate.name ASC;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_is_time_inside_range"(
    "p_now_minutes" INTEGER,
    "p_range_text" TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    parts TEXT[];
    start_match TEXT[];
    end_match TEXT[];
    start_hours INTEGER;
    start_minutes INTEGER;
    end_hours INTEGER;
    end_minutes INTEGER;
    start_total INTEGER;
    end_total INTEGER;
BEGIN
    parts := regexp_split_to_array(BTRIM(COALESCE(p_range_text, '')), '\s*-\s*');

    IF array_length(parts, 1) <> 2 THEN
        RETURN false;
    END IF;

    start_match := regexp_match(BTRIM(parts[1]), '^(\d{1,2}):(\d{2})$');
    end_match := regexp_match(BTRIM(parts[2]), '^(\d{1,2}):(\d{2})$');

    IF start_match IS NULL OR end_match IS NULL THEN
        RETURN false;
    END IF;

    start_hours := start_match[1]::INTEGER;
    start_minutes := start_match[2]::INTEGER;
    end_hours := end_match[1]::INTEGER;
    end_minutes := end_match[2]::INTEGER;

    IF start_hours > 24
        OR end_hours > 24
        OR start_minutes > 59
        OR end_minutes > 59
        OR (start_hours = 24 AND start_minutes <> 0)
        OR (end_hours = 24 AND end_minutes <> 0)
    THEN
        RETURN false;
    END IF;

    start_total := (start_hours % 24) * 60 + start_minutes;
    end_total := (end_hours % 24) * 60 + end_minutes;

    IF start_total <= end_total THEN
        RETURN p_now_minutes >= start_total AND p_now_minutes <= end_total;
    END IF;

    RETURN p_now_minutes >= start_total OR p_now_minutes <= end_total;
END;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_is_pharmacy_open_now"(
    "p_working_hours" JSONB,
    "p_is_24_7" BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    gudermes_time TIMESTAMP := NOW() AT TIME ZONE 'Europe/Moscow';
    day_key TEXT;
    now_minutes INTEGER;
    day_schedule TEXT;
    range_text TEXT;
BEGIN
    IF COALESCE(p_is_24_7, false) THEN
        RETURN true;
    END IF;

    IF p_working_hours IS NULL OR jsonb_typeof(p_working_hours) <> 'object' THEN
        RETURN false;
    END IF;

    day_key := CASE EXTRACT(DOW FROM gudermes_time)::INTEGER
        WHEN 0 THEN 'sun'
        WHEN 1 THEN 'mon'
        WHEN 2 THEN 'tue'
        WHEN 3 THEN 'wed'
        WHEN 4 THEN 'thu'
        WHEN 5 THEN 'fri'
        ELSE 'sat'
    END;
    now_minutes := EXTRACT(HOUR FROM gudermes_time)::INTEGER * 60
        + EXTRACT(MINUTE FROM gudermes_time)::INTEGER;
    day_schedule := p_working_hours ->> day_key;

    IF day_schedule IS NULL
        OR BTRIM(day_schedule) = ''
        OR POSITION('выход' IN LOWER(day_schedule)) > 0
    THEN
        RETURN false;
    END IF;

    FOREACH range_text IN ARRAY regexp_split_to_array(day_schedule, '[;,]')
    LOOP
        IF public."gotmeds_is_time_inside_range"(now_minutes, range_text) THEN
            RETURN true;
        END IF;
    END LOOP;

    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_get_pharmacies_by_product"(
    "p_product_id" UUID,
    "p_lat" DOUBLE PRECISION DEFAULT NULL,
    "p_lng" DOUBLE PRECISION DEFAULT NULL,
    "p_is_open_now" BOOLEAN DEFAULT true
)
RETURNS TABLE(
    "pharmacy_id" UUID,
    "name" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "tier" TEXT,
    "distance_meters" INTEGER,
    "status" TEXT,
    "working_hours" JSONB,
    "is_24_7" BOOLEAN,
    "is_open_now" BOOLEAN,
    "phone" TEXT,
    "whatsapp" TEXT
)
LANGUAGE SQL
STABLE
AS $$
    WITH source_product AS (
        SELECT
            p.id,
            (
                p.is_prescription IS NOT true
                AND p.price_estimate IS NOT NULL
                AND p.price_estimate <= 1000
            ) AS include_tier_one
        FROM products p
        WHERE p.id = p_product_id
            AND p.is_social_risk = false
        LIMIT 1
    ),
    candidate_pharmacies AS (
        SELECT
            ph.id,
            ph.name,
            ph.address,
            ph.latitude,
            ph.longitude,
            ph.tier,
            ph.phone,
            ph.whatsapp,
            ph.working_hours,
            ph.is_24_7,
            inv.status AS inventory_status,
            public."gotmeds_is_pharmacy_open_now"(ph.working_hours, ph.is_24_7) AS computed_is_open_now,
            CASE
                WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
                    ROUND(
                        6371000 * 2 * atan2(
                            SQRT(LEAST(1, GREATEST(0, distance_source.haversine_a))),
                            SQRT(1 - LEAST(1, GREATEST(0, distance_source.haversine_a)))
                        )
                    )::INTEGER
                ELSE NULL
            END AS computed_distance_meters
        FROM source_product source
        INNER JOIN pharmacies ph ON ph.status = 'ACTIVE'::"PharmacyStatus"
        INNER JOIN cities c ON c.id = ph.city_id AND c.is_active = true
        LEFT JOIN LATERAL (
            SELECT i.status
            FROM inventory i
            WHERE i.pharmacy_id = ph.id
                AND i.product_id = source.id
                AND i.status IN ('IN_STOCK'::"InventoryStatus", 'LIKELY_IN_STOCK'::"InventoryStatus")
            ORDER BY
                CASE
                    WHEN i.status = 'IN_STOCK'::"InventoryStatus" THEN 0
                    ELSE 1
                END
            LIMIT 1
        ) inv ON true
        CROSS JOIN LATERAL (
            SELECT
                POWER(SIN(RADIANS(ph.latitude - p_lat) / 2), 2)
                + COS(RADIANS(p_lat))
                * COS(RADIANS(ph.latitude))
                * POWER(SIN(RADIANS(ph.longitude - p_lng) / 2), 2)
                AS haversine_a
        ) distance_source
        WHERE (
            source.include_tier_one = true
            AND ph.tier = 'TIER_1'::"PharmacyTier"
        ) OR (
            ph.tier IN ('TIER_2'::"PharmacyTier", 'TIER_3'::"PharmacyTier")
            AND inv.status IS NOT NULL
        )
    )
    SELECT
        candidate.id AS pharmacy_id,
        candidate.name,
        candidate.address,
        candidate.latitude,
        candidate.longitude,
        CASE
            WHEN candidate.tier = 'TIER_1'::"PharmacyTier" THEN '1'
            WHEN candidate.tier = 'TIER_2'::"PharmacyTier" THEN '2'
            ELSE 'Chain'
        END AS tier,
        candidate.computed_distance_meters AS distance_meters,
        CASE
            WHEN candidate.tier = 'TIER_1'::"PharmacyTier" THEN 'unknown'
            WHEN candidate.inventory_status = 'IN_STOCK'::"InventoryStatus" THEN 'in_stock'
            WHEN candidate.inventory_status = 'LIKELY_IN_STOCK'::"InventoryStatus" THEN 'likely_in_stock'
            ELSE 'unknown'
        END AS status,
        candidate.working_hours,
        candidate.is_24_7,
        candidate.computed_is_open_now AS is_open_now,
        candidate.phone,
        candidate.whatsapp
    FROM candidate_pharmacies candidate
    WHERE p_is_open_now IS NOT true OR candidate.computed_is_open_now = true
    ORDER BY
        CASE
            WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN candidate.computed_distance_meters
            ELSE NULL
        END ASC NULLS LAST,
        CASE
            WHEN p_lat IS NULL OR p_lng IS NULL THEN
                CASE
                    WHEN candidate.tier = 'TIER_3'::"PharmacyTier" THEN 0
                    WHEN candidate.tier = 'TIER_2'::"PharmacyTier" THEN 1
                    ELSE 2
                END
            ELSE 0
        END ASC,
        candidate.name ASC;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_get_sitemap_product_ids"()
RETURNS TABLE("id" UUID)
LANGUAGE SQL
STABLE
AS $$
    SELECT p.id
    FROM products p
    WHERE p.is_social_risk = false
    ORDER BY p.name ASC;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_get_demand_dashboard"(
    "p_city_id" UUID DEFAULT NULL,
    "p_days" INTEGER DEFAULT 7,
    "p_similarity_threshold" DOUBLE PRECISION DEFAULT 0.62,
    "p_limit" INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    period_end TIMESTAMP := NOW();
    period_start TIMESTAMP := NOW() - make_interval(days => GREATEST(COALESCE(p_days, 7), 0));
    cities_json JSONB := '[]'::JSONB;
    selected_city_id UUID;
    total_logs_count INTEGER := 0;
    rows_json JSONB := '[]'::JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object('id', active_cities.id, 'name', active_cities.name)
            ORDER BY active_cities.name ASC
        ),
        '[]'::JSONB
    )
    INTO cities_json
    FROM (
        SELECT c.id, c.name
        FROM cities c
        WHERE c.is_active = true
        ORDER BY c.name ASC
    ) active_cities;

    SELECT c.id
    INTO selected_city_id
    FROM cities c
    WHERE c.is_active = true
        AND p_city_id IS NOT NULL
        AND c.id = p_city_id
    ORDER BY c.name ASC
    LIMIT 1;

    IF selected_city_id IS NULL THEN
        SELECT c.id
        INTO selected_city_id
        FROM cities c
        WHERE c.is_active = true
        ORDER BY c.name ASC
        LIMIT 1;
    END IF;

    IF selected_city_id IS NULL THEN
        RETURN jsonb_build_object(
            'cities', cities_json,
            'selected_city_id', NULL,
            'period_start', period_start,
            'period_end', period_end,
            'total_logs_count', 0,
            'rows', '[]'::JSONB
        );
    END IF;

    SELECT COUNT(*)::INTEGER
    INTO total_logs_count
    FROM search_logs sl
    WHERE sl.city_id = selected_city_id
        AND sl.results_count = 0
        AND sl.created_at >= period_start;

    WITH term_stats AS (
        SELECT
            sl.city_id,
            LOWER(BTRIM(sl.search_term)) AS normalized_term,
            MIN(sl.search_term) AS display_term,
            COUNT(*)::INTEGER AS searches_count,
            MAX(sl.created_at) AS last_searched_at
        FROM search_logs sl
        WHERE sl.city_id = selected_city_id
            AND sl.results_count = 0
            AND sl.created_at >= period_start
        GROUP BY sl.city_id, LOWER(BTRIM(sl.search_term))
    ),
    bucketed_terms AS (
        SELECT
            term_stats.*,
            bucket.normalized_term AS bucket_term
        FROM term_stats
        CROSS JOIN LATERAL (
            SELECT candidate.normalized_term
            FROM term_stats candidate
            WHERE candidate.city_id = term_stats.city_id
                AND SIMILARITY(candidate.normalized_term, term_stats.normalized_term)
                    >= COALESCE(p_similarity_threshold, 0.62)
            ORDER BY
                candidate.searches_count DESC,
                candidate.last_searched_at DESC,
                candidate.normalized_term ASC
            LIMIT 1
        ) bucket
    ),
    grouped_terms AS (
        SELECT
            bt.city_id,
            bt.bucket_term,
            SUM(bt.searches_count)::INTEGER AS searches_count,
            MAX(bt.last_searched_at) AS last_searched_at,
            (ARRAY_AGG(bt.display_term ORDER BY bt.searches_count DESC, bt.last_searched_at DESC))[1] AS display_term,
            ARRAY_AGG(bt.display_term ORDER BY bt.searches_count DESC, bt.last_searched_at DESC) AS variants
        FROM bucketed_terms bt
        GROUP BY bt.city_id, bt.bucket_term
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'search_term', report_rows.search_term,
                'city_name', report_rows.city_name,
                'searches_count', report_rows.searches_count,
                'last_searched_at', report_rows.last_searched_at,
                'variants', to_jsonb(report_rows.variants)
            )
            ORDER BY report_rows.searches_count DESC, report_rows.last_searched_at DESC
        ),
        '[]'::JSONB
    )
    INTO rows_json
    FROM (
        SELECT
            gt.display_term AS search_term,
            c.name AS city_name,
            gt.searches_count,
            gt.last_searched_at,
            gt.variants
        FROM grouped_terms gt
        INNER JOIN cities c ON c.id = gt.city_id
        ORDER BY gt.searches_count DESC, gt.last_searched_at DESC
        LIMIT GREATEST(COALESCE(p_limit, 50), 0)
    ) report_rows;

    RETURN jsonb_build_object(
        'cities', cities_json,
        'selected_city_id', selected_city_id,
        'period_start', period_start,
        'period_end', period_end,
        'total_logs_count', total_logs_count,
        'rows', rows_json
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public."gotmeds_search_products"(TEXT, DOUBLE PRECISION, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_get_product_details"(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_get_product_analogs"(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_is_time_inside_range"(INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_is_pharmacy_open_now"(JSONB, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_get_pharmacies_by_product"(UUID, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_get_sitemap_product_ids"() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_get_demand_dashboard"(UUID, INTEGER, DOUBLE PRECISION, INTEGER) FROM PUBLIC;

DO $$
DECLARE
    restricted_role TEXT;
BEGIN
    -- В Supabase роли anon/authenticated могут иметь явные права поверх PUBLIC.
    FOREACH restricted_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = restricted_role) THEN
            EXECUTE FORMAT(
                'REVOKE EXECUTE ON FUNCTION public."gotmeds_search_products"(TEXT, DOUBLE PRECISION, INTEGER) FROM %I',
                restricted_role
            );
            EXECUTE FORMAT(
                'REVOKE EXECUTE ON FUNCTION public."gotmeds_get_product_details"(UUID) FROM %I',
                restricted_role
            );
            EXECUTE FORMAT(
                'REVOKE EXECUTE ON FUNCTION public."gotmeds_get_product_analogs"(UUID) FROM %I',
                restricted_role
            );
            EXECUTE FORMAT(
                'REVOKE EXECUTE ON FUNCTION public."gotmeds_is_time_inside_range"(INTEGER, TEXT) FROM %I',
                restricted_role
            );
            EXECUTE FORMAT(
                'REVOKE EXECUTE ON FUNCTION public."gotmeds_is_pharmacy_open_now"(JSONB, BOOLEAN) FROM %I',
                restricted_role
            );
            EXECUTE FORMAT(
                'REVOKE EXECUTE ON FUNCTION public."gotmeds_get_pharmacies_by_product"(UUID, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN) FROM %I',
                restricted_role
            );
            EXECUTE FORMAT(
                'REVOKE EXECUTE ON FUNCTION public."gotmeds_get_sitemap_product_ids"() FROM %I',
                restricted_role
            );
            EXECUTE FORMAT(
                'REVOKE EXECUTE ON FUNCTION public."gotmeds_get_demand_dashboard"(UUID, INTEGER, DOUBLE PRECISION, INTEGER) FROM %I',
                restricted_role
            );
        END IF;
    END LOOP;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public."gotmeds_search_products"(TEXT, DOUBLE PRECISION, INTEGER) TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_get_product_details"(UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_get_product_analogs"(UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_is_time_inside_range"(INTEGER, TEXT) TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_is_pharmacy_open_now"(JSONB, BOOLEAN) TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_get_pharmacies_by_product"(UUID, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN) TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_get_sitemap_product_ids"() TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_get_demand_dashboard"(UUID, INTEGER, DOUBLE PRECISION, INTEGER) TO service_role;
    END IF;
END;
$$;
