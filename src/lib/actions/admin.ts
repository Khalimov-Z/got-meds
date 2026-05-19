"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
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

const INVALID_FILE_ERROR = "Неверный формат файла, загрузите .csv или .xls";

const NAME_HEADERS = ["название", "наименование", "товар", "name"];
const STOCK_HEADERS = ["остаток", "количество", "stock", "quantity"];
const PRICE_HEADERS = ["цена", "price"];

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

  const [
    tier2PharmaciesCount,
    unmappedCount,
    aliasesCount,
    restrictedProductsCount,
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
  ]);

  return {
    tier2PharmaciesCount,
    unmappedCount,
    aliasesCount,
    restrictedProductsCount,
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
