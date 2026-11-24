import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Um X de traço fino: apaga o que foi digitado.
export function IconeFechar({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M7 7l10 10M17 7L7 17" />
    </Icone>
  );
}
