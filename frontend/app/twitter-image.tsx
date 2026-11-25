// O Twitter Card padrão do Verso, a mesma imagem do Open Graph: o de toda página
// sem cartão próprio (lib/cartaoServidor.tsx).
import { imagemPadrao } from "@/lib/cartaoServidor";

export const alt = "Verso, rede social de poemas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Imagem() {
  return imagemPadrao();
}
