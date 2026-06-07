"use server";

import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const REPORT_TYPES = ["wrong_number", "closed", "fake_stock"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReportType = (typeof REPORT_TYPES)[number];

type ReportTypeDb = "WRONG_NUMBER" | "CLOSED" | "FAKE_STOCK";

type SubmitPharmacyReportResponse = {
  success: boolean;
  error?: string;
};

const REPORT_TYPE_MAP: Record<ReportType, ReportTypeDb> = {
  wrong_number: "WRONG_NUMBER",
  closed: "CLOSED",
  fake_stock: "FAKE_STOCK",
};

function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

function normalizeUuid(value: string) {
  const normalized = value.trim();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

async function getRequestIp() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedIp ||
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

function getReportErrorMessage(error: { message?: string } | null) {
  if (!error?.message) {
    return "Не удалось отправить жалобу.";
  }

  if (error.message.includes("уже отправляли")) {
    return "Вы уже отправляли отчет по этой аптеке сегодня.";
  }

  if (error.message.includes("Аптека не найдена")) {
    return "Аптека не найдена.";
  }

  return "Не удалось отправить жалобу. Попробуйте позже.";
}

export async function submitPharmacyReport(
  pharmacyId: string,
  reportType: string
): Promise<SubmitPharmacyReportResponse> {
  const normalizedPharmacyId = normalizeUuid(pharmacyId);

  if (!normalizedPharmacyId) {
    return { success: false, error: "Аптека не найдена." };
  }

  if (!isReportType(reportType)) {
    return { success: false, error: "Выберите тип жалобы." };
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("gotmeds_submit_pharmacy_report", {
    p_pharmacy_id: normalizedPharmacyId,
    p_report_type: REPORT_TYPE_MAP[reportType],
    p_user_ip: await getRequestIp(),
  });

  if (error) {
    return {
      success: false,
      error: getReportErrorMessage(error),
    };
  }

  return { success: true };
}
