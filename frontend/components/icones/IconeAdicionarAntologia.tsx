import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Livro fechado de frente, com um "+" na capa: guarda o poema numa antologia.
export function IconeAdicionarAntologia({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M5.5 18.5V5.5A2 2 0 0 1 7.5 3.5H18.5V16.5H7.5A2 2 0 0 0 5.5 18.5A2 2 0 0 0 7.5 20.5H18.5" />
      <path d="M12 7V13" />
      <path d="M9 10H15" />
    </Icone>
  );
}
