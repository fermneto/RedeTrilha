import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";

import { Layout } from "@/components/Layout";
import "./globals.css";

// Lora para os poemas (leitura longa); Inter para a interface.
const serifada = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--fonte-serifada",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--fonte-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verso",
  description: "Rede social de poemas para poetas iniciantes universitários",
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
