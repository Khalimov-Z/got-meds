-- ==============================================
-- GotMeds — Supabase миграция для расширения черного списка
-- ==============================================
-- Обновляет функцию gotmeds_get_product_details, чтобы она возвращала
-- заблокированные препараты (с флагом is_social_risk), позволяя бэкенду
-- обработать прямые ссылки и показать заглушку ограничения доступа.
-- ==============================================

DROP FUNCTION IF EXISTS public."gotmeds_get_product_details"(UUID);

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
    "image_url" TEXT,
    "is_social_risk" BOOLEAN
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
        p.image_url,
        p.is_social_risk
    FROM products p
    WHERE p.id = p_product_id
    LIMIT 1;
$$;

-- Права на выполнение
REVOKE EXECUTE ON FUNCTION public."gotmeds_get_product_details"(UUID) FROM PUBLIC;

DO $$
DECLARE
    restricted_role TEXT;
BEGIN
    FOREACH restricted_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = restricted_role) THEN
            EXECUTE FORMAT(
                'REVOKE EXECUTE ON FUNCTION public."gotmeds_get_product_details"(UUID) FROM %I',
                restricted_role
            );
        END IF;
    END LOOP;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public."gotmeds_get_product_details"(UUID) TO service_role;
    END IF;
END;
$$;
