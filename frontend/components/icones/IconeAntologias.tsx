import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Livro aberto: duas páginas curvadas que se encontram na lombada.
export function IconeAntologias({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M12 7C10 5.5 7 5 4 5.5V18.5C7 18 10 18.5 12 20C14 18.5 17 18 20 18.5V5.5C17 5 14 5.5 12 7Z" />
      <path d="M12 7V20" />
    </Icone>
  );
}
