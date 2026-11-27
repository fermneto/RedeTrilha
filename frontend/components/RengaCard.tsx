"use client";
// Renga no feed e no perfil, como um repost no X: o rótulo diz quem abriu,
// escreveu, encerrou ou repostou, e o card mostra o começo da renga. Aberta,
// convida a escrever (ou diz por que não dá); fechada, é um poema de todos os
// autores. Embaixo, as mesmas ações do poema (#171): curtir, repostar, citar,
// comentar, guardar numa antologia e enviar.
// Selecionar versos das estrofes mostra a barra "comentar estes versos / citar
// estes versos / limpar", como no PoemaCard: comentar leva à página da renga com
// ?versos=, citar abre o compositor citando a renga. Os números contam a renga
// inteira (textoDaRenga), mesmo com só as primeiras estrofes no card.
// `aninhado`: a renga citada num poema ou mandada por mensagem, com borda, sem
// rótulo, sem ações e sem a barra dos versos, como o poema dentro de uma citação.

import Link from "next/link";
import { Fragment, useRef } from "react";

import { AutoresDaRenga } from "@/components/AutoresDaRenga";
import { AcoesDaRenga } from "@/components/BarraDeAcoes";
import { BarraDeVersos, useVersosSelecionados } from "@/components/BarraDeVersos";
import { useFolhas } from "@/components/CadernoFolhas";
import { NomeAutor } from "@/components/NomeAutor";
import { SeloDaRenga } from "@/components/SeloDaRenga";
import { VersoFormatado } from "@/components/TextoFormatado";
import { IconeRenga } from "@/components/icones/IconeRenga";
import { IconeRepostar } from "@/components/icones/IconeRepostar";
import {
  caminhoDaCitacaoDeVersosDaRenga,
  caminhoDaCriticaNaRenga,
  fimDasEstrofes,
  textoDaRenga,
  trechoDosVersos,
  versosDoPoema,
  type AtividadeDaRenga,
  type RengaDetalhe,
  type User,
} from "@/lib/api";
import { noPlural } from "@/lib/numeros";

// Fora da página da renga e da folha do caderno, só as primeiras estrofes, com
// link para o resto; a última delas esmaece (.poema-cortado), como no poema.
const ESTROFES_NO_FEED = 4;

type Props = {
  renga: RengaDetalhe;
  // O rótulo do feed e do perfil ("ana repostou"); sem ele, nada acima do título.
  atividade?: AtividadeDaRenga;
  por?: User[];
  aninhado?: boolean;
  // Na folha do livro (CadernoPoema): as ações ficam na página da direita; aqui,
  // só no celular, onde a direita é outra página.
  folha?: boolean;
};

