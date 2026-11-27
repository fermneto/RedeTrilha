// Quem escreve a renga, logo abaixo do título: "escrita por" enquanto está
// aberta, "um poema de" quando fecha, e os nomes separados por vírgula. Vai
// dentro do parágrafo de quem usa (o card, a lista e a página da renga), que
// cuida do espaçamento; `className` vai em cada nome (a lista põe min-w-0).

import { NomeAutor } from "@/components/NomeAutor";
import type { Renga, User } from "@/lib/api";

export function AutoresDaRenga({ renga, className }: { renga: Renga; className?: string }) {
  return (
    <>
      <span>{renga.fechada ? "um poema de" : "escrita por"}</span>
      <ListaDeAutores autores={renga.autores} className={className} />
    </>
  );
}

// Os nomes, com vírgula entre eles (também os convidados, na página da renga).
export function ListaDeAutores({ autores, className }: { autores: User[]; className?: string }) {
  return (
    <>
      {autores.map((autor, i) => (
        <span key={autor.id} className={className ? `inline-flex ${className} items-center` : "inline-flex items-center"}>
          <NomeAutor usuario={autor} className="font-semibold text-tinta" />
          {i < autores.length - 1 && <span aria-hidden="true">,</span>}
        </span>
      ))}
    </>
  );
}
