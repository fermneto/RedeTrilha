"use client";
// Client component: as ações (curtir, repostar) têm estado otimista.

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";

import { AntologiaSeletor } from "@/components/AntologiaSeletor";
import { Avatar } from "@/components/Avatar";
import { NomeAutor } from "@/components/NomeAutor";
import { IconeCitar } from "@/components/icones/IconeCitar";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { IconeCurtir } from "@/components/icones/IconeCurtir";
import { IconeRepostar } from "@/components/icones/IconeRepostar";
import { IconeTraduzir } from "@/components/icones/IconeTraduzir";
import {
  caminhoDaTag,
  curtir,
  ErroDaApi,
  formatarData,
  idiomaDoNavegador,
  nomeDaForma,
  nomeDoIdioma,
  repostar,
  traduzirPoema,
  type Post,
  type Traducao,
  type User,
} from "@/lib/api";

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
  // Troca o corpo do poema (na página dele, os versos que se selecionam, #71).
  corpo?: (poema: Post) => ReactNode;
};

export function PoemaCard({ post, aninhado = false, linkarTitulo = true, inteiro = false, corpo }: Props) {
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

          {poema.texto && (corpo ? corpo(poema) : <Corpo poema={poema} inteiro={inteiro} />)}

          {poema.texto && <Traduzir key={`traduzir-${poema.id}`} poema={poema} />}

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

// "Traduzir", como no X: aparece quando a língua do poema é conhecida e diferente
// da do navegador. A tradução vem do backend (IA, com cache por poema e língua) e
// fica abaixo do original; "ver original" recolhe sem perder o que já veio.
function Traduzir({ poema }: { poema: Post }) {
  // A língua do navegador só existe no cliente: lida depois de montar, para o HTML
  // do servidor e o da hidratação baterem.
  const [destino, setDestino] = useState<string | null>(null);
  const [traducao, setTraducao] = useState<Traducao | null>(null);
  const [aberta, setAberta] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setDestino(idiomaDoNavegador()), []);

  if (!poema.idioma || !destino || poema.idioma === destino) return null;

  async function abrir() {
    setErro(null);
    if (traducao) {
      setAberta(true);
      return;
    }
    setCarregando(true);
    try {
      setTraducao(await traduzirPoema(poema.id, destino as string));
      setAberta(true);
    } catch (e) {
      if (e instanceof ErroDaApi && e.status === 503) setErro("tradução indisponível agora");
      else if (e instanceof ErroDaApi && e.status === 429) setErro("limite de traduções atingido, tente mais tarde");
      else setErro(e instanceof Error ? e.message : "não deu para traduzir");
    } finally {
      setCarregando(false);
    }
  }

  const link =
    "inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-destaque hover:underline";

  if (aberta && traducao) {
    return (
      <section aria-label="tradução" className="mt-2 border-t border-borda pt-2">
        <p className="flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-tinta-suave">
          <span>Traduzido do {nomeDoIdioma(poema.idioma)} por IA</span>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={() => setAberta(false)} className={link}>
            ver original
          </button>
        </p>
        {traducao.titulo && <p className="poema-titulo mt-1">{traducao.titulo}</p>}
        <p lang={traducao.idioma_destino} className={`poema-corpo ${traducao.titulo ? "mt-2" : "mt-1"}`}>
          {traducao.texto}
        </p>
      </section>
    );
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={abrir}
        disabled={carregando}
        aria-label={`traduzir do ${nomeDoIdioma(poema.idioma)}`}
        className={`${link} -ml-3 gap-1 pr-2 disabled:cursor-wait disabled:opacity-60`}
      >
        <span className="flex h-11 w-11 items-center justify-center">
          <IconeTraduzir className="h-5 w-5" />
        </span>
        {carregando ? "Traduzindo…" : "Traduzir"}
      </button>
      {erro && <p className="text-xs text-destaque">{erro}</p>}
    </div>
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

// Consagrado: selo depois do nome; os anos de vida ficam no tooltip do selo e no
// perfil, e não há data (a do poema é a da importação, não a da obra).
function Autor({ autor, criadoEm, comAvatar }: { autor: User; criadoEm: string; comAvatar: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.9375rem] leading-5">
      {comAvatar && <Avatar usuario={autor} tamanho="p" />}
      <NomeAutor usuario={autor} />
      <span className="truncate text-tinta-suave">@{autor.username}</span>
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
                href={caminhoDaTag(tag)}
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
        <AntologiaSeletor postId={poema.id} classeBotao={botao} classeCirculo={circulo} classeIcone={icone} />
      </div>
      {erro && <p className="mt-2 text-xs text-destaque">{erro}</p>}
    </div>
  );
}

function Contador({ n }: { n: number }) {
  return n > 0 ? <span aria-hidden="true">{n}</span> : null;
}
