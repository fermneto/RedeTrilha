// O manifest do app (Android, "Adicionar à tela inicial"): nome, cores do papel e
// os ícones gerados por scripts/icones.mjs.
import type { MetadataRoute } from "next";

import { DESCRICAO } from "@/lib/cartao";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Verso",
    short_name: "Verso",
    description: DESCRICAO,
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f0",
    theme_color: "#faf7f0",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
