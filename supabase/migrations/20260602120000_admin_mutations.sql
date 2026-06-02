-- ==============================================
-- GotMeds — Supabase admin mutations
-- ==============================================
-- Источник: spec/technical/supabase-platform-migration.md, раздел 6.5
-- Этап: Supabase admin mutations
-- Эта миграция добавляет RPC для атомарных админских операций
-- без удаления Prisma rollback-слоя.
-- ==============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public."cities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."admins" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."pharmacies" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."products" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."product_aliases" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."unmapped_strings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE public."search_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION public."gotmeds_assert_admin"()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF COALESCE(public."gotmeds_is_admin"(), false) IS NOT true THEN
        RAISE EXCEPTION 'Требуется роль администратора'
            USING ERRCODE = '42501';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_admin_full_sync_inventory"(
    "p_pharmacy_id" UUID,
    "p_inventory_items" JSONB DEFAULT '[]'::JSONB,
    "p_unmapped_strings" JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inserted_inventory_count INTEGER := 0;
    inserted_unmapped_count INTEGER := 0;
BEGIN
    PERFORM public."gotmeds_assert_admin"();

    IF NOT EXISTS (
        SELECT 1
        FROM public."pharmacies" AS pharmacies
        WHERE pharmacies."id" = p_pharmacy_id
            AND pharmacies."tier" = 'TIER_2'::public."PharmacyTier"
            AND pharmacies."status" = 'ACTIVE'::public."PharmacyStatus"
    ) THEN
        RAISE EXCEPTION 'Аптека не найдена'
            USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public."inventory"
    WHERE "pharmacy_id" = p_pharmacy_id;

    DELETE FROM public."unmapped_strings"
    WHERE "pharmacy_id" = p_pharmacy_id;

    WITH raw_items AS (
        SELECT
            NULLIF(item.value->>'product_id', '')::UUID AS product_id,
            NULLIF(item.value->>'price', '')::DOUBLE PRECISION AS price
        FROM jsonb_array_elements(COALESCE(p_inventory_items, '[]'::JSONB)) AS item(value)
        WHERE item.value ? 'product_id'
    ),
    valid_items AS (
        SELECT DISTINCT ON (raw_items.product_id)
            raw_items.product_id,
            raw_items.price
        FROM raw_items
        INNER JOIN public."products" AS products
            ON products."id" = raw_items.product_id
            AND products."is_social_risk" = false
        WHERE raw_items.product_id IS NOT NULL
        ORDER BY raw_items.product_id
    )
    INSERT INTO public."inventory" (
        "pharmacy_id",
        "product_id",
        "status",
        "updated_at",
        "price"
    )
    SELECT
        p_pharmacy_id,
        valid_items.product_id,
        'LIKELY_IN_STOCK'::public."InventoryStatus",
        CURRENT_TIMESTAMP,
        valid_items.price
    FROM valid_items
    ON CONFLICT ("pharmacy_id", "product_id")
    DO UPDATE SET
        "status" = EXCLUDED."status",
        "updated_at" = CURRENT_TIMESTAMP,
        "price" = EXCLUDED."price";

    GET DIAGNOSTICS inserted_inventory_count = ROW_COUNT;

    WITH raw_strings AS (
        SELECT DISTINCT BTRIM(source.value) AS raw_string
        FROM jsonb_array_elements_text(COALESCE(p_unmapped_strings, '[]'::JSONB)) AS source(value)
        WHERE BTRIM(source.value) <> ''
    )
    INSERT INTO public."unmapped_strings" (
        "pharmacy_id",
        "raw_string",
        "created_at"
    )
    SELECT
        p_pharmacy_id,
        raw_strings.raw_string,
        CURRENT_TIMESTAMP
    FROM raw_strings;

    GET DIAGNOSTICS inserted_unmapped_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'inventory_rows', inserted_inventory_count,
        'unmapped_rows', inserted_unmapped_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_admin_create_alias"(
    "p_unmapped_string_id" UUID,
    "p_product_id" UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    source_raw_string TEXT;
    target_product_id UUID;
    existing_alias_id UUID;
