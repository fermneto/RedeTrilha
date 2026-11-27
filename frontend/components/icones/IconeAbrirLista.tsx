import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Um V de traço fino, para baixo: abre a lista de um campo de escolha.
export function IconeAbrirLista({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M6 9.5l6 6 6-6" />
    </Icone>
  );
}
