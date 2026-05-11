import type { Metadata } from "next";
import "./globals.css";

/**
 * Метаданные приложения GotMeds.
 * SEO-оптимизированные title и description для главной страницы.
 */
export const metadata: Metadata = {
  title: "GotMeds — Навигатор по лекарствам",
  description:
    "Быстрый поиск лекарств и аптек в вашем городе. Сравнение цен, наличие и расположение на карте.",
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
      <body>{children}</body>
    </html>
  );
}
