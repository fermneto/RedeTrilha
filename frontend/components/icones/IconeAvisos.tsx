import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Sino: a cúpula com a borda aberta embaixo, o badalo e a alça no alto. Os avisos.
export function IconeAvisos({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M12 3.75V5" />
      <path d="M6.5 15.5V11A5.5 5.5 0 0 1 17.5 11V15.5L19.25 17.5H4.75L6.5 15.5Z" />
      <path d="M10 20.25A2.1 2.1 0 0 0 14 20.25" />
    </Icone>
  );
}
