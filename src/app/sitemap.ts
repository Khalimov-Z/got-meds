import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/map`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc("gotmeds_get_sitemap_product_ids");

    if (error) {
      throw error;
    }

    const products = (data as Array<{ id: string }> | null) ?? [];

    return [
      ...staticRoutes,
      ...products.map((product) => ({
        url: `${siteUrl}/product/${product.id}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.9,
      })),
    ];
  } catch (error) {
    const message = getSitemapErrorMessage(error);
    console.warn(`Не удалось сформировать sitemap.xml: ${message}`);
    return staticRoutes;
  }
}

function getSitemapErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return `ошибка Supabase ${String((error as { code: string }).code)}`;
  }

  if (error instanceof Error) {
    const firstLine = error.message
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean);

    return firstLine ?? "неизвестная ошибка";
  }

  return "неизвестная ошибка";
}
