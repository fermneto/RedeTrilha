import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Balão de fala: retângulo de cantos arredondados com a ponta embaixo, à esquerda.
export function IconeComentar({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M6.5 5H17.5A1.5 1.5 0 0 1 19 6.5V14.5A1.5 1.5 0 0 1 17.5 16H10.5L6.5 19.5V16A1.5 1.5 0 0 1 5 14.5V6.5A1.5 1.5 0 0 1 6.5 5Z" />
    </Icone>
  );
}
