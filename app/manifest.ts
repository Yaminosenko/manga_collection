import type { MetadataRoute } from "next";
import { COULEUR_FOND_APPLICATION, NOM_APPLICATION, NOM_APPLICATION_COURT } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: NOM_APPLICATION,
    short_name: NOM_APPLICATION_COURT,
    description: "Suivi de collection de mangas, tome par tome",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: COULEUR_FOND_APPLICATION,
    theme_color: COULEUR_FOND_APPLICATION,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
