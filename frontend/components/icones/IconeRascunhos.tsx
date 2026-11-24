import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Folha com o canto dobrado e versos ainda por terminar.
export function IconeRascunhos({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M14 3.5H6.5C5.67 3.5 5 4.17 5 5V19C5 19.83 5.67 20.5 6.5 20.5H17.5C18.33 20.5 19 19.83 19 19V8.5L14 3.5Z" />
      <path d="M14 3.5V8.5H19" />
      <path d="M8.5 12.5H15.5" />
      <path d="M8.5 16H12.5" />
    </Icone>
  );
}
