import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Casa: telhado em V, paredes e a porta no meio.
export function IconeInicio({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M3.5 11L12 4L20.5 11" />
      <path d="M5.5 9.5V19.5H18.5V9.5" />
      <path d="M10 19.5V14.5H14V19.5" />
    </Icone>
  );
}
