// O cartão padrão do Verso: o de toda página sem cartão próprio e o de reserva
// das que têm (lib/cartaoServidor.tsx).
import { imagemPadrao, TAMANHO } from "@/lib/cartaoServidor";

export const alt = "Verso, rede social de poemas";
export const size = TAMANHO;
export const contentType = "image/png";

export default function Imagem() {
  return imagemPadrao();
}
