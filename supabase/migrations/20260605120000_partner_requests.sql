-- ==============================================
-- GotMeds — partner requests
-- ==============================================
-- Источник: spec/user-stories/03-local-rules-and-safety.md, раздел US-3.6
-- Этап: Pharmacy Cooperation & Onboarding
-- Эта миграция добавляет таблицу заявок на сотрудничество,
-- RLS-политики и административное управление статусами.
-- ==============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'PartnerRequestType'
    ) THEN
        CREATE TYPE public."PartnerRequestType" AS ENUM ('ADD', 'EDIT', 'DELETE');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'PartnerRequestStatus'
    ) THEN
        CREATE TYPE public."PartnerRequestStatus" AS ENUM ('NEW', 'PROCESSED', 'REJECTED');
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS public."partner_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pharmacy_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "representative_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "request_type" public."PartnerRequestType" NOT NULL,
    "message" TEXT,
    "status" public."PartnerRequestStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "partner_requests_status_created_at_idx"
    ON public."partner_requests"("status", "created_at" DESC);

ALTER TABLE public."partner_requests" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gotmeds_admin_all_partner_requests" ON public."partner_requests";

CREATE POLICY "gotmeds_admin_all_partner_requests"
ON public."partner_requests"
FOR ALL
TO authenticated
USING (public."gotmeds_is_admin"())
WITH CHECK (public."gotmeds_is_admin"());

CREATE OR REPLACE FUNCTION public."gotmeds_submit_partner_request"(
    "p_pharmacy_name" TEXT,
    "p_address" TEXT,
    "p_representative_name" TEXT,
    "p_contact_phone" TEXT,
    "p_request_type" public."PartnerRequestType",
    "p_message" TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inserted_request_id UUID;
    trimmed_pharmacy_name TEXT := BTRIM(COALESCE(p_pharmacy_name, ''));
    trimmed_address TEXT := BTRIM(COALESCE(p_address, ''));
    trimmed_representative_name TEXT := BTRIM(COALESCE(p_representative_name, ''));
    trimmed_contact_phone TEXT := BTRIM(COALESCE(p_contact_phone, ''));
BEGIN
    IF trimmed_pharmacy_name = '' THEN
        RAISE EXCEPTION 'Укажите название аптеки'
            USING ERRCODE = '22023';
    END IF;

    IF trimmed_address = '' THEN
        RAISE EXCEPTION 'Укажите адрес аптеки'
            USING ERRCODE = '22023';
    END IF;

    IF trimmed_representative_name = '' THEN
        RAISE EXCEPTION 'Укажите имя представителя'
            USING ERRCODE = '22023';
    END IF;

    IF trimmed_contact_phone = '' THEN
        RAISE EXCEPTION 'Укажите телефон для связи'
            USING ERRCODE = '22023';
    END IF;

    IF p_request_type IS NULL THEN
        RAISE EXCEPTION 'Выберите тип запроса'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO public."partner_requests" (
        "id",
        "pharmacy_name",
        "address",
        "representative_name",
        "contact_phone",
        "request_type",
        "message",
        "status",
        "created_at",
        "updated_at"
    )
    VALUES (
        gen_random_uuid(),
        trimmed_pharmacy_name,
        trimmed_address,
        trimmed_representative_name,
        trimmed_contact_phone,
        p_request_type,
        BTRIM(p_message),
        'NEW'::public."PartnerRequestStatus",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    RETURNING "id" INTO inserted_request_id;

    RETURN jsonb_build_object('request_id', inserted_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public."gotmeds_admin_set_partner_request_status"(
    "p_request_id" UUID,
    "p_status" public."PartnerRequestStatus"
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_request_id UUID;
BEGIN
    PERFORM public."gotmeds_assert_admin"();

    IF p_status IS NULL THEN
        RAISE EXCEPTION 'Выберите статус запроса'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public."partner_requests"
    SET "status" = p_status,
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = p_request_id
    RETURNING "id" INTO updated_request_id;

    IF updated_request_id IS NULL THEN
        RAISE EXCEPTION 'Заявка не найдена'
            USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object(
        'request_id', updated_request_id,
        'status', p_status
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public."gotmeds_submit_partner_request"(TEXT, TEXT, TEXT, TEXT, public."PartnerRequestType", TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_set_partner_request_status"(UUID, public."PartnerRequestStatus") FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE public."partner_requests" FROM anon;
        REVOKE EXECUTE ON FUNCTION public."gotmeds_submit_partner_request"(TEXT, TEXT, TEXT, TEXT, public."PartnerRequestType", TEXT) FROM anon;
        REVOKE EXECUTE ON FUNCTION public."gotmeds_admin_set_partner_request_status"(UUID, public."PartnerRequestStatus") FROM anon;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT SELECT, UPDATE ON TABLE public."partner_requests" TO authenticated;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_set_partner_request_status"(UUID, public."PartnerRequestStatus") TO authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL PRIVILEGES ON TABLE public."partner_requests" TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_submit_partner_request"(TEXT, TEXT, TEXT, TEXT, public."PartnerRequestType", TEXT) TO service_role;
        GRANT EXECUTE ON FUNCTION public."gotmeds_admin_set_partner_request_status"(UUID, public."PartnerRequestStatus") TO service_role;
    END IF;
END;
$$;
