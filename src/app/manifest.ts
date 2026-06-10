import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "где.таблетка — навигатор по лекарствам",
    short_name: "где.таблетка",
    description: "Поиск лекарств, цен и наличия в аптеках Гудермеса.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAFAFA",
    theme_color: "#2D5A6E",
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
