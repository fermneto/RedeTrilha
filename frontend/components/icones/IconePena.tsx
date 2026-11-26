import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Pena de escrever: a vela com o cálamo saindo pela ponta e uma barba cortada.
export function IconePena({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M19.5 4.5C14 4.5 8.5 8 7.5 14.5L5 19L9.5 16.5C16 15.5 19.5 10 19.5 4.5Z" />
      <path d="M5 19L12.5 11.5" />
      <path d="M14.5 8.5L11 9" />
    </Icone>
  );
}
