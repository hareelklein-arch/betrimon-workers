import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "בית רימון — עובדים",
    short_name: "עובדים",
    description: "משמרות, שעות ושכר",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efe6",
    theme_color: "#1f6f4a",
    lang: "he",
    dir: "rtl",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
