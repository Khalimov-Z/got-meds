import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-primary",
});

const montserratBrand = localFont({
  src: "./fonts/montserrat-brand.woff2",
  weight: "800",
  style: "normal",
  display: "swap",
  variable: "--font-brand",
});

/**
 * Метаданные публичного приложения где.таблетка.
 * SEO-оптимизированные title и description для главной страницы.
 */
export const metadata: Metadata = {
  applicationName: "где.таблетка",
  metadataBase: new URL(getSiteUrl()),
  title: "где.таблетка — навигатор по лекарствам",
  description:
    "Быстрый поиск лекарств и аптек в вашем городе. Сравнение цен, наличие и расположение на карте.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/gotmeds-icon.svg",
    shortcut: "/icons/gotmeds-icon.svg",
    apple: "/icons/gotmeds-icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "где.таблетка",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2D5A6E",
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
      <body className={`${hankenGrotesk.variable} ${montserratBrand.variable}`}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
