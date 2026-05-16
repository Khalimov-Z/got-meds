"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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

export interface ProductDetailsResponse {
  success: boolean;
  data?: ProductDetails;
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
  working_hours: Prisma.JsonValue | null;
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

const CATEGORY_MAP: Record<string, ProductCategory> = {
  MEDICINE: "medicine",
  EQUIPMENT: "equipment",
  VITAMINS: "vitamins",
  MOTHER_AND_BABY: "mother_and_baby",
};

const TIER_MAP: Record<string, PharmacyTierApi> = {
  TIER_1: "1",
  TIER_2: "2",
  TIER_3: "Chain",
};

const INVENTORY_STATUS_MAP: Record<string, PharmacyInventoryStatus> = {
  IN_STOCK: "in_stock",
  LIKELY_IN_STOCK: "likely_in_stock",
};

const BASIC_PRODUCT_PRICE_LIMIT = 1000;
const GUDERMES_TIMEZONE = "Europe/Moscow";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function mapProductCategory(category: string): ProductCategory {
  return CATEGORY_MAP[category] ?? "medicine";
}

function isBasicProduct(product: {
  isPrescription: boolean | null;
  priceEstimate: number | null;
}) {
  return (
    product.isPrescription !== true &&
    product.priceEstimate !== null &&
    product.priceEstimate <= BASIC_PRODUCT_PRICE_LIMIT
  );
}

function getGudermesTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GUDERMES_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return {
    dayKey: DAY_KEYS[WEEKDAY_TO_INDEX[weekday] ?? 1],
    minutes: (hour % 24) * 60 + minute,
  };
}

function parseTimeToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 24 || minutes > 59) {
    return null;
  }

  return (hours % 24) * 60 + minutes;
}

function isTimeInsideRange(nowMinutes: number, range: string) {
  const [startRaw, endRaw] = range.split("-").map((part) => part.trim());
  const start = parseTimeToMinutes(startRaw ?? "");
  const end = parseTimeToMinutes(endRaw ?? "");

  if (start === null || end === null) {
    return false;
  }

  if (start <= end) {
    return nowMinutes >= start && nowMinutes <= end;
  }

  return nowMinutes >= start || nowMinutes <= end;
}

function isPharmacyOpenNow(workingHours: Prisma.JsonValue | null, is247: boolean) {
  if (is247) {
    return true;
  }

  if (!workingHours || typeof workingHours !== "object" || Array.isArray(workingHours)) {
    return false;
  }

  const { dayKey, minutes } = getGudermesTimeParts(new Date());
  const daySchedule = (workingHours as Record<string, unknown>)[dayKey];

  if (typeof daySchedule !== "string") {
    return false;
  }

  const normalizedSchedule = daySchedule.trim().toLowerCase();
  if (!normalizedSchedule || normalizedSchedule.includes("выход")) {
    return false;
  }

  return normalizedSchedule
    .split(/[;,]/)
    .some((range) => isTimeInsideRange(minutes, range));
}

function calculateDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
}