BEGIN
    PERFORM public."gotmeds_assert_admin"();

    SELECT unmapped_strings."raw_string"
    INTO source_raw_string
    FROM public."unmapped_strings" AS unmapped_strings
    WHERE unmapped_strings."id" = p_unmapped_string_id
    LIMIT 1;

    IF source_raw_string IS NULL THEN
        RAISE EXCEPTION 'Строка маппинга не найдена'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT products."id"
    INTO target_product_id
    FROM public."products" AS products
    WHERE products."id" = p_product_id
        AND products."is_social_risk" = false
    LIMIT 1;

    IF target_product_id IS NULL THEN
        RAISE EXCEPTION 'Препарат не найден'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT product_aliases."id"
    INTO existing_alias_id
    FROM public."product_aliases" AS product_aliases
    WHERE product_aliases."original_string" = source_raw_string
    ORDER BY product_aliases."id"
    LIMIT 1;

    IF existing_alias_id IS NULL THEN
        INSERT INTO public."product_aliases" (
            "id",
            "original_string",
            "product_id",
            "is_ignored"
        )
        VALUES (
            gen_random_uuid(),
            source_raw_string,
            target_product_id,
            false
        );
    ELSE
        UPDATE public."product_aliases"
        SET
            "product_id" = target_product_id,
            "is_ignored" = false
        WHERE "id" = existing_alias_id;
    END IF;

    DELETE FROM public."unmapped_strings"
    WHERE "id" = p_unmapped_string_id;

    RETURN jsonb_build_object('mapped', true);
END;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_admin_ignore_alias"(
    "p_unmapped_string_id" UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    source_raw_string TEXT;
    existing_alias_id UUID;
BEGIN
    PERFORM public."gotmeds_assert_admin"();

    SELECT unmapped_strings."raw_string"
    INTO source_raw_string
    FROM public."unmapped_strings" AS unmapped_strings
    WHERE unmapped_strings."id" = p_unmapped_string_id
    LIMIT 1;

    IF source_raw_string IS NULL THEN
        RAISE EXCEPTION 'Строка маппинга не найдена'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT product_aliases."id"
    INTO existing_alias_id
    FROM public."product_aliases" AS product_aliases
    WHERE product_aliases."original_string" = source_raw_string
    ORDER BY product_aliases."id"
    LIMIT 1;

    IF existing_alias_id IS NULL THEN
        INSERT INTO public."product_aliases" (
            "id",
            "original_string",
            "product_id",
            "is_ignored"
        )
        VALUES (
            gen_random_uuid(),
            source_raw_string,
            NULL,
            true
        );
    ELSE
        UPDATE public."product_aliases"
        SET
            "product_id" = NULL,
            "is_ignored" = true
        WHERE "id" = existing_alias_id;
    END IF;

    DELETE FROM public."unmapped_strings"
    WHERE "id" = p_unmapped_string_id;

    RETURN jsonb_build_object('ignored', true);
END;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_admin_set_product_social_risk"(
    "p_product_id" UUID,
    "p_is_social_risk" BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_product_id UUID;
BEGIN
    PERFORM public."gotmeds_assert_admin"();

    UPDATE public."products"
    SET "is_social_risk" = COALESCE(p_is_social_risk, false)
    WHERE "id" = p_product_id
    RETURNING "id" INTO updated_product_id;

    IF updated_product_id IS NULL THEN
        RAISE EXCEPTION 'Товар не найден'
            USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object(
        'product_id', updated_product_id,
        'is_social_risk', COALESCE(p_is_social_risk, false)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public."gotmeds_assert_admin"() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_full_sync_inventory"(UUID, JSONB, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_create_alias"(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_ignore_alias"(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_set_product_social_risk"(UUID, BOOLEAN) FROM PUBLIC;

DO $$
DECLARE
    restricted_role TEXT;
BEGIN
    FOREACH restricted_role IN ARRAY ARRAY['anon']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = restricted_role) THEN
            EXECUTE FORMAT('REVOKE EXECUTE ON FUNCTION public."gotmeds_assert_admin"() FROM %I', restricted_role);
            EXECUTE FORMAT('REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_full_sync_inventory"(UUID, JSONB, JSONB) FROM %I', restricted_role);
            EXECUTE FORMAT('REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_create_alias"(UUID, UUID) FROM %I', restricted_role);
            EXECUTE FORMAT('REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_ignore_alias"(UUID) FROM %I', restricted_role);
            EXECUTE FORMAT('REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_set_product_social_risk"(UUID, BOOLEAN) FROM %I', restricted_role);
        END IF;
    END LOOP;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public."gotmeds_assert_admin"() TO authenticated;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_full_sync_inventory"(UUID, JSONB, JSONB) TO authenticated;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_create_alias"(UUID, UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_ignore_alias"(UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_set_product_social_risk"(UUID, BOOLEAN) TO authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public."gotmeds_assert_admin"() TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_full_sync_inventory"(UUID, JSONB, JSONB) TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_create_alias"(UUID, UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_ignore_alias"(UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_set_product_social_risk"(UUID, BOOLEAN) TO service_role;
    END IF;
END;
$$;
