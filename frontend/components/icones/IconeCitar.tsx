import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Aspas de abertura: dois blocos quadrados com a haste curvada para cima.
export function IconeCitar({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M10 7.5C7.6 8.3 6 10.3 6 13V17H10V13H6" />
      <path d="M18 7.5C15.6 8.3 14 10.3 14 13V17H18V13H14" />
    </Icone>
  );
}
