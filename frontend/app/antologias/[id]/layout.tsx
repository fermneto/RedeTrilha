// Nome, descrição e quem reuniu a antologia no cartão de compartilhamento. A página é client, então os metadados ficam aqui.
import type { Metadata } from "next";

import { metadadosDaAntologia } from "@/lib/cartaoServidor";

type Props = { params: Promise<{ id: string }>; children: React.ReactNode };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  return metadadosDaAntologia((await params).id);
}

export default function Layout({ children }: Props) {
  return children;
}
