-- ==============================================
-- GotMeds — Supabase Auth and RLS
-- ==============================================
-- Источник: spec/technical/supabase-platform-migration.md, раздел 6.4
-- Этап: Supabase Auth and RLS
-- Эта миграция связывает доменных администраторов с Supabase Auth
-- и включает RLS-политики без переноса админских мутаций.
-- ==============================================

ALTER TABLE public."admins"
    ADD COLUMN IF NOT EXISTS "auth_user_id" UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'admins_auth_user_id_fkey'
    ) THEN
        ALTER TABLE public."admins"
            ADD CONSTRAINT "admins_auth_user_id_fkey"
            FOREIGN KEY ("auth_user_id") REFERENCES auth.users("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE;
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "admins_auth_user_id_key"
    ON public."admins"("auth_user_id")
    WHERE "auth_user_id" IS NOT NULL;

UPDATE public."admins" AS admins
SET "auth_user_id" = users."id"
FROM auth.users AS users
WHERE admins."auth_user_id" IS NULL
    AND LOWER(admins."email") = LOWER(users."email");

CREATE OR REPLACE FUNCTION public."gotmeds_current_admin_role"()
RETURNS public."AdminRole"
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT admins."role"
    FROM public."admins" AS admins
    WHERE admins."auth_user_id" = (SELECT auth.uid())
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_is_admin"()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        public."gotmeds_current_admin_role"() IN ('SUPERADMIN'::public."AdminRole", 'CONTENT_MANAGER'::public."AdminRole"),
        false
    );
$$;

REVOKE EXECUTE ON FUNCTION public."gotmeds_current_admin_role"() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_is_admin"() FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public."gotmeds_current_admin_role"() TO authenticated;
        GRANT EXECUTE ON FUNCTION public."gotmeds_is_admin"() TO authenticated;
    END IF;
END;
$$;

ALTER TABLE public."cities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pharmacies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."product_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."unmapped_strings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."search_logs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gotmeds_public_read_active_cities" ON public."cities";
DROP POLICY IF EXISTS "gotmeds_admin_all_cities" ON public."cities";
DROP POLICY IF EXISTS "gotmeds_admin_select_own_or_admins" ON public."admins";
DROP POLICY IF EXISTS "gotmeds_admin_all_admins" ON public."admins";
DROP POLICY IF EXISTS "gotmeds_public_read_active_pharmacies" ON public."pharmacies";
DROP POLICY IF EXISTS "gotmeds_admin_all_pharmacies" ON public."pharmacies";
DROP POLICY IF EXISTS "gotmeds_public_read_safe_products" ON public."products";
DROP POLICY IF EXISTS "gotmeds_admin_all_products" ON public."products";
DROP POLICY IF EXISTS "gotmeds_public_read_safe_inventory" ON public."inventory";
DROP POLICY IF EXISTS "gotmeds_admin_all_inventory" ON public."inventory";
DROP POLICY IF EXISTS "gotmeds_admin_all_product_aliases" ON public."product_aliases";
DROP POLICY IF EXISTS "gotmeds_admin_all_unmapped_strings" ON public."unmapped_strings";
DROP POLICY IF EXISTS "gotmeds_admin_all_search_logs" ON public."search_logs";

CREATE POLICY "gotmeds_public_read_active_cities"
ON public."cities"
FOR SELECT
TO anon, authenticated
USING ("is_active" = true);

CREATE POLICY "gotmeds_admin_all_cities"
ON public."cities"
FOR ALL
TO authenticated
USING (public."gotmeds_is_admin"())
WITH CHECK (public."gotmeds_is_admin"());

CREATE POLICY "gotmeds_admin_select_own_or_admins"
ON public."admins"
FOR SELECT
TO authenticated
USING (
    "auth_user_id" = (SELECT auth.uid())
    OR public."gotmeds_is_admin"()
);

CREATE POLICY "gotmeds_admin_all_admins"
ON public."admins"
FOR ALL
TO authenticated
USING (public."gotmeds_is_admin"())
WITH CHECK (public."gotmeds_is_admin"());

CREATE POLICY "gotmeds_public_read_active_pharmacies"
ON public."pharmacies"
FOR SELECT
TO anon, authenticated
USING (
    "status" = 'ACTIVE'::public."PharmacyStatus"
    AND EXISTS (
        SELECT 1
        FROM public."cities" AS cities
        WHERE cities."id" = "pharmacies"."city_id"
            AND cities."is_active" = true
    )
);

CREATE POLICY "gotmeds_admin_all_pharmacies"
ON public."pharmacies"
FOR ALL
TO authenticated
USING (public."gotmeds_is_admin"())
WITH CHECK (public."gotmeds_is_admin"());

CREATE POLICY "gotmeds_public_read_safe_products"
ON public."products"
FOR SELECT
TO anon, authenticated
USING ("is_social_risk" = false);

CREATE POLICY "gotmeds_admin_all_products"
ON public."products"
FOR ALL
TO authenticated
USING (public."gotmeds_is_admin"())
WITH CHECK (public."gotmeds_is_admin"());

CREATE POLICY "gotmeds_public_read_safe_inventory"
ON public."inventory"
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public."products" AS products
        WHERE products."id" = "inventory"."product_id"
            AND products."is_social_risk" = false
    )
    AND EXISTS (
        SELECT 1
        FROM public."pharmacies" AS pharmacies
        INNER JOIN public."cities" AS cities ON cities."id" = pharmacies."city_id"
        WHERE pharmacies."id" = "inventory"."pharmacy_id"
            AND pharmacies."status" = 'ACTIVE'::public."PharmacyStatus"
            AND cities."is_active" = true
    )
);

CREATE POLICY "gotmeds_admin_all_inventory"
ON public."inventory"
FOR ALL
TO authenticated
USING (public."gotmeds_is_admin"())
WITH CHECK (public."gotmeds_is_admin"());

CREATE POLICY "gotmeds_admin_all_product_aliases"
ON public."product_aliases"
FOR ALL
TO authenticated
USING (public."gotmeds_is_admin"())
WITH CHECK (public."gotmeds_is_admin"());

CREATE POLICY "gotmeds_admin_all_unmapped_strings"
ON public."unmapped_strings"
FOR ALL
TO authenticated
USING (public."gotmeds_is_admin"())
WITH CHECK (public."gotmeds_is_admin"());

CREATE POLICY "gotmeds_admin_all_search_logs"
ON public."search_logs"
FOR ALL
TO authenticated
USING (public."gotmeds_is_admin"())
WITH CHECK (public."gotmeds_is_admin"());

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        GRANT SELECT ON TABLE
            public."cities",
            public."pharmacies",
            public."products",
            public."inventory"
        TO anon;

        REVOKE ALL ON TABLE
            public."admins",
            public."product_aliases",
            public."unmapped_strings",
            public."search_logs"
        FROM anon;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT SELECT ON TABLE
            public."cities",
            public."admins",
            public."pharmacies",
            public."products",
            public."inventory",
            public."product_aliases",
            public."unmapped_strings",
            public."search_logs"
        TO authenticated;

        GRANT INSERT, UPDATE, DELETE ON TABLE
            public."cities",
            public."admins",
            public."pharmacies",
            public."products",
            public."inventory",
            public."product_aliases",
            public."unmapped_strings",
            public."search_logs"
        TO authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL PRIVILEGES ON TABLE
            public."cities",
            public."admins",
            public."pharmacies",
            public."products",
            public."inventory",
            public."product_aliases",
            public."unmapped_strings",
            public."search_logs"
        TO service_role;
    END IF;
END;
$$;
