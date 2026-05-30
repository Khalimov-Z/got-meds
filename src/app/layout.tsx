import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

/**
 * Метаданные приложения GotMeds.
 * SEO-оптимизированные title и description для главной страницы.
 */
export const metadata: Metadata = {
  applicationName: "GotMeds",
  metadataBase: new URL(getSiteUrl()),
  title: "GotMeds — Навигатор по лекарствам",
  description:
    "Быстрый поиск лекарств и аптек в вашем городе. Сравнение цен, наличие и расположение на карте.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/gotmeds-icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "GotMeds",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#316276",
};

/**
 * Корневой layout приложения.
 * Устанавливает язык документа (русский) и подключает глобальные стили.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
