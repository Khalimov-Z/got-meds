"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
import { PharmacyStatus, PharmacyTier, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type AdminActionResponse<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

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
  workingHours: Prisma.JsonValue | null;
  is247: boolean;
};

export type AdminPharmacyManagementData = {
  cities: AdminPharmacyCity[];
  pharmacies: AdminPharmacyRow[];
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
  const normalized = String(value ?? "").trim() as PharmacyTier;

  if ((Object.values(PharmacyTier) as string[]).includes(normalized)) {
    return normalized;
  }

  return null;
}

function parsePharmacyStatus(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim() as PharmacyStatus;

  if ((Object.values(PharmacyStatus) as string[]).includes(normalized)) {
    return normalized;
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
      ) as Prisma.InputJsonObject,
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
    workingHours: workingHours as Prisma.InputJsonObject,
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
  const [aliases, products] = await Promise.all([
    prisma.productAlias.findMany({
      select: {
        originalString: true,
        productId: true,
        isIgnored: true,
      },
    }),
    prisma.product.findMany({
      where: {
        isSocialRisk: false,
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return {
    aliasByOriginalString: new Map(
      aliases.map((alias) => [normalizeValue(alias.originalString), alias])
    ),
    productByName: new Map(products.map((product) => [normalizeValue(product.name), product])),
  };
}

export async function getAdminHomeStats() {
  await requireAdmin();
  const demandPeriodStart = new Date();
  demandPeriodStart.setDate(demandPeriodStart.getDate() - DEMAND_DASHBOARD_DAYS);

  const [
    tier2PharmaciesCount,
    unmappedCount,
    aliasesCount,
    restrictedProductsCount,
    zeroResultLogs7dCount,
  ] = await Promise.all([
    prisma.pharmacy.count({
      where: {
        tier: "TIER_2",
      },
    }),
    prisma.unmappedString.count(),
    prisma.productAlias.count(),
    prisma.product.count({
      where: {
        isSocialRisk: true,
      },
    }),
    prisma.searchLog.count({
      where: {
        resultsCount: 0,
        createdAt: {
          gte: demandPeriodStart,
        },
      },
    }),
  ]);

  return {
    tier2PharmaciesCount,
    unmappedCount,
    aliasesCount,
    restrictedProductsCount,
    zeroResultLogs7dCount,
  };
}

export async function getPharmacyManagementData(): Promise<AdminPharmacyManagementData> {
  await requireAdmin();

  const [cities, pharmacies] = await Promise.all([
    prisma.city.findMany({
      orderBy: [
        {
          isActive: "desc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    }),
    prisma.pharmacy.findMany({
      orderBy: [
        {
          city: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        cityId: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        tier: true,
        status: true,
        phone: true,
        whatsapp: true,
        workingHours: true,
        is247: true,
        city: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    cities,
    pharmacies: pharmacies.map((pharmacy) => ({
      id: pharmacy.id,
      cityId: pharmacy.cityId,
      cityName: pharmacy.city.name,
      name: pharmacy.name,
      address: pharmacy.address,
      latitude: pharmacy.latitude,
      longitude: pharmacy.longitude,
      tier: pharmacy.tier,
      status: pharmacy.status,
      phone: pharmacy.phone,
      whatsapp: pharmacy.whatsapp,
      workingHours: pharmacy.workingHours,
      is247: pharmacy.is247,
    })),
  };
}

export async function createPharmacy(formData: FormData): Promise<AdminActionResponse> {
  await requireAdmin();

  const parsed = parsePharmacyFormData(formData);
  if (!parsed.data) {
    return { success: false, error: parsed.error };
  }

  const city = await prisma.city.findUnique({
    where: {
      id: parsed.data.cityId,
    },
    select: {
      id: true,
    },
  });

  if (!city) {
    return { success: false, error: "Город не найден" };
  }

  await prisma.pharmacy.create({
    data: parsed.data,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/pharmacies");
  revalidatePath("/admin/inventory-upload");
  revalidatePath("/map");

  return { success: true };
}

export async function updatePharmacy(formData: FormData): Promise<AdminActionResponse> {
  await requireAdmin();

  const pharmacyId = String(formData.get("pharmacyId") ?? "").trim();
  if (!pharmacyId) {
    return { success: false, error: "Аптека не найдена" };
  }

  const parsed = parsePharmacyFormData(formData);
  if (!parsed.data) {
    return { success: false, error: parsed.error };
  }

  const [pharmacy, city] = await Promise.all([
    prisma.pharmacy.findUnique({
      where: {
        id: pharmacyId,
      },
      select: {
        id: true,
      },
    }),
    prisma.city.findUnique({
      where: {
        id: parsed.data.cityId,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!pharmacy) {
    return { success: false, error: "Аптека не найдена" };
  }

  if (!city) {
    return { success: false, error: "Город не найден" };
  }

  await prisma.pharmacy.update({
    where: {
      id: pharmacy.id,
    },
    data: parsed.data,
  });

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

  return prisma.pharmacy.findMany({
    where: {
      tier: "TIER_2",
      status: "ACTIVE",
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      address: true,
    },
  });
}

export async function getMappingData() {
  await requireAdmin();

  const [queue, products] = await Promise.all([
    prisma.unmappedString.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        rawString: true,
        createdAt: true,
        pharmacy: {
          select: {
            name: true,
            address: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      where: {
        isSocialRisk: false,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        dosage: true,
        form: true,
      },
    }),
  ]);

  return { queue, products };
}

export async function getBlacklistManagementData() {
  await requireAdmin();

  const products = await prisma.product.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      dosage: true,
      form: true,
      isSocialRisk: true,
    },
  });

  return {
    products,
    restrictedCount: products.filter((product) => product.isSocialRisk).length,
  };
}

export async function toggleProductSocialRisk(
  productId: string,
  isSocialRisk: boolean
): Promise<AdminActionResponse> {
  await requireAdmin();

  const normalizedProductId = productId.trim();
  if (!normalizedProductId) {
    return { success: false, error: "Товар не найден" };
  }

  const product = await prisma.product.findUnique({
    where: {
      id: normalizedProductId,
    },
    select: {
      id: true,
    },
  });

  if (!product) {
    return { success: false, error: "Товар не найден" };
  }

  await prisma.product.update({
    where: {
      id: product.id,
    },
    data: {
      isSocialRisk,
    },
  });

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
  fileData: Blob
): Promise<AdminActionResponse<UploadPharmacyPriceReport>> {
  await requireAdmin();

  const normalizedPharmacyId = pharmacyId.trim();
  if (!normalizedPharmacyId) {
    return { success: false, error: "Выберите аптеку" };
  }

  const pharmacy = await prisma.pharmacy.findFirst({
    where: {
      id: normalizedPharmacyId,
      tier: "TIER_2",
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  if (!pharmacy) {
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
    pharmacyId: normalizedPharmacyId,
    productId: item.productId,
    status: "LIKELY_IN_STOCK" as const,
    price: item.price,
  }));
  const unmappedData = Array.from(unmappedStrings).map((rawString) => ({
    pharmacyId: normalizedPharmacyId,
    rawString,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.inventory.deleteMany({
      where: {
        pharmacyId: normalizedPharmacyId,
      },
    });
    await tx.unmappedString.deleteMany({
      where: {
        pharmacyId: normalizedPharmacyId,
      },
    });

    if (inventoryData.length > 0) {
      await tx.inventory.createMany({
        data: inventoryData,
        skipDuplicates: true,
      });
    }

    if (unmappedData.length > 0) {
      await tx.unmappedString.createMany({
        data: unmappedData,
      });
    }
  });

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

  if (!(file instanceof Blob) || file.size === 0) {
    return { error: INVALID_FILE_ERROR };
  }

  const fileName = "name" in file ? String(file.name).toLowerCase() : "";
  if (fileName && !fileName.endsWith(".csv") && !fileName.endsWith(".xls")) {
    return { error: INVALID_FILE_ERROR };
  }

  const result = await uploadPharmacyPrice(pharmacyId, file);

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

  const [unmappedString, product] = await Promise.all([
    prisma.unmappedString.findUnique({
      where: {
        id: unmappedStringId,
      },
      select: {
        id: true,
        rawString: true,
      },
    }),
    prisma.product.findFirst({
      where: {
        id: productId,
        isSocialRisk: false,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!unmappedString) {
    return { success: false, error: "Строка маппинга не найдена" };
  }

  if (!product) {
    return { success: false, error: "Препарат не найден" };
  }

  await prisma.$transaction(async (tx) => {
    const existingAlias = await tx.productAlias.findFirst({
      where: {
        originalString: unmappedString.rawString,
      },
      select: {
        id: true,
      },
    });

    if (existingAlias) {
      await tx.productAlias.update({
        where: {
          id: existingAlias.id,
        },
        data: {
          productId: product.id,
          isIgnored: false,
        },
      });
    } else {
      await tx.productAlias.create({
        data: {
          originalString: unmappedString.rawString,
          productId: product.id,
          isIgnored: false,
        },
      });
    }

    await tx.unmappedString.delete({
      where: {
        id: unmappedString.id,
      },
    });
  });

  revalidatePath("/admin/mapping");
  return { success: true };
}

export async function ignoreAlias(
  unmappedStringId: string
): Promise<AdminActionResponse> {
  await requireAdmin();

  const unmappedString = await prisma.unmappedString.findUnique({
    where: {
      id: unmappedStringId,
    },
    select: {
      id: true,
      rawString: true,
    },
  });

  if (!unmappedString) {
    return { success: false, error: "Строка маппинга не найдена" };
  }

  await prisma.$transaction(async (tx) => {
    const existingAlias = await tx.productAlias.findFirst({
      where: {
        originalString: unmappedString.rawString,
      },
      select: {
        id: true,
      },
    });

    if (existingAlias) {
      await tx.productAlias.update({
        where: {
          id: existingAlias.id,
        },
        data: {
          productId: null,
          isIgnored: true,
        },
      });
    } else {
      await tx.productAlias.create({
        data: {
          originalString: unmappedString.rawString,
          productId: null,
          isIgnored: true,
        },
      });
    }

    await tx.unmappedString.delete({
      where: {
        id: unmappedString.id,
      },
    });
  });

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
