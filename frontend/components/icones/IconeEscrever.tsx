import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Lápis inclinado sobre a linha onde se escreve.
export function IconeEscrever({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M15 5L19 9L9.5 18.5H5.5V14.5Z" />
      <path d="M13 7L17 11" />
      <path d="M13.5 19.5H19.5" />
    </Icone>
  );
}
