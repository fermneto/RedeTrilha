import type { Metadata, Viewport } from "next";
import { Literata, Schibsted_Grotesk } from "next/font/google";

import { Layout } from "@/components/Layout";
import { DESCRICAO, NOME, SITE } from "@/lib/cartao";
import "./globals.css";

// Literata para os poemas: serifada de leitura longa, com eixo de tamanho óptico
// (opsz) e itálico de verdade. Schibsted Grotesk para a interface: grotesca de
// redação de jornal, firme nos rótulos pequenos e menos vista que a Inter.
const serifada = Literata({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--fonte-serifada",
  display: "swap",
});

const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--fonte-sans",
  display: "swap",
});

// Metadados de todas as páginas; as do poema, do perfil, da renga e da antologia
// trocam título, descrição e imagem no layout.tsx da rota (lib/cartaoServidor.tsx).
// O ícone, o apple-icon, o manifest e a imagem do cartão vêm dos arquivos de
// app/ (icon.svg, favicon.ico, apple-icon.png, manifest.ts, opengraph-image.tsx).
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: NOME, template: `%s · ${NOME}` },
  description: DESCRICAO,
  applicationName: NOME,
  openGraph: { siteName: NOME, locale: "pt_BR", type: "website", title: NOME, description: DESCRICAO, url: "/" },
  twitter: { card: "summary_large_image", title: NOME, description: DESCRICAO },
};

// A cor da barra do navegador no celular: o papel, claro ou escuro (globals.css).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#17150f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${serifada.variable} ${sans.variable}`}>
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
