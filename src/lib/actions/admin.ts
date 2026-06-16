"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type AdminActionResponse<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

type JsonObject = { [key: string]: JsonValue };

const PHARMACY_TIERS = ["TIER_1", "TIER_2", "TIER_3"] as const;
const PHARMACY_STATUSES = ["ACTIVE", "PAUSED", "CLOSED"] as const;
const PHARMACY_REPORT_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED"] as const;

export type PharmacyTier = (typeof PHARMACY_TIERS)[number];
export type PharmacyStatus = (typeof PHARMACY_STATUSES)[number];
export type PharmacyReportType = "WRONG_NUMBER" | "CLOSED" | "FAKE_STOCK";
export type PharmacyReportStatus = (typeof PHARMACY_REPORT_STATUSES)[number];

export type UploadPharmacyPriceReport = {
  totalRows: number;
  recognizedRows: number;
  unmappedRows: number;
};

export type UploadPharmacyPriceState = {
  report?: UploadPharmacyPriceReport;
  error?: string;
};

export type DemandDashboardCity = {
  id: string;
  name: string;
};

export type DemandDashboardRow = {
  searchTerm: string;
  cityName: string;
  searchesCount: number;
  lastSearchedAt: Date;
  variants: string[];
};

export type DemandDashboardData = {
  cities: DemandDashboardCity[];
  selectedCityId: string | null;
  periodStart: Date;
  periodEnd: Date;
  totalLogsCount: number;
  rows: DemandDashboardRow[];
};

export type AdminPharmacyReportRow = {
  id: string;
  type: PharmacyReportType;
  status: PharmacyReportStatus;
  userIp: string;
  createdAt: Date;
  pharmacy: {
    id: string;
    name: string;
    address: string;
  };
};

type DemandDashboardRpcPayload = {
  cities?: DemandDashboardCity[];
  selected_city_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  total_logs_count?: number | string | null;
  rows?: Array<{
    search_term: string;
    city_name: string;
    searches_count: number | string;
    last_searched_at: string;
    variants?: string[];
  }>;
};

export type AdminPharmacyCity = {
  id: string;
  name: string;
  isActive: boolean;
};

export type AdminPharmacyRow = {
  id: string;
  cityId: string;
  cityName: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  tier: PharmacyTier;
  status: PharmacyStatus;
  phone: string | null;
  whatsapp: string | null;
  workingHours: JsonValue | null;
  is247: boolean;
};

export type AdminPharmacyManagementData = {
  cities: AdminPharmacyCity[];
  pharmacies: AdminPharmacyRow[];
};

type ProductAliasDictionaryRow = {
  original_string: string;
  product_id: string | null;
  is_ignored: boolean;
};

type ProductDictionaryRow = {
  id: string;
  name: string;
};

type SupabaseCityRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type SupabasePharmacyRow = {
  id: string;
  city_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  tier: PharmacyTier;
  status: PharmacyStatus;
  phone: string | null;
  whatsapp: string | null;
  working_hours: JsonValue | null;
  is_24_7: boolean;
  cities: { name: string } | { name: string }[] | null;
};

type SupabaseMappingQueueRow = {
  id: string;
  raw_string: string;
  pharmacies: { name: string; address: string } | { name: string; address: string }[] | null;
};

type SupabaseMappingProductRow = {
  id: string;
  name: string;
  dosage: string | null;
  form: string | null;
};

type SupabaseBlacklistProductRow = SupabaseMappingProductRow & {
  is_social_risk: boolean;
};

type SupabasePharmacyReportRow = {
  id: string;
  report_type: PharmacyReportType;
  status: PharmacyReportStatus;
  user_ip: string;
  created_at: string;
  pharmacies:
  | { id: string; name: string; address: string }
  | Array<{ id: string; name: string; address: string }>
  | null;
};

type PharmacyFormPayload = {
  cityId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  tier: PharmacyTier;
  status: PharmacyStatus;
  phone: string | null;
  whatsapp: string | null;
  workingHours: JsonObject;
  is247: boolean;
};

const INVALID_FILE_ERROR = "Неверный формат файла, загрузите .csv или .xls";

