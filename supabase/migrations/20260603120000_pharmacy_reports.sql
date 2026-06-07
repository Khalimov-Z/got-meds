-- ==============================================
-- GotMeds — pharmacy reports
-- ==============================================
-- Источник: spec/features/data-architecture/data-architecture.md,
-- spec/technical/security-performance.md,
-- spec/features/admin-panel/admin-panel-spec.md
-- Этап: Pre-deploy readiness
-- Эта миграция добавляет пользовательские жалобы на аптеки,
-- антиспам-ограничение и админскую модерацию.
-- ==============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'PharmacyReportType'
    ) THEN
        CREATE TYPE public."PharmacyReportType" AS ENUM ('WRONG_NUMBER', 'CLOSED', 'FAKE_STOCK');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'PharmacyReportStatus'
    ) THEN
        CREATE TYPE public."PharmacyReportStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS public."pharmacy_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pharmacy_id" UUID NOT NULL,
    "report_type" public."PharmacyReportType" NOT NULL,
    "user_ip" TEXT NOT NULL,
    "status" public."PharmacyReportStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharmacy_reports_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'pharmacy_reports_pharmacy_id_fkey'
    ) THEN
        ALTER TABLE public."pharmacy_reports"
            ADD CONSTRAINT "pharmacy_reports_pharmacy_id_fkey"
            FOREIGN KEY ("pharmacy_id") REFERENCES public."pharmacies"("id")
            ON DELETE RESTRICT
            ON UPDATE CASCADE;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS "pharmacy_reports_status_created_at_idx"
    ON public."pharmacy_reports"("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "pharmacy_reports_pharmacy_ip_created_at_idx"
    ON public."pharmacy_reports"("pharmacy_id", "user_ip", "created_at" DESC);

ALTER TABLE public."pharmacy_reports" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gotmeds_admin_all_pharmacy_reports" ON public."pharmacy_reports";

CREATE POLICY "gotmeds_admin_all_pharmacy_reports"
ON public."pharmacy_reports"
FOR ALL
TO authenticated
USING (public."gotmeds_is_admin"())
WITH CHECK (public."gotmeds_is_admin"());

CREATE OR REPLACE FUNCTION public."gotmeds_submit_pharmacy_report"(
    "p_pharmacy_id" UUID,
    "p_report_type" public."PharmacyReportType",
    "p_user_ip" TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized_user_ip TEXT := LEFT(BTRIM(COALESCE(p_user_ip, '')), 140);
    existing_report_id UUID;
    inserted_report_id UUID;
BEGIN
    IF normalized_user_ip = '' THEN
        normalized_user_ip := 'unknown';
    END IF;

    IF p_report_type IS NULL THEN
        RAISE EXCEPTION 'Выберите тип жалобы'
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public."pharmacies" AS pharmacies
        INNER JOIN public."cities" AS cities
            ON cities."id" = pharmacies."city_id"
        WHERE pharmacies."id" = p_pharmacy_id
            AND pharmacies."status" = 'ACTIVE'::public."PharmacyStatus"
            AND cities."is_active" = true
    ) THEN
        RAISE EXCEPTION 'Аптека не найдена'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT reports."id"
    INTO existing_report_id
    FROM public."pharmacy_reports" AS reports
    WHERE reports."pharmacy_id" = p_pharmacy_id
        AND reports."user_ip" = normalized_user_ip
        AND reports."created_at" >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    ORDER BY reports."created_at" DESC
    LIMIT 1;

    IF existing_report_id IS NOT NULL THEN
        RAISE EXCEPTION 'Вы уже отправляли отчет по этой аптеке сегодня'
            USING ERRCODE = '23505';
    END IF;

    INSERT INTO public."pharmacy_reports" (
        "id",
        "pharmacy_id",
        "report_type",
        "user_ip",
        "status",
        "created_at"
    )
    VALUES (
        gen_random_uuid(),
        p_pharmacy_id,
        p_report_type,
        normalized_user_ip,
        'NEW'::public."PharmacyReportStatus",
        CURRENT_TIMESTAMP
    )
    RETURNING "id" INTO inserted_report_id;

    RETURN jsonb_build_object('report_id', inserted_report_id);
END;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_admin_set_pharmacy_report_status"(
    "p_report_id" UUID,
    "p_status" public."PharmacyReportStatus"
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_report_id UUID;
BEGIN
    PERFORM public."gotmeds_assert_admin"();

    IF p_status IS NULL THEN
        RAISE EXCEPTION 'Выберите статус жалобы'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public."pharmacy_reports"
    SET "status" = p_status
    WHERE "id" = p_report_id
    RETURNING "id" INTO updated_report_id;

    IF updated_report_id IS NULL THEN
        RAISE EXCEPTION 'Жалоба не найдена'
            USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object(
        'report_id', updated_report_id,
        'status', p_status
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public."gotmeds_submit_pharmacy_report"(UUID, public."PharmacyReportType", TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_set_pharmacy_report_status"(UUID, public."PharmacyReportStatus") FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE public."pharmacy_reports" FROM anon;
        REVOKE EXECUTE ON FUNCTION public."gotmeds_submit_pharmacy_report"(UUID, public."PharmacyReportType", TEXT) FROM anon;
        REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_set_pharmacy_report_status"(UUID, public."PharmacyReportStatus") FROM anon;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT SELECT, UPDATE ON TABLE public."pharmacy_reports" TO authenticated;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_set_pharmacy_report_status"(UUID, public."PharmacyReportStatus") TO authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL PRIVILEGES ON TABLE public."pharmacy_reports" TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_submit_pharmacy_report"(UUID, public."PharmacyReportType", TEXT) TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_set_pharmacy_report_status"(UUID, public."PharmacyReportStatus") TO service_role;
    END IF;
END;
$$;
