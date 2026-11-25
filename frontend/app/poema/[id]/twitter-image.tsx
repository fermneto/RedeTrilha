// A imagem do Twitter Card desta rota, a mesma do Open Graph (lib/cartaoServidor.tsx).
import { imagemDoPoema } from "@/lib/cartaoServidor";

export const alt = "Os primeiros versos do poema no Verso";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Imagem({ params }: { params: Promise<{ id: string }> }) {
  return imagemDoPoema((await params).id);
}
