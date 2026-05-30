import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

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
    const products = await prisma.product.findMany({
      where: {
        isSocialRisk: false,
      },
      select: {
        id: true,
      },
      orderBy: {
        name: "asc",
      },
    });

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
  if (isPrismaConnectionError(error)) {
    return "база данных недоступна";
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

function isPrismaConnectionError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P1001"
  );
}
