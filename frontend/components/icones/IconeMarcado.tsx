import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Um visto de traço fino: a opção escolhida numa lista.
export function IconeMarcado({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M5.5 12.5l4.5 4.5 8.5-9.5" />
    </Icone>
  );
}