export function RengaCard({ renga, atividade, por = [], aninhado = false, folha = false }: Props) {
  // Na folha a renga vem inteira, com a rolagem da página, como os poemas.
  const estrofes = folha ? renga.estrofes : renga.estrofes.slice(0, ESTROFES_NO_FEED);
  const faltam = renga.estrofes.length - estrofes.length;
  const link = `/rengas/${renga.id}`;
  const texto = textoDaRenga(renga.estrofes);
  const fins = fimDasEstrofes(renga.estrofes);
  const lista = useRef<HTMLOListElement>(null);
  const { selecao, limpar, barra } = useVersosSelecionados(lista, texto, !aninhado);

  return (
    <article className={aninhado ? "rounded-2xl border border-borda p-3" : "px-4 pt-3 pb-4"}>
      {atividade && !aninhado && <Rotulo atividade={atividade} por={por} />}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link href={link} className="poema-titulo break-words hover:underline">
          {renga.titulo}
        </Link>
        <SeloDaRenga fechada={renga.fechada} />
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-tinta-suave">
        <AutoresDaRenga renga={renga} />
      </p>

      <ol ref={lista} aria-label="estrofes" className="mt-3 space-y-5">
        {estrofes.map((e, i) => (
          <li key={e.id}>
            <p className={`poema-corpo${faltam > 0 && i === estrofes.length - 1 ? " poema-cortado" : ""}`}>
              {versosDoPoema(e.texto).map((linha, j, linhas) => (
                <Fragment key={j}>
                  {j > 0 && "\n"}
                  <span data-verso={fins[i] - linhas.length + 1 + j}>
                    <VersoFormatado linha={linha} />
                  </span>
                </Fragment>
              ))}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-tinta-suave">
              <span aria-hidden="true">— </span>
              <span className="sr-only">estrofe de </span>
              <NomeAutor usuario={e.autor} className="font-semibold" />
            </p>
          </li>
        ))}
      </ol>
      {selecao && (
        <BarraDeVersos
          texto={texto}
          selecao={selecao}
          barra={barra}
          caminhoDaCritica={caminhoDaCriticaNaRenga(renga.id, texto, selecao)}
          caminhoDaCitacao={caminhoDaCitacaoDeVersosDaRenga(renga.id, trechoDosVersos(texto, selecao))}
          aoLimpar={limpar}
        />
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-3 text-sm">
        {faltam > 0 && (
          <Link href={link} className="inline-flex min-h-11 items-center font-semibold text-destaque hover:underline">
            ver as outras {faltam} {noPlural(faltam, "estrofe", "estrofes")}
          </Link>
        )}
        {!renga.fechada &&
          !aninhado &&
          (renga.posso_escrever ? (
            <Link href={link} className="inline-flex min-h-11 items-center font-semibold text-destaque hover:underline">
              escrever a próxima estrofe
            </Link>
          ) : (
            <span className="text-tinta-suave">{renga.motivo}</span>
          ))}
        <span className="text-xs text-tinta-suave tabular-nums">
          {renga.qtd_estrofes} de {renga.limite} estrofes
        </span>
      </p>
      {!aninhado && (folha ? <AcoesNoCelular renga={renga} /> : <AcoesDaRenga key={renga.id} renga={renga} />)}
    </article>
  );
}

// Na folha, a página da direita já tem as ações quando o livro está aberto em dois.
function AcoesNoCelular({ renga }: { renga: RengaDetalhe }) {
  const { duplo } = useFolhas();
  return duplo ? null : <AcoesDaRenga key={renga.id} renga={renga} />;
}

const VERBOS: Record<AtividadeDaRenga, [string, string]> = {
  abriu: ["abriu uma renga", "abriram uma renga"],
  escreveu: ["escreveu uma estrofe", "escreveram estrofes"],
  encerrou: ["encerrou a renga", "encerraram a renga"],
  repostou: ["repostou", "repostaram"],
};

// "ana escreveu uma estrofe", "ana e bia escreveram estrofes", "bia abriu uma renga",
// "bia encerrou a renga", "caio e dani repostaram" (com o ícone do repost, como no poema).
function Rotulo({ atividade, por }: { atividade: AtividadeDaRenga; por: User[] }) {
  const [a, b] = por;
  const resto = por.length - 2;
  const [singular, plural] = VERBOS[atividade];
  const verbo = por.length > 1 ? plural : singular;
  const Icone = atividade === "repostou" ? IconeRepostar : IconeRenga;
  return (
    <p className="mb-1 flex items-center gap-2 text-[0.8125rem] font-semibold text-tinta-suave">
      <Icone className="h-4 w-4 shrink-0" />
      <span className="min-w-0">
        {a && <NomeLink usuario={a} />}
        {b && (resto > 0 ? ", " : " e ")}
        {b && <NomeLink usuario={b} />}
        {resto > 0 && ` e mais ${resto}`} {verbo}
      </span>
    </p>
  );
}

function NomeLink({ usuario }: { usuario: User }) {
  return (
    <Link href={`/u/${usuario.username}`} className="hover:underline">
      {usuario.username}
    </Link>
  );
}
