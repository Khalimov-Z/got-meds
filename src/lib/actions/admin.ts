"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";

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

const INVALID_FILE_ERROR = "Неверный формат файла, загрузите .csv или .xls";

const NAME_HEADERS = ["название", "наименование", "товар", "name"];
const STOCK_HEADERS = ["остаток", "количество", "stock", "quantity"];
const PRICE_HEADERS = ["цена", "price"];
const DEMAND_DASHBOARD_DAYS = 7;
const DEMAND_DASHBOARD_LIMIT = 50;
const DEMAND_TERM_SIMILARITY_THRESHOLD = 0.62;

function normalizeValue(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

export async function getDemandDashboardData(
  cityId?: string
): Promise<DemandDashboardData> {
  await requireAdmin();

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - DEMAND_DASHBOARD_DAYS);

  const cities = await prisma.city.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });

  const normalizedCityId = cityId?.trim();
  const selectedCity =
    cities.find((city) => city.id === normalizedCityId) ?? cities[0] ?? null;

  if (!selectedCity) {
    return {
      cities,
      selectedCityId: null,
      periodStart,
      periodEnd,
      totalLogsCount: 0,
      rows: [],
    };
  }

  const [totalLogsCount, rawRows] = await Promise.all([
    prisma.searchLog.count({
      where: {
        cityId: selectedCity.id,
        resultsCount: 0,
        createdAt: {
          gte: periodStart,
        },
      },
    }),
    prisma.$queryRaw<
      Array<{
        search_term: string;
        city_name: string;
        searches_count: number | bigint;
        last_searched_at: Date;
        variants: string[];
      }>
    >(
      Prisma.sql`
        WITH term_stats AS (
          SELECT
            city_id,
            LOWER(TRIM(search_term)) AS normalized_term,
            MIN(search_term) AS display_term,
            COUNT(*)::int AS searches_count,
            MAX(created_at) AS last_searched_at
          FROM search_logs
          WHERE city_id = ${selectedCity.id}::uuid
            AND results_count = 0
            AND created_at >= ${periodStart}
          GROUP BY city_id, LOWER(TRIM(search_term))
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
              AND SIMILARITY(candidate.normalized_term, term_stats.normalized_term) >= ${DEMAND_TERM_SIMILARITY_THRESHOLD}
            ORDER BY
              candidate.searches_count DESC,
              candidate.last_searched_at DESC,
              candidate.normalized_term ASC
            LIMIT 1
          ) bucket
        ),
        grouped_terms AS (
          SELECT
            city_id,
            bucket_term,
            SUM(searches_count)::int AS searches_count,
            MAX(last_searched_at) AS last_searched_at,
            (ARRAY_AGG(display_term ORDER BY searches_count DESC, last_searched_at DESC))[1] AS display_term,
            ARRAY_AGG(display_term ORDER BY searches_count DESC, last_searched_at DESC) AS variants
          FROM bucketed_terms
          GROUP BY city_id, bucket_term
        )
        SELECT
          grouped_terms.display_term AS search_term,
          cities.name AS city_name,
          grouped_terms.searches_count,
          grouped_terms.last_searched_at,
          grouped_terms.variants
        FROM grouped_terms
        INNER JOIN cities ON cities.id = grouped_terms.city_id
        ORDER BY grouped_terms.searches_count DESC, grouped_terms.last_searched_at DESC
        LIMIT ${DEMAND_DASHBOARD_LIMIT}
      `
    ),
  ]);

  return {
    cities,
    selectedCityId: selectedCity.id,
    periodStart,
    periodEnd,
    totalLogsCount,
    rows: rawRows.map((row) => ({
      searchTerm: row.search_term,
      cityName: row.city_name,
      searchesCount: Number(row.searches_count),
      lastSearchedAt: row.last_searched_at,
      variants: Array.from(new Set(row.variants)).filter(
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