const NAME_HEADERS = ["название", "наименование", "товар", "name"];
const STOCK_HEADERS = ["остаток", "количество", "stock", "quantity"];
const PRICE_HEADERS = ["цена", "price"];
const DEMAND_DASHBOARD_DAYS = 7;
const DEMAND_DASHBOARD_LIMIT = 50;
const DEMAND_TERM_SIMILARITY_THRESHOLD = 0.62;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORKING_DAYS = [
  { key: "mon", label: "понедельника" },
  { key: "tue", label: "вторника" },
  { key: "wed", label: "среды" },
  { key: "thu", label: "четверга" },
  { key: "fri", label: "пятницы" },
  { key: "sat", label: "субботы" },
  { key: "sun", label: "воскресенья" },
] as const;

function normalizeValue(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseRpcDate(value: string | null | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function normalizeUuid(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
}

function getSingleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getFirstError(
  responses: Array<{ error: { message: string } | null }>
) {
  return responses.find((response) => response.error)?.error ?? null;
}

function mapPharmacyFormPayload(data: PharmacyFormPayload) {
  return {
    city_id: data.cityId,
    name: data.name,
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    tier: data.tier,
    status: data.status,
    phone: data.phone,
    whatsapp: data.whatsapp,
    working_hours: data.workingHours,
    is_24_7: data.is247,
  };
}

function getActionErrorMessage(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback;
}

function getCell(row: Record<string, unknown>, headerNames: string[]) {
  const normalizedHeaderNames = new Set(headerNames.map(normalizeValue));
  const entry = Object.entries(row).find(([key]) =>
    normalizedHeaderNames.has(normalizeValue(key))
  );

  if (!entry) {
    return "";
  }

  return String(entry[1] ?? "").trim();
}

function parseNumericCell(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseCoordinate(value: FormDataEntryValue | null, fieldName: string) {
  const parsed = Number(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(parsed)) {
    return { value: null, error: `${fieldName} должна быть числом` };
  }

  return { value: parsed, error: "" };
}

function parsePharmacyTier(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  if ((PHARMACY_TIERS as readonly string[]).includes(normalized)) {
    return normalized as PharmacyTier;
  }

  return null;
}

function parsePharmacyStatus(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  if ((PHARMACY_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as PharmacyStatus;
  }

  return null;
}

function parsePharmacyReportStatus(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  if ((PHARMACY_REPORT_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as PharmacyReportStatus;
  }

  return null;
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  return normalized || null;
}

function isClosedSchedule(value: string) {
  return value.toLowerCase().includes("выход");
}

function isValidScheduleRange(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);

  if (!match) {
    return false;
  }

  const [, startHourRaw, startMinuteRaw, endHourRaw, endMinuteRaw] = match;
  const startHour = Number(startHourRaw);
  const startMinute = Number(startMinuteRaw);
  const endHour = Number(endHourRaw);
  const endMinute = Number(endMinuteRaw);
  const isValidTime = (hour: number, minute: number) =>
    hour >= 0 && hour <= 24 && minute >= 0 && minute <= 59 && (hour < 24 || minute === 0);

  return isValidTime(startHour, startMinute) && isValidTime(endHour, endMinute);
}

function parseWorkingHours(formData: FormData, is247: boolean) {
  if (is247) {
    return {
      workingHours: Object.fromEntries(
        WORKING_DAYS.map((day) => [day.key, "00:00-23:59"])
      ) as JsonObject,
      error: "",
    };
  }

  const workingHours = Object.fromEntries(
    WORKING_DAYS.map((day) => {
      const value = String(formData.get(`workingHours_${day.key}`) ?? "").trim();

      return [day.key, value || "выходной"];
    })
  ) as Record<(typeof WORKING_DAYS)[number]["key"], string>;

  const openDays = Object.values(workingHours).filter((value) => !isClosedSchedule(value));
  if (openDays.length === 0) {
    return {
      workingHours: null,
      error: "Укажите график хотя бы для одного рабочего дня или включите 24/7",
    };
  }

  for (const day of WORKING_DAYS) {
    const schedule = workingHours[day.key];
    if (isClosedSchedule(schedule)) {
      continue;
    }

    const ranges = schedule.split(/[;,]/).map((range) => range.trim()).filter(Boolean);
    if (ranges.length === 0 || ranges.some((range) => !isValidScheduleRange(range))) {
      return {
        workingHours: null,
        error: `График для ${day.label} укажите в формате 08:00-20:00 или 08:00-12:00; 13:00-20:00`,
      };
    }
  }

  return {
    workingHours: workingHours as JsonObject,
    error: "",
  };
}

function parsePharmacyFormData(formData: FormData) {
  const cityId = String(formData.get("cityId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const latitude = parseCoordinate(formData.get("latitude"), "Широта");
  const longitude = parseCoordinate(formData.get("longitude"), "Долгота");
  const tier = parsePharmacyTier(formData.get("tier"));
  const status = parsePharmacyStatus(formData.get("status"));
  const is247 = String(formData.get("is247") ?? "") === "true";
  const workingHours = parseWorkingHours(formData, is247);

  if (!cityId) {
    return { data: null, error: "Выберите город" };
  }

  if (!name) {
    return { data: null, error: "Укажите название аптеки" };
  }

  if (!address) {
    return { data: null, error: "Укажите адрес аптеки" };
  }

  if (latitude.error || latitude.value === null) {
    return { data: null, error: latitude.error };
  }

  if (latitude.value < -90 || latitude.value > 90) {
    return { data: null, error: "Широта должна быть в диапазоне от -90 до 90" };
  }

  if (longitude.error || longitude.value === null) {
    return { data: null, error: longitude.error };
  }

  if (longitude.value < -180 || longitude.value > 180) {
    return { data: null, error: "Долгота должна быть в диапазоне от -180 до 180" };
  }

  if (!tier) {
    return { data: null, error: "Выберите тип аптеки" };
  }

  if (!status) {
    return { data: null, error: "Выберите статус аптеки" };
  }

  if (workingHours.error || !workingHours.workingHours) {
    return { data: null, error: workingHours.error };
  }

  return {
    data: {
      cityId,
      name,
      address,
      latitude: latitude.value,
      longitude: longitude.value,
      tier,
      status,
      phone: normalizeOptionalText(formData.get("phone")),
      whatsapp: normalizeOptionalText(formData.get("whatsapp")),
      workingHours: workingHours.workingHours,
      is247,
    },
    error: "",
  };
}

function hasRequiredCsvHeaders(fields: string[] | undefined) {
  if (!fields?.length) {
    return false;
  }

  const normalizedFields = new Set(fields.map(normalizeValue));

  return (
    NAME_HEADERS.some((header) => normalizedFields.has(normalizeValue(header))) &&
    STOCK_HEADERS.some((header) => normalizedFields.has(normalizeValue(header)))
  );
}

async function parseCsvPrice(fileData: Blob) {
  const text = await fileData.text();

  if (!text.trim()) {
    return { rows: [], error: INVALID_FILE_ERROR };
  }

  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
  });

  if (parsed.errors.length > 0 || !hasRequiredCsvHeaders(parsed.meta.fields)) {
    return { rows: [], error: INVALID_FILE_ERROR };
  }

  return { rows: parsed.data, error: "" };
}

async function getMappingDictionaries() {
  const supabase = await createSupabaseAuthServerClient();
  const [aliasesResponse, productsResponse] = await Promise.all([
    supabase
      .from("product_aliases")
      .select("original_string,product_id,is_ignored"),
    supabase
      .from("products")
      .select("id,name")
      .eq("is_social_risk", false),
  ]);

  const firstError = getFirstError([aliasesResponse, productsResponse]);
  if (firstError) {
    throw firstError;
  }

  const aliases = (aliasesResponse.data ?? []) as ProductAliasDictionaryRow[];
  const products = (productsResponse.data ?? []) as ProductDictionaryRow[];

  return {
    aliasByOriginalString: new Map(
      aliases.map((alias) => [
        normalizeValue(alias.original_string),
        {
          originalString: alias.original_string,
          productId: alias.product_id,
          isIgnored: alias.is_ignored,
        },
      ])
    ),
    productByName: new Map(products.map((product) => [normalizeValue(product.name), product])),
  };
}

export async function getAdminHomeStats() {
  await requireAdmin();
  const demandPeriodStart = new Date();
  demandPeriodStart.setDate(demandPeriodStart.getDate() - DEMAND_DASHBOARD_DAYS);
  const supabase = await createSupabaseAuthServerClient();

  const [
    tier2PharmaciesResponse,
    unmappedResponse,
    aliasesResponse,
    restrictedProductsResponse,
    zeroResultLogs7dResponse,
    newReportsResponse,
  ] = await Promise.all([
    supabase
      .from("pharmacies")
      .select("id", { count: "exact", head: true })
      .eq("tier", "TIER_2"),
    supabase
      .from("unmapped_strings")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("product_aliases")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_social_risk", true),
    supabase
      .from("search_logs")
      .select("id", { count: "exact", head: true })
      .eq("results_count", 0)
      .gte("created_at", demandPeriodStart.toISOString()),
    supabase
      .from("pharmacy_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "NEW"),
  ]);

  const firstError = getFirstError([
    tier2PharmaciesResponse,
    unmappedResponse,
    aliasesResponse,
    restrictedProductsResponse,
    zeroResultLogs7dResponse,
    newReportsResponse,
  ]);
  if (firstError) {
    throw firstError;
  }

  return {
    tier2PharmaciesCount: tier2PharmaciesResponse.count ?? 0,
    unmappedCount: unmappedResponse.count ?? 0,
    aliasesCount: aliasesResponse.count ?? 0,
    restrictedProductsCount: restrictedProductsResponse.count ?? 0,
    zeroResultLogs7dCount: zeroResultLogs7dResponse.count ?? 0,
    newReportsCount: newReportsResponse.count ?? 0,
  };
}

export async function getPharmacyManagementData(): Promise<AdminPharmacyManagementData> {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();

  const [citiesResponse, pharmaciesResponse] = await Promise.all([
    supabase
      .from("cities")
      .select("id,name,is_active")
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("pharmacies")
      .select(
        "id,city_id,name,address,latitude,longitude,tier,status,phone,whatsapp,working_hours,is_24_7,cities(name)"
      ),
  ]);

  const firstError = getFirstError([citiesResponse, pharmaciesResponse]);
  if (firstError) {
    throw firstError;
  }

  const cities = (citiesResponse.data ?? []) as SupabaseCityRow[];
  const pharmacies = (pharmaciesResponse.data ?? []) as SupabasePharmacyRow[];
  const mappedPharmacies = pharmacies
    .map((pharmacy) => {
      const city = getSingleRelation(pharmacy.cities);

      return {
        id: pharmacy.id,
        cityId: pharmacy.city_id,
        cityName: city?.name ?? "Город не найден",
        name: pharmacy.name,
        address: pharmacy.address,
        latitude: pharmacy.latitude,
        longitude: pharmacy.longitude,
        tier: pharmacy.tier,
        status: pharmacy.status,
        phone: pharmacy.phone,
        whatsapp: pharmacy.whatsapp,
        workingHours: pharmacy.working_hours,
        is247: pharmacy.is_24_7,
      };
    })
    .sort((left, right) => {
      const cityCompare = left.cityName.localeCompare(right.cityName, "ru");

      return cityCompare || left.name.localeCompare(right.name, "ru");
    });

  return {
    cities: cities.map((city) => ({
      id: city.id,
      name: city.name,
      isActive: city.is_active,
    })),
    pharmacies: mappedPharmacies,
  };
}

export async function createPharmacy(formData: FormData): Promise<AdminActionResponse> {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();

  const parsed = parsePharmacyFormData(formData);
  if (!parsed.data) {
    return { success: false, error: parsed.error };
  }

  const { data: city, error: cityError } = await supabase
    .from("cities")
    .select("id")
    .eq("id", parsed.data.cityId)
    .maybeSingle<{ id: string }>();

  if (cityError) {
    return { success: false, error: "Город не найден" };
  }

  if (!city) {
    return { success: false, error: "Город не найден" };
  }

  const { error } = await supabase
    .from("pharmacies")
    .insert(mapPharmacyFormPayload(parsed.data));

  if (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Не удалось создать аптеку"),
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pharmacies");
  revalidatePath("/admin/inventory-upload");
  revalidatePath("/map");

  return { success: true };
}

export async function updatePharmacy(formData: FormData): Promise<AdminActionResponse> {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();

  const pharmacyId = String(formData.get("pharmacyId") ?? "").trim();
  if (!pharmacyId) {
    return { success: false, error: "Аптека не найдена" };
  }

  const parsed = parsePharmacyFormData(formData);
  if (!parsed.data) {
    return { success: false, error: parsed.error };
  }

  const [pharmacy, city] = await Promise.all([
    supabase
      .from("pharmacies")
      .select("id")
      .eq("id", pharmacyId)
      .maybeSingle<{ id: string }>(),
    supabase
      .from("cities")
      .select("id")
      .eq("id", parsed.data.cityId)
      .maybeSingle<{ id: string }>(),
  ]);

  if (pharmacy.error || !pharmacy.data) {
    return { success: false, error: "Аптека не найдена" };
  }

  if (city.error || !city.data) {
    return { success: false, error: "Город не найден" };
  }

  const { error } = await supabase
    .from("pharmacies")
    .update(mapPharmacyFormPayload(parsed.data))
    .eq("id", pharmacy.data.id);

  if (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Не удалось обновить аптеку"),
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pharmacies");
  revalidatePath("/admin/inventory-upload");
  revalidatePath("/map");

  return { success: true };
}

export async function createPharmacyForm(formData: FormData) {
  const result = await createPharmacy(formData);

  if (!result.success) {
    redirect(`/admin/pharmacies?error=${encodeURIComponent(result.error ?? "Ошибка создания аптеки")}`);
  }

  redirect("/admin/pharmacies?created=1");
}

export async function updatePharmacyForm(formData: FormData) {
  const result = await updatePharmacy(formData);

  if (!result.success) {
    redirect(`/admin/pharmacies?error=${encodeURIComponent(result.error ?? "Ошибка обновления аптеки")}`);
  }

  redirect("/admin/pharmacies?updated=1");
}

export async function getDemandDashboardData(
  cityId?: string
): Promise<DemandDashboardData> {
  await requireAdmin();

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - DEMAND_DASHBOARD_DAYS);
  const supabase = getSupabaseServerClient();
  const normalizedCityId = normalizeUuid(cityId);

  const { data, error } = await supabase.rpc("gotmeds_get_demand_dashboard", {
    p_city_id: normalizedCityId,
    p_days: DEMAND_DASHBOARD_DAYS,
    p_similarity_threshold: DEMAND_TERM_SIMILARITY_THRESHOLD,
    p_limit: DEMAND_DASHBOARD_LIMIT,
  });

  if (error) {
    throw error;
  }

  const payload = (data ?? {}) as DemandDashboardRpcPayload;
  const cities = Array.isArray(payload.cities) ? payload.cities : [];

  return {
    cities,
    selectedCityId: payload.selected_city_id ?? null,
    periodStart: parseRpcDate(payload.period_start, periodStart),
    periodEnd: parseRpcDate(payload.period_end, periodEnd),
    totalLogsCount: Number(payload.total_logs_count ?? 0),
    rows: (payload.rows ?? []).map((row) => ({
      searchTerm: row.search_term,
      cityName: row.city_name,
      searchesCount: Number(row.searches_count),
      lastSearchedAt: parseRpcDate(row.last_searched_at, periodEnd),
      variants: Array.from(new Set(row.variants ?? [])).filter(
        (variant) => variant !== row.search_term
      ),
    })),
  };
}

export async function getInventoryUploadData() {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();

  const { data, error } = await supabase
    .from("pharmacies")
    .select("id,name,address")
    .eq("tier", "TIER_2")
    .eq("status", "ACTIVE")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getMappingData() {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();

  const [queueResponse, productsResponse] = await Promise.all([
    supabase
      .from("unmapped_strings")
      .select("id,raw_string,pharmacies(name,address)")
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id,name,dosage,form")
      .eq("is_social_risk", false)
      .order("name", { ascending: true }),
  ]);

  const firstError = getFirstError([queueResponse, productsResponse]);
  if (firstError) {
    throw firstError;
  }

  const queueRows = (queueResponse.data ?? []) as SupabaseMappingQueueRow[];
  const products = (productsResponse.data ?? []) as SupabaseMappingProductRow[];
  const queue = queueRows.map((item) => {
    const pharmacy = getSingleRelation(item.pharmacies);

    return {
      id: item.id,
      rawString: item.raw_string,
      pharmacy: {
        name: pharmacy?.name ?? "Аптека не найдена",
        address: pharmacy?.address ?? "Адрес не найден",
      },
    };
  });

  return { queue, products };
}

export async function getBlacklistManagementData() {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();

  const { data, error } = await supabase
    .from("products")
    .select("id,name,dosage,form,is_social_risk")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  const products = ((data ?? []) as SupabaseBlacklistProductRow[]).map((product) => ({
    id: product.id,
    name: product.name,
    dosage: product.dosage,
    form: product.form,
    isSocialRisk: product.is_social_risk,
  }));

  return {
    products,
    restrictedCount: products.filter((product) => product.isSocialRisk).length,
  };
}

export async function getPharmacyReportsData(): Promise<AdminPharmacyReportRow[]> {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();

  const { data, error } = await supabase
    .from("pharmacy_reports")
    .select("id,report_type,status,user_ip,created_at,pharmacies(id,name,address)")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SupabasePharmacyReportRow[]).map((report) => {
    const pharmacy = getSingleRelation(report.pharmacies);

    return {
      id: report.id,
      type: report.report_type,
      status: report.status,
      userIp: report.user_ip,
      createdAt: parseRpcDate(report.created_at, new Date(0)),
      pharmacy: {
        id: pharmacy?.id ?? "",
        name: pharmacy?.name ?? "Аптека не найдена",
        address: pharmacy?.address ?? "Адрес не найден",
      },
    };
  });
}

export async function updatePharmacyReportStatus(
  reportId: string,
  status: PharmacyReportStatus
): Promise<AdminActionResponse> {
  await requireAdmin();
  const normalizedReportId = normalizeUuid(reportId);
  const parsedStatus = parsePharmacyReportStatus(status);

  if (!normalizedReportId) {
    return { success: false, error: "Жалоба не найдена" };
  }

  if (!parsedStatus) {
    return { success: false, error: "Выберите статус жалобы" };
  }

  const supabase = await createSupabaseAuthServerClient();
  const { error } = await supabase.rpc("gotmeds_admin_set_pharmacy_report_status", {
    p_report_id: normalizedReportId,
    p_status: parsedStatus,
  });

  if (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Не удалось обновить статус жалобы"),
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/reports");

  return { success: true };
}

export async function updatePharmacyReportStatusForm(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "");
  const status = parsePharmacyReportStatus(formData.get("status"));

  if (!status) {
    redirect("/admin/reports?error=Выберите%20статус%20жалобы");
  }

  const result = await updatePharmacyReportStatus(reportId, status);

  if (!result.success) {
    redirect(`/admin/reports?error=${encodeURIComponent(result.error ?? "Ошибка жалобы")}`);
  }

  redirect("/admin/reports?updated=1");
}

export async function toggleProductSocialRisk(
  productId: string,
  isSocialRisk: boolean
): Promise<AdminActionResponse> {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();

  const normalizedProductId = normalizeUuid(productId);
  if (!normalizedProductId) {
    return { success: false, error: "Товар не найден" };
  }

  const { error } = await supabase.rpc("gotmeds_admin_set_product_social_risk", {
    p_product_id: normalizedProductId,
    p_is_social_risk: isSocialRisk,
  });

  if (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Ошибка черного списка"),
    };
  }

  revalidatePath("/");
  revalidatePath("/map");
  revalidatePath("/admin");
  revalidatePath("/admin/blacklist");

  return { success: true };
}

export async function toggleProductSocialRiskForm(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const isSocialRisk = String(formData.get("isSocialRisk") ?? "") === "true";
  const result = await toggleProductSocialRisk(productId, isSocialRisk);

  if (!result.success) {
    redirect(`/admin/blacklist?error=${encodeURIComponent(result.error ?? "Ошибка черного списка")}`);
  }

  redirect("/admin/blacklist?updated=1");
}

export async function uploadPharmacyPrice(
  pharmacyId: string,
  fileData: Blob,
  forceUpload = false
): Promise<AdminActionResponse<UploadPharmacyPriceReport>> {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();

  const normalizedPharmacyId = normalizeUuid(pharmacyId);
  if (!normalizedPharmacyId) {
    return { success: false, error: "Выберите аптеку" };
  }

  const { data: pharmacy, error: pharmacyError } = await supabase
    .from("pharmacies")
    .select("id")
    .eq("id", normalizedPharmacyId)
    .eq("tier", "TIER_2")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string }>();

  if (pharmacyError || !pharmacy) {
    return { success: false, error: "Аптека не найдена" };
  }

  const { rows, error } = await parseCsvPrice(fileData);
  if (error) {
    return { success: false, error };
  }

  const { aliasByOriginalString, productByName } = await getMappingDictionaries();
  const inventoryByProductId = new Map<string, { productId: string; price: number | null }>();
  const unmappedStrings = new Set<string>();
  let totalRows = 0;
  let recognizedRows = 0;

  for (const row of rows) {
    const rawName = getCell(row, NAME_HEADERS);
    const stock = parseNumericCell(getCell(row, STOCK_HEADERS));

    if (!rawName || stock === null || stock <= 0) {
      continue;
    }

    totalRows += 1;
    const normalizedName = normalizeValue(rawName);
    const alias = aliasByOriginalString.get(normalizedName);

    if (alias?.isIgnored) {
      continue;
    }

    const productId = alias?.productId ?? productByName.get(normalizedName)?.id;

    if (productId) {
      const price = parseNumericCell(getCell(row, PRICE_HEADERS));
      inventoryByProductId.set(productId, {
        productId,
        price,
      });
      recognizedRows += 1;
      continue;
    }

    unmappedStrings.add(rawName.trim());
  }

  const inventoryData = Array.from(inventoryByProductId.values()).map((item) => ({
    product_id: item.productId,
    price: item.price,
  }));
  const unmappedData = Array.from(unmappedStrings);

  // --- Защита от сбоев импорта (Thresholds) ---
  const { count: currentInventoryCount, error: countError } = await supabase
    .from("inventory")
    .select("product_id", { count: "exact", head: true })
    .eq("pharmacy_id", normalizedPharmacyId);

  if (countError) {
    console.error("❌ Ошибка при получении текущих остатков для проверки порога:", countError);
  }

  const currentCount = currentInventoryCount ?? 0;
  const newCount = inventoryData.length;

  if (!forceUpload && currentCount > 10 && (newCount === 0 || newCount < currentCount * 0.5)) {
    return {
      success: false,
      error: `Импорт заблокирован: количество распознанных позиций (${newCount}) снизилось более чем на 50% по сравнению с текущими остатками (${currentCount}). Если вы действительно хотите затереть данные, установите галочку «Принудительная загрузка» и повторите попытку.`,
    };
  }
  // ----------------------------------------------

  const { error: syncError } = await supabase.rpc("gotmeds_admin_full_sync_inventory", {
    p_pharmacy_id: normalizedPharmacyId,
    p_inventory_items: inventoryData,
    p_unmapped_strings: unmappedData,
  });

  if (syncError) {
    return {
      success: false,
      error: getActionErrorMessage(syncError, "Не удалось загрузить прайс"),
    };
  }

  revalidatePath("/admin/inventory-upload");
  revalidatePath("/admin/mapping");
  revalidatePath("/map");

  return {
    success: true,
    data: {
      totalRows,
      recognizedRows,
      unmappedRows: unmappedData.length,
    },
  };
}

export async function uploadPharmacyPriceForm(
  _previousState: UploadPharmacyPriceState,
  formData: FormData
): Promise<UploadPharmacyPriceState> {
  const pharmacyId = String(formData.get("pharmacyId") ?? "");
  const file = formData.get("file");
  const forceUpload = formData.get("forceUpload") === "true";

  if (!(file instanceof Blob) || file.size === 0) {
    return { error: INVALID_FILE_ERROR };
  }

  const fileName = "name" in file ? String(file.name).toLowerCase() : "";
  if (fileName && !fileName.endsWith(".csv") && !fileName.endsWith(".xls")) {
    return { error: INVALID_FILE_ERROR };
  }

  const result = await uploadPharmacyPrice(pharmacyId, file, forceUpload);

  if (!result.success || !result.data) {
    return { error: result.error ?? "Не удалось загрузить прайс" };
  }

  return { report: result.data };
}

export async function createAlias(
  unmappedStringId: string,
  productId: string
): Promise<AdminActionResponse> {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();
  const normalizedUnmappedStringId = normalizeUuid(unmappedStringId);
  const normalizedProductId = normalizeUuid(productId);

  if (!normalizedUnmappedStringId) {
    return { success: false, error: "Строка маппинга не найдена" };
  }

  if (!normalizedProductId) {
    return { success: false, error: "Препарат не найден" };
  }

  const { error } = await supabase.rpc("gotmeds_admin_create_alias", {
    p_unmapped_string_id: normalizedUnmappedStringId,
    p_product_id: normalizedProductId,
  });

  if (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Ошибка маппинга"),
    };
  }

  revalidatePath("/admin/mapping");
  return { success: true };
}

export async function ignoreAlias(
  unmappedStringId: string
): Promise<AdminActionResponse> {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();
  const normalizedUnmappedStringId = normalizeUuid(unmappedStringId);

  if (!normalizedUnmappedStringId) {
    return { success: false, error: "Строка маппинга не найдена" };
  }

  const { error } = await supabase.rpc("gotmeds_admin_ignore_alias", {
    p_unmapped_string_id: normalizedUnmappedStringId,
  });

  if (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Ошибка маппинга"),
    };
  }

  revalidatePath("/admin/mapping");
  return { success: true };
}

export async function createAliasForm(formData: FormData) {
  const unmappedStringId = String(formData.get("unmappedStringId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const result = await createAlias(unmappedStringId, productId);

  if (!result.success) {
    redirect(`/admin/mapping?error=${encodeURIComponent(result.error ?? "Ошибка маппинга")}`);
  }

  redirect("/admin/mapping?mapped=1");
}

export async function ignoreAliasForm(formData: FormData) {
  const unmappedStringId = String(formData.get("unmappedStringId") ?? "");
  const result = await ignoreAlias(unmappedStringId);

  if (!result.success) {
    redirect(`/admin/mapping?error=${encodeURIComponent(result.error ?? "Ошибка маппинга")}`);
  }

  redirect("/admin/mapping?ignored=1");
}

export async function deleteAliasAction(aliasId: string): Promise<AdminActionResponse> {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();
  const normalizedAliasId = normalizeUuid(aliasId);

  if (!normalizedAliasId) {
    return { success: false, error: "Синоним не найден" };
  }

  // Получим информацию об алиасе перед удалением
  const { data: alias, error: selectError } = await supabase
    .from("product_aliases")
    .select("original_string")
    .eq("id", normalizedAliasId)
    .maybeSingle();

  if (selectError || !alias) {
    return { success: false, error: "Синоним не найден" };
  }

  const { error: deleteError } = await supabase
    .from("product_aliases")
    .delete()
    .eq("id", normalizedAliasId);

  if (deleteError) {
    console.error("❌ Ошибка удаления синонима:", deleteError);
    return {
      success: false,
      error: getActionErrorMessage(deleteError, "Не удалось удалить синоним"),
    };
  }

  revalidatePath("/admin/mapping");
  revalidatePath("/admin/aliases");
  return { success: true };
}

export type AdminAliasRow = {
  id: string;
  originalString: string;
  productId: string;
  productName: string;
  productDosage: string | null;
  productForm: string | null;
};

export type AdminAliasesData = {
  aliases: AdminAliasRow[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
};

export async function getAliasesData(
  search = "",
  page = 1
): Promise<AdminAliasesData> {
  await requireAdmin();
  const supabase = await createSupabaseAuthServerClient();

  const limit = 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("product_aliases")
    .select(
      "id,original_string,product_id,products(name,dosage,form)",
      { count: "exact" }
    )
    .eq("is_ignored", false);

  if (search.trim()) {
    const cleanSearch = `%${search.trim()}%`;
    const { data: matchedProducts } = await supabase
      .from("products")
      .select("id")
      .ilike("name", cleanSearch);
    
    const productIds = (matchedProducts ?? []).map((p) => p.id);

    if (productIds.length > 0) {
      query = query.or(
        `original_string.ilike.${cleanSearch},product_id.in.(${productIds.map(id => `"${id}"`).join(",")})`
      );
    } else {
      query = query.ilike("original_string", cleanSearch);
    }
  }

  const { data, count, error } = await query
    .order("original_string", { ascending: true })
    .range(from, to);

  if (error) {
    throw error;
  }

  type SupabaseAliasJoinRow = {
    id: string;
    original_string: string;
    product_id: string | null;
    products:
    | { name: string; dosage: string | null; form: string | null }
    | Array<{ name: string; dosage: string | null; form: string | null }>
    | null;
  };

  const aliases = ((data ?? []) as unknown as SupabaseAliasJoinRow[]).map((row) => {
    const product = getSingleRelation(row.products);
    return {
      id: row.id,
      originalString: row.original_string,
      productId: row.product_id ?? "",
      productName: product?.name ?? "Препарат не найден",
      productDosage: product?.dosage ?? null,
      productForm: product?.form ?? null,
    };
  });

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / limit);

  return {
    aliases,
    totalCount,
    totalPages,
    currentPage: page,
  };
}

export async function deleteAliasForm(formData: FormData) {
  const aliasId = String(formData.get("aliasId") ?? "");
  const result = await deleteAliasAction(aliasId);

  if (!result.success) {
    redirect(`/admin/aliases?error=${encodeURIComponent(result.error ?? "Ошибка удаления синонима")}`);
  }

  redirect("/admin/aliases?deleted=1");
}