function isFiniteCoordinate(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function getTierSortWeight(tier: PharmacyTierApi) {
  if (tier === "Chain") {
    return 0;
  }

  if (tier === "2") {
    return 1;
  }

  return 2;
}

export async function getProductDetails(
  productId: string
): Promise<ProductDetailsResponse> {
  try {
    const normalizedId = productId?.trim();
    if (!normalizedId) {
      return { success: false, error: "Препарат не найден" };
    }

    const product = await prisma.product.findFirst({
      where: {
        id: normalizedId,
        isSocialRisk: false,
      },
      select: {
        id: true,
        name: true,
        category: true,
        activeIngredient: true,
        form: true,
        dosage: true,
        isPrescription: true,
        priceEstimate: true,
        description: true,
        imageUrl: true,
      },
    });

    if (!product) {
      return { success: false, error: "Препарат не найден" };
    }

    return {
      success: true,
      data: {
        id: product.id,
        name: product.name,
        category: mapProductCategory(product.category),
        active_ingredient: product.activeIngredient ?? undefined,
        form: product.form ?? undefined,
        dosage: product.dosage ?? undefined,
        is_prescription: product.isPrescription ?? false,
        price_estimate: product.priceEstimate ?? undefined,
        description: product.description ?? "",
        image_url: product.imageUrl ?? "",
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

export async function getPharmaciesByProduct(
  productId: string,
  lat?: number,
  lng?: number,
  isOpenNow = true
): Promise<PharmaciesByProductResponse> {
  try {
    const normalizedId = productId?.trim();
    if (!normalizedId) {
      return { success: false, error: "Препарат не найден" };
    }

    const product = await prisma.product.findFirst({
      where: {
        id: normalizedId,
        isSocialRisk: false,
      },
      select: {
        id: true,
        isPrescription: true,
        priceEstimate: true,
      },
    });

    if (!product) {
      return { success: false, error: "Препарат не найден" };
    }

    const includeTierOne = isBasicProduct(product);
    const hasUserCoordinates = isFiniteCoordinate(lat) && isFiniteCoordinate(lng);

    const pharmacies = await prisma.pharmacy.findMany({
      where: {
        status: "ACTIVE",
        city: {
          isActive: true,
        },
        OR: [
          ...(includeTierOne ? [{ tier: "TIER_1" as const }] : []),
          {
            inventory: {
              some: {
                productId: product.id,
                status: {
                  in: ["IN_STOCK", "LIKELY_IN_STOCK"],
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        tier: true,
        phone: true,
        whatsapp: true,
        workingHours: true,
        is247: true,
        inventory: {
          where: {
            productId: product.id,
            status: {
              in: ["IN_STOCK", "LIKELY_IN_STOCK"],
            },
          },
          select: {
            status: true,
          },
          take: 1,
        },
      },
    });

    const data = pharmacies
      .map<PharmacyByProductItem | null>((pharmacy) => {
        const tier = TIER_MAP[pharmacy.tier];
        const inventoryItem = pharmacy.inventory[0];
        const isOpen = isPharmacyOpenNow(pharmacy.workingHours, pharmacy.is247);

        if (isOpenNow && !isOpen) {
          return null;
        }

        if (!tier) {
          return null;
        }

        const status: PharmacyInventoryStatus =
          tier === "1"
            ? "unknown"
            : INVENTORY_STATUS_MAP[inventoryItem?.status ?? ""] ?? "unknown";

        if (tier !== "1" && status === "unknown") {
          return null;
        }

        return {
          pharmacy_id: pharmacy.id,
          name: pharmacy.name,
          address: pharmacy.address,
          coordinates: {
            lat: pharmacy.latitude,
            lng: pharmacy.longitude,
          },
          tier,
          distance_meters: hasUserCoordinates
            ? calculateDistanceMeters(
                { lat: lat as number, lng: lng as number },
                { lat: pharmacy.latitude, lng: pharmacy.longitude }
              )
            : null,
          status,
          working_hours: pharmacy.workingHours,
          is_24_7: pharmacy.is247,
          is_open_now: isOpen,
          phone: pharmacy.phone,
          whatsapp: pharmacy.whatsapp,
        };
      })
      .filter((pharmacy): pharmacy is PharmacyByProductItem => pharmacy !== null)
      .sort((a, b) => {
        if (hasUserCoordinates && a.distance_meters !== null && b.distance_meters !== null) {
          return a.distance_meters - b.distance_meters;
        }

        const tierDiff = getTierSortWeight(a.tier) - getTierSortWeight(b.tier);
        if (tierDiff !== 0) {
          return tierDiff;
        }

        return a.name.localeCompare(b.name, "ru");
      });

    return { success: true, data };
  } catch (error) {
    console.error("Ошибка получения аптек:", error);
    return {
      success: false,
      error: "Не удалось получить список аптек. Попробуйте позже.",
    };
  }
}
