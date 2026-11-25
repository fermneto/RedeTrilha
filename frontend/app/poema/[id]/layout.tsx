// Título, autor e começo do poema no cartão de compartilhamento. A página é client, então os metadados ficam aqui.
import type { Metadata } from "next";

import { metadadosDoPoema } from "@/lib/cartaoServidor";

type Props = { params: Promise<{ id: string }>; children: React.ReactNode };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  return metadadosDoPoema((await params).id);
}

export default function Layout({ children }: Props) {
  return children;
}
