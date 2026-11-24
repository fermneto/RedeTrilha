import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Lupa: lente redonda e o cabo para baixo, à direita.
export function IconeBuscar({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5L19.5 19.5" />
    </Icone>
  );
}
