import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GotMeds — Навигатор по лекарствам",
    short_name: "GotMeds",
    description: "Поиск лекарств, цен и наличия в аптеках Гудермеса.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4fbf8",
    theme_color: "#316276",
    lang: "ru",
    icons: [
      {
        src: "/icons/gotmeds-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/gotmeds-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
