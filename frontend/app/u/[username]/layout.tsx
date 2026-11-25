// Nome, @ e bio do poeta no cartão de compartilhamento. A página é client, então os metadados ficam aqui.
import type { Metadata } from "next";

import { metadadosDoPerfil } from "@/lib/cartaoServidor";

type Props = { params: Promise<{ username: string }>; children: React.ReactNode };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  return metadadosDoPerfil((await params).username);
}

export default function Layout({ children }: Props) {
  return children;
}
