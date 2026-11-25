import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Avião de papel, inclinado para cima: mandar (um poema, uma mensagem) para alguém.
export function IconeEnviar({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M20 4L3.5 10.5L10 13.5L13.5 20L20 4Z" />
      <path d="M10 13.5L20 4" />
    </Icone>
  );
}
