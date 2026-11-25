import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Seta para baixo: o botão abre uma lista de opções.
export function IconeSeta({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M7 10L12 15L17 10" />
    </Icone>
  );
}
