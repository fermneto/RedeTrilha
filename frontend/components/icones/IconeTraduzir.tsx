import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Duas escritas lado a lado: um ideograma à esquerda, no alto, e um "A" à direita, embaixo.
export function IconeTraduzir({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M3 5.5H12M7.5 3.5V5.5" />
      <path d="M10 5.5C9.3 8.6 7.3 11 4 12.5M5.5 8C6.5 9.8 8 11.2 10 12" />
      <path d="M12.5 20.5L16.5 11L20.5 20.5M14 17H19" />
    </Icone>
  );
}
