// A imagem do cartão de compartilhamento desta rota (lib/cartaoServidor.tsx).
import { imagemDoPerfil, TAMANHO } from "@/lib/cartaoServidor";

export const alt = "O perfil do poeta no Verso";
export const size = TAMANHO;
export const contentType = "image/png";

export default async function Imagem({ params }: { params: Promise<{ username: string }> }) {
  return imagemDoPerfil((await params).username);
}
