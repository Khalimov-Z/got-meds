"use server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type ProductCategory = "medicine" | "equipment" | "vitamins" | "mother_and_baby";
type PharmacyTierApi = "1" | "2" | "Chain";
type PharmacyInventoryStatus = "in_stock" | "likely_in_stock" | "unknown";

export interface ProductDetails {
  id: string;
  name: string;
  category: ProductCategory;
  dosage?: string;
  form?: string;
  active_ingredient?: string;
  image_url: string;
  price_estimate?: number;
  is_prescription: boolean;
  description: string;
}

export interface ProductAnalog {
  id: string;
  name: string;
  category: ProductCategory;
  active_ingredient?: string;
  form?: string;
  dosage?: string;
  image_url: string;
}

export interface ProductDetailsResponse {
  success: boolean;
  data?: ProductDetails;
  error?: string;
}

export interface ProductAnalogsResponse {
  success: boolean;
  data?: ProductAnalog[];
  error?: string;
}

export interface PharmacyByProductItem {
  pharmacy_id: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  tier: PharmacyTierApi;
  distance_meters: number | null;
  status: PharmacyInventoryStatus;
  working_hours: JsonValue | null;
  is_24_7: boolean;
  is_open_now: boolean;
  phone: string | null;
  whatsapp: string | null;
}

export interface PharmaciesByProductResponse {
  success: boolean;
  data?: PharmacyByProductItem[];
  error?: string;
}

type ProductDetailsRpcRow = {
  id: string;
  name: string;
  category: string;
  active_ingredient: string | null;
  form: string | null;
  dosage: string | null;
  is_prescription: boolean | null;
  price_estimate: number | null;
  description: string | null;
  image_url: string | null;
};

type ProductAnalogRpcRow = {
  id: string;
  name: string;
  category: string;
  active_ingredient: string | null;
  form: string | null;
  dosage: string | null;
  image_url: string | null;
};

type PharmacyByProductRpcRow = {
  pharmacy_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  tier: string;
  distance_meters: number | null;
  status: string;
  working_hours: JsonValue | null;
  is_24_7: boolean;
  is_open_now: boolean;
  phone: string | null;
  whatsapp: string | null;
};

const CATEGORY_MAP: Record<string, ProductCategory> = {
  MEDICINE: "medicine",
  EQUIPMENT: "equipment",
  VITAMINS: "vitamins",
  MOTHER_AND_BABY: "mother_and_baby",
};

const PHARMACY_TIER_VALUES = new Set(["1", "2", "Chain"]);
const INVENTORY_STATUS_VALUES = new Set(["in_stock", "likely_in_stock", "unknown"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapProductCategory(category: string): ProductCategory {
  return CATEGORY_MAP[category] ?? "medicine";
}

function mapPharmacyTier(tier: string): PharmacyTierApi {
  return PHARMACY_TIER_VALUES.has(tier) ? (tier as PharmacyTierApi) : "2";
}

function mapInventoryStatus(status: string): PharmacyInventoryStatus {
  return INVENTORY_STATUS_VALUES.has(status)
    ? (status as PharmacyInventoryStatus)
    : "unknown";
}

function isFiniteCoordinate(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

async function fetchProductDetailsRow(normalizedId: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("gotmeds_get_product_details", {
    p_product_id: normalizedId,
  });

  if (error) {
    throw error;
  }

  return (data as ProductDetailsRpcRow[] | null)?.[0] ?? null;
}

export async function getProductDetails(
  productId: string
): Promise<ProductDetailsResponse> {
  try {
    const normalizedId = productId?.trim();
    if (!normalizedId || !isUuid(normalizedId)) {
      return { success: false, error: "Препарат не найден" };
    }

    const product = await fetchProductDetailsRow(normalizedId);
    if (!product) {
      return { success: false, error: "Препарат не найден" };
    }

    return {
      success: true,
      data: {
        id: product.id,
        name: product.name,
        category: mapProductCategory(product.category),
        active_ingredient: product.active_ingredient ?? undefined,
        form: product.form ?? undefined,
        dosage: product.dosage ?? undefined,
        is_prescription: product.is_prescription ?? false,
        price_estimate: product.price_estimate ?? undefined,
        description: product.description ?? "",
        image_url: product.image_url ?? "",
      },
    };
  } catch (error) {
    console.error("Ошибка получения препарата:", error);
    return {
      success: false,
      error: "Не удалось получить данные препарата. Попробуйте позже.",
    };
  }
}

export async function getAnalogs(
  productId: string
): Promise<ProductAnalogsResponse> {
  try {
    const normalizedId = productId?.trim();
    if (!normalizedId || !isUuid(normalizedId)) {
      return { success: false, error: "Препарат не найден" };
    }

    const product = await fetchProductDetailsRow(normalizedId);
    if (!product) {
      return { success: false, error: "Препарат не найден" };
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc("gotmeds_get_product_analogs", {
      p_product_id: normalizedId,
    });

    if (error) {
      throw error;
    }

    const analogs = (data as ProductAnalogRpcRow[] | null) ?? [];

    return {
      success: true,
      data: analogs.map((analog) => ({
        id: analog.id,
        name: analog.name,
        category: mapProductCategory(analog.category),
        active_ingredient: analog.active_ingredient ?? undefined,
        form: analog.form ?? undefined,
        dosage: analog.dosage ?? undefined,
        image_url: analog.image_url ?? "",
      })),
    };
  } catch (error) {
    console.error("Ошибка получения аналогов:", error);
    return {
      success: false,
      error: "Не удалось получить список аналогов. Попробуйте позже.",
    };
  }
}

export async function getPharmaciesByProduct(
  productId: string,
  lat?: number,
  lng?: number,
  isOpenNow = true
): Promise<PharmaciesByProductResponse> {
  try {
    const normalizedId = productId?.trim();
    if (!normalizedId || !isUuid(normalizedId)) {
      return { success: false, error: "Препарат не найден" };
    }

    const product = await fetchProductDetailsRow(normalizedId);
    if (!product) {
      return { success: false, error: "Препарат не найден" };
    }

    const hasUserCoordinates = isFiniteCoordinate(lat) && isFiniteCoordinate(lng);
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc("gotmeds_get_pharmacies_by_product", {
      p_product_id: normalizedId,
      p_lat: hasUserCoordinates ? lat : null,
      p_lng: hasUserCoordinates ? lng : null,
      p_is_open_now: isOpenNow,
    });

    if (error) {
      throw error;
    }

    const pharmacies = (data as PharmacyByProductRpcRow[] | null) ?? [];

    return {
      success: true,
      data: pharmacies.map((pharmacy) => ({
        pharmacy_id: pharmacy.pharmacy_id,
        name: pharmacy.name,
        address: pharmacy.address,
        coordinates: {
          lat: pharmacy.latitude,
          lng: pharmacy.longitude,
        },
        tier: mapPharmacyTier(pharmacy.tier),
        distance_meters: pharmacy.distance_meters,
        status: mapInventoryStatus(pharmacy.status),
        working_hours: pharmacy.working_hours,
        is_24_7: pharmacy.is_24_7,
        is_open_now: pharmacy.is_open_now,
        phone: pharmacy.phone,
        whatsapp: pharmacy.whatsapp,
      })),
    };
  } catch (error) {
    console.error("Ошибка получения аптек:", error);
    return {
      success: false,
      error: "Не удалось получить список аптек. Попробуйте позже.",
    };
  }
}
