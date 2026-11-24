import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Bússola: círculo com a agulha em losango apontando para o nordeste.
export function IconeExplorar({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M15.5 8.5L13.2 13.2L8.5 15.5L10.8 10.8Z" />
    </Icone>
  );
}
