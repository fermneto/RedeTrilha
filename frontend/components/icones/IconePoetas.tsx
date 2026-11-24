import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Duas pessoas: uma inteira na frente e o contorno de outra atrás, à direita.
export function IconePoetas({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19C3.5 15.9 6 13.75 9 13.75C12 13.75 14.5 15.9 14.5 19" />
      <path d="M15.5 5.75A3 3 0 0 1 15.5 11.25" />
      <path d="M17 14C19 14.6 20.5 16.5 20.5 19" />
    </Icone>
  );
}
