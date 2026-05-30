const DEFAULT_SITE_URL = "http://localhost:3000";

export function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  return siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
}
