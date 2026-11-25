// A imagem do Twitter Card desta rota, a mesma do Open Graph (lib/cartaoServidor.tsx).
import { imagemDoPerfil } from "@/lib/cartaoServidor";

export const alt = "O perfil do poeta no Verso";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Imagem({ params }: { params: Promise<{ username: string }> }) {
  return imagemDoPerfil((await params).username);
}
