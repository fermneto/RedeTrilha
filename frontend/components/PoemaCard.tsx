"use client";
// Client component: as ações (curtir, repostar) têm estado otimista.

import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { IconeCitar } from "@/components/icones/IconeCitar";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { IconeCurtir } from "@/components/icones/IconeCurtir";
import { IconeRepostar } from "@/components/icones/IconeRepostar";
import { anosDeVida, curtir, formatarData, nomeDaForma, repostar, type Post, type User } from "@/lib/api";

// Fora da página do poema, poema com mais linhas que isto aparece cortado, com link
// para o inteiro. Linhas em branco entre estrofes contam.
const VERSOS_NO_FEED = 20;

type Props = {
  post: Post;
  // Original dentro de uma citação: sem ações, sem "repostado por" e sem aninhar de novo.
  aninhado?: boolean;
  // Na página do próprio poema o título não precisa ser link.
  linkarTitulo?: boolean;
  // Na página do poema ele (e o original que ele cita) aparece sempre inteiro;
  // no resto, cortado por linhasVisiveis.
  inteiro?: boolean;
};

export function PoemaCard({ post, aninhado = false, linkarTitulo = true, inteiro = false }: Props) {
  // Repost puro (texto vazio) fora do feed: mostra o original com o aviso de quem repostou.
  const repostPuro = post.repost_de !== null && post.texto === "";
  const poema = repostPuro && post.repost_de ? post.repost_de : post;
  const reposters = repostPuro ? [post.autor] : (post.repostado_por ?? []);
  const citacao = !repostPuro && (post.repost_de !== null || post.repost_removido);

  // Fora de uma citação: avatar numa coluna à esquerda e tudo o mais alinhado ao
  // texto, à direita. Na citação, o avatar pequeno vai na linha do nome.
  return (
    <article
      className={aninhado ? "rounded-2xl border border-borda p-3" : "px-4 pt-3 pb-1"}
    >
      {!aninhado && reposters.length > 0 && <RepostadoPor usuarios={reposters} />}

      <div className="flex gap-3">
        {!aninhado && (
          <Link href={`/u/${poema.autor.username}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
            <Avatar usuario={poema.autor} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <Autor autor={poema.autor} criadoEm={poema.created_at} comAvatar={aninhado} />

          {poema.titulo &&
            (linkarTitulo ? (
              <h2 className="poema-titulo mt-2">
                <Link href={`/poema/${poema.id}`} className="hover:underline">
                  {poema.titulo}
                </Link>
              </h2>
            ) : (
              <h1 className="poema-titulo mt-2">{poema.titulo}</h1>
            ))}

          {poema.texto && <Corpo poema={poema} inteiro={inteiro} />}

          {citacao && !aninhado && (
            <div className="mt-3">
              {poema.repost_de ? (
                <PoemaCard post={poema.repost_de} aninhado inteiro={inteiro} />
              ) : (
                <p className="rounded-2xl border border-dashed border-borda p-4 text-sm text-tinta-suave italic">
                  poema removido pelo autor
                </p>
              )}
            </div>
          )}

          <Detalhes poema={poema} />

          {!aninhado && <Acoes key={poema.id} poema={poema} />}
        </div>
      </div>
    </article>
  );
}

// Quantas linhas mostrar de um poema longo: até o fim da última estrofe completa
// que caiba em VERSOS_NO_FEED linhas, sem terminar em linha vazia. Se a primeira
// estrofe sozinha passar do limite, corta no limite. null = cabe inteiro.
function linhasVisiveis(versos: string[]): number | null {
  if (versos.length <= VERSOS_NO_FEED) return null;
  const vazia = (i: number) => versos[i].trim() === "";
  for (let fim = VERSOS_NO_FEED; fim > 0; fim--) {
    if (vazia(fim) && !vazia(fim - 1)) return fim;
  }
  return VERSOS_NO_FEED;
}

// Corta só a exibição: o texto do poema não muda, e o link leva à versão inteira.
function Corpo({ poema, inteiro }: { poema: Post; inteiro: boolean }) {
  const versos = poema.texto.split("\n");
  const visiveis = inteiro ? null : linhasVisiveis(versos);
  const cortar = visiveis !== null;
  return (
    <>
      <p className={`poema-corpo ${poema.titulo ? "mt-2" : "mt-1"}`}>
        {cortar ? versos.slice(0, visiveis).join("\n") : poema.texto}
      </p>
      {cortar && (
        <Link
          href={`/poema/${poema.id}`}
          className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-destaque hover:underline"
        >
          ler poema inteiro
        </Link>
      )}
    </>
  );
}

function RepostadoPor({ usuarios }: { usuarios: User[] }) {
  const [a, b] = usuarios;
  const resto = usuarios.length - 2;
  return (
    <p className="mb-1 flex items-center gap-3 text-[0.8125rem] font-semibold text-tinta-suave">
      <span className="flex w-10 shrink-0 justify-end">
        <IconeRepostar className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        repostado por <NomeLink usuario={a} />
        {b && (resto > 0 ? ", " : " e ")}
        {b && <NomeLink usuario={b} />}
        {resto > 0 && ` e mais ${resto}`}
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

function Autor({ autor, criadoEm, comAvatar }: { autor: User; criadoEm: string; comAvatar: boolean }) {
  const vida = anosDeVida(autor);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.9375rem] leading-5">
      {comAvatar && <Avatar usuario={autor} tamanho="p" />}
      <Link href={`/u/${autor.username}`} className="truncate font-bold hover:underline">
        {autor.name}
      </Link>
      {autor.consagrado && (
        <span className="rounded-full border border-destaque/60 px-1.5 text-[0.6875rem] leading-4 font-semibold tracking-wide text-destaque uppercase">
          Consagrado
        </span>
      )}
      <span className="truncate text-tinta-suave">@{autor.username}</span>
      {vida && <span className="text-tinta-suave tabular-nums">· {vida}</span>}
      {!autor.consagrado && (
        <time dateTime={criadoEm} className="text-tinta-suave tabular-nums">
          · {formatarData(criadoEm)}
        </time>
      )}
    </div>
  );
}

function Detalhes({ poema }: { poema: Post }) {
  const origem = [poema.obra, poema.ano].filter(Boolean).join(", ");
  if (!poema.forma && !origem && !poema.fonte && poema.tags.length === 0) return null;
  return (
    <div className="mt-3 space-y-1 text-[0.8125rem] text-tinta-suave">
      {(poema.forma || origem || poema.fonte) && (
        <p className="flex flex-wrap gap-x-3">
          {poema.forma && <span className="italic">{nomeDaForma(poema.forma)}</span>}
          {origem && <span>{origem}</span>}
          {poema.fonte && (
            <a href={poema.fonte} target="_blank" rel="noreferrer" className="underline">
              fonte
            </a>
          )}
        </p>
      )}
      {poema.tags.length > 0 && (
        <ul className="flex flex-wrap gap-x-2">
          {poema.tags.map((tag) => (
            <li key={tag}>
              <Link
                href={`/explorar?tag=${encodeURIComponent(tag)}`}
                className="text-destaque hover:underline"
              >
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Curtir e repostar mudam a tela antes da resposta e voltam atrás se o backend falhar.
function Acoes({ poema }: { poema: Post }) {
  const [curti, setCurti] = useState(poema.curti);
  const [curtidas, setCurtidas] = useState(poema.curtidas);
  const [repostei, setRepostei] = useState(poema.repostei);
  const [reposts, setReposts] = useState(poema.reposts);
  const [erro, setErro] = useState<string | null>(null);

  async function alternarCurtida() {
    const novo = !curti;
    setCurti(novo);
    setCurtidas((n) => n + (novo ? 1 : -1));
    setErro(null);
    try {
      await curtir(poema.id, novo);
    } catch (e) {
      setCurti(!novo);
      setCurtidas((n) => n + (novo ? -1 : 1));
      setErro(e instanceof Error ? e.message : "não deu para curtir");
    }
  }

  async function alternarRepost() {
    const novo = !repostei;
    setRepostei(novo);
    setReposts((n) => n + (novo ? 1 : -1));
    setErro(null);
    try {
      await repostar(poema.id, novo);
    } catch (e) {
      setRepostei(!novo);
      setReposts((n) => n + (novo ? -1 : 1));
      setErro(e instanceof Error ? e.message : "não deu para repostar");
    }
  }

  // Como no X: só ícone (20 px) e número, e o número some quando é zero. O nome
  // da ação vai no aria-label (com o número, que o aria-label esconderia) e no
  // title. Cada botão tem área de toque de 44×44 px; o -ml-3 da linha alinha o
  // primeiro ícone com o texto do poema. No hover, o círculo atrás do ícone tinge.
  const botao =
    "group inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1 pr-2 tabular-nums transition-colors duration-150 hover:text-destaque";
  const icone = "h-5 w-5";
  const circulo =
    "flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150 group-hover:bg-destaque/10";
  const rotulo = (acao: string, n?: number) => (n ? `${acao} (${n})` : acao);
  return (
    <div className="mt-1">
      <div className="-ml-3 flex max-w-sm justify-between text-[0.8125rem] text-tinta-suave">
        <button
          type="button"
          onClick={alternarCurtida}
          aria-pressed={curti}
          aria-label={rotulo("curtir", curtidas)}
          title="curtir"
          className={`${botao} ${curti ? "text-destaque" : ""}`}
        >
          <span className={circulo}>
            <IconeCurtir cheio={curti} className={icone} />
          </span>
          <Contador n={curtidas} />
        </button>
        <button
          type="button"
          onClick={alternarRepost}
          aria-pressed={repostei}
          aria-label={rotulo("repostar", reposts)}
          title="repostar"
          className={`${botao} ${repostei ? "text-destaque" : ""}`}
        >
          <span className={circulo}>
            <IconeRepostar className={icone} />
          </span>
          <Contador n={reposts} />
        </button>
        <Link href={`/escrever?citar=${poema.id}`} aria-label="citar" title="citar" className={botao}>
          <span className={circulo}>
            <IconeCitar className={icone} />
          </span>
        </Link>
        <Link
          href={`/poema/${poema.id}#comentarios`}
          aria-label={rotulo("comentar", poema.comentarios)}
          title="comentar"
          className={botao}
        >
          <span className={circulo}>
            <IconeComentar className={icone} />
          </span>
          <Contador n={poema.comentarios} />
        </Link>
      </div>
      {erro && <p className="mt-2 text-xs text-destaque">{erro}</p>}
    </div>
  );
}

function Contador({ n }: { n: number }) {
  return n > 0 ? <span aria-hidden="true">{n}</span> : null;
}
