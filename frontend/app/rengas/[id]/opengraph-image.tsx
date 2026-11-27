// A imagem do cartão de compartilhamento desta rota (lib/cartaoServidor.tsx).
import { imagemDaRenga, TAMANHO } from "@/lib/cartaoServidor";

export const alt = "As primeiras estrofes da renga no Verso";
export const size = TAMANHO;
export const contentType = "image/png";

export default async function Imagem({ params }: { params: Promise<{ id: string }> }) {
  return imagemDaRenga((await params).id);
}
