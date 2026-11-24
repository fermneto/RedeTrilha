import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Duas setas num mesmo círculo (raio 7), uma por cima e outra por baixo,
// cada uma com a ponta tangente ao arco.
export function IconeRepostar({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M19 12A7 7 0 0 0 5.94 8.5" />
      <path d="M5.4 5.5L5.94 8.5L8.8 7.5" />
      <path d="M5 12A7 7 0 0 0 18.06 15.5" />
      <path d="M18.6 18.5L18.06 15.5L15.2 16.5" />
    </Icone>
  );
}
