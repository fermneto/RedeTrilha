import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Uma pessoa: cabeça e ombros.
export function IconePerfil({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5C5 15.9 8.1 13.5 12 13.5C15.9 13.5 19 15.9 19 19.5" />
    </Icone>
  );
}
