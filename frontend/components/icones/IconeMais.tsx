import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Três pontos na horizontal: abre um menu.
export function IconeMais({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <circle cx="6" cy="12" r="1.25" fill="currentColor" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" />
      <circle cx="18" cy="12" r="1.25" fill="currentColor" />
    </Icone>
  );
}
