import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Envelope fechado, com a aba em V: as mensagens diretas.
export function IconeMensagens({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M5.5 6H18.5A1.5 1.5 0 0 1 20 7.5V16.5A1.5 1.5 0 0 1 18.5 18H5.5A1.5 1.5 0 0 1 4 16.5V7.5A1.5 1.5 0 0 1 5.5 6Z" />
      <path d="M4.5 7L12 12.5L19.5 7" />
    </Icone>
  );
}
