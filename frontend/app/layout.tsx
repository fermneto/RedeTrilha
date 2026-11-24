import type { Metadata } from "next";
import { Literata, Schibsted_Grotesk } from "next/font/google";

import { Layout } from "@/components/Layout";
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

export const metadata: Metadata = {
  title: "Verso",
  description: "Rede social de poemas para quem lê e escreve poesia: o poema inteiro, a conversa sobre ele e os clássicos no mesmo feed",
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
