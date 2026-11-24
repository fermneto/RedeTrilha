import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Renga: três estrofes empilhadas, cada uma de uma mão (recuos diferentes).
export function IconeRenga({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M4 5H14" />
      <path d="M4 8H11" />
      <path d="M7 12H18" />
      <path d="M7 15H15" />
      <path d="M10 19H20" />
    </Icone>
  );
}
