import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Poupemos — Finanças da família",
    short_name: "Poupemos",
    description: "Controle financeiro familiar com contas, cartões, metas e assistente.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f6f8f3",
    theme_color: "#163300",
    lang: "pt-BR",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/poupemos-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/poupemos-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/poupemos-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
