import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Estante: duas lombadas de pé, de alturas diferentes, e um livro inclinado na prateleira.
export function IconeAcervo({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <rect x="4" y="6" width="4" height="13" rx="0.75" />
      <rect x="8" y="4" width="4" height="15" rx="0.75" />
      <path d="M8 8H12" />
      <path d="M14.1 7.9L17.9 6.9L21 18.5L17.2 19.5Z" />
      <path d="M2.75 19H21.25" />
    </Icone>
  );
}
