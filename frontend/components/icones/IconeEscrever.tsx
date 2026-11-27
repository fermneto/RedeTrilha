import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Lápis inclinado sobre a linha onde se escreve. O desenho vai de 5 a 19 na
// largura e de 4,75 a 19,25 na altura: o centro dele é o do viewBox, e o lápis fica no meio do
// botão redondo do Escrever.
export function IconeEscrever({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M14.5 4.75L18.5 8.75L9 18.25H5V14.25Z" />
      <path d="M12.5 6.75L16.5 10.75" />
      <path d="M13 19.25H19" />
    </Icone>
  );
}
