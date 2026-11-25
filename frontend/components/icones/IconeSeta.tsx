import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Uma seta fina para a direita: virar a página (girada, volta).
export function IconeSeta({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icone>
  );
}
