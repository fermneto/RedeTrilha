"use client";
// Client component: as ações (curtir, repostar) têm estado otimista.

import Link from "next/link";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";

import { AntologiaSeletor } from "@/components/AntologiaSeletor";
import { Avatar } from "@/components/Avatar";
import { EnviarPorMensagem } from "@/components/EnviarPorMensagem";
import { NomeAutor } from "@/components/NomeAutor";
import { VersoFormatado } from "@/components/TextoFormatado";
import { CLASSE_DA_ACAO_DE_VERSOS, CLASSE_DA_BARRA_DE_VERSOS } from "@/components/VersosComentaveis";
import { IconeCitar } from "@/components/icones/IconeCitar";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { IconeCurtir } from "@/components/icones/IconeCurtir";
import { IconeRepostar } from "@/components/icones/IconeRepostar";
import { IconeTraduzir } from "@/components/icones/IconeTraduzir";
import {
  caminhoDaCitacaoDeVersos,
  caminhoDaCriticaDeVersos,
  caminhoDaTag,
  curtir,
  ErroDaApi,
  formatarData,
  idiomaDoNavegador,
  mensagemDeFalha,
  nomeDaForma,
  nomeDoIdioma,
  referenciaDosVersos,
  repostar,
  rotuloDoComentario,
  traduzirPoema,
  trechoDosVersos,
  versosDaSelecao,
  versosTocados,
  type Post,
  type SelecaoDeVersos,
  type Traducao,
  type User,
} from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";
import {
  alternarTraducao,
  type EstadoDaTraducao,
  rotuloDoBotao,
  SEM_TRADUCAO,
  textoExibido,
  traducaoChegou,
  traducaoFalhou,
} from "@/lib/traducao";

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
  // A tradução entrou na tela: na página do poema, limpa a seleção de versos,
  // que é do original.
  aoTraduzir?: () => void;
  // Sem a barra "comentar estes versos" ao selecionar o corpo (o original na
  // prévia do compositor: o link tiraria o leitor da citação que ele escreve).
  semCritica?: boolean;
};

export function PoemaCard({
  post,
  aninhado = false,
  linkarTitulo = true,
  inteiro = false,
  corpo,
  aoTraduzir,
  semCritica = false,
}: Props) {
  // Repost puro (texto vazio) fora do feed: mostra o original com o aviso de quem repostou.
  const repostPuro = post.repost_de !== null && post.texto === "";
  const poema = repostPuro && post.repost_de ? post.repost_de : post;
  const reposters = repostPuro ? [post.autor] : (post.repostado_por ?? []);
  const citacao = !repostPuro && (post.repost_de !== null || post.repost_removido || post.repost_indisponivel);

  // Fora de uma citação: avatar numa coluna à esquerda e tudo o mais alinhado ao
  // texto, à direita. Na citação, o avatar pequeno vai na linha do nome.
  return (
    <article
      className={aninhado ? "rounded-2xl border border-borda p-3" : "px-4 pt-3 pb-1"}
    >
      {!aninhado && reposters.length > 0 && (
        <RotuloDeAtividade
          icone={<IconeRepostar className="h-4 w-4" />}
          usuarios={reposters}
          antes="repostado por "
        />
      )}
      {!aninhado && <ComentadoPor post={post} />}

      <div className="flex gap-3">
        {!aninhado && (
          <Link href={`/u/${poema.autor.username}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
            <Avatar usuario={poema.autor} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <Autor autor={poema.autor} criadoEm={poema.created_at} comAvatar={aninhado} />

          <TextoDoPoema
            key={`texto-${poema.id}`}
            poema={poema}
            linkarTitulo={linkarTitulo}
            inteiro={inteiro}
            corpo={corpo}
            aoTraduzir={aoTraduzir}
            semCritica={semCritica}
          />

          {citacao && !aninhado && (
            <div className="mt-3">
              {poema.repost_de ? (
                <PoemaCard post={poema.repost_de} aninhado inteiro={inteiro} />
              ) : (
                <p className="rounded-2xl border border-dashed border-borda p-4 text-sm text-tinta-suave italic">
                  {poema.repost_indisponivel ? "poema indisponível" : "poema removido pelo autor"}
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

// Título, corpo e "Traduzir" (decisão 2). A tradução toma o lugar do original no
// mesmo ponto do card, com "Traduzido do {língua} por IA · ver original" logo
// abaixo; a que já veio fica guardada e "ver tradução" a mostra sem chamar a API.
// Na página do poema, a tradução aparece como texto corrido: a seleção de versos
// e as marcas de crítica são do original e voltam com "ver original".
function TextoDoPoema({
  poema,
  linkarTitulo,
  inteiro,
  corpo,
  aoTraduzir,
  semCritica,
}: {
  poema: Post;
  linkarTitulo: boolean;
  inteiro: boolean;
  corpo?: (poema: Post) => ReactNode;
  aoTraduzir?: () => void;
  semCritica: boolean;
}) {
  // A língua do navegador só existe no cliente: lida depois de montar, para o HTML
  // do servidor e o da hidratação baterem.
  const [destino, setDestino] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDaTraducao<Traducao>>(SEM_TRADUCAO);
  // Só anuncia depois de um clique: o leitor de tela não ouve nada ao carregar a página.
  const [aviso, setAviso] = useState("");

  useEffect(() => setDestino(idiomaDoNavegador()), []);

  const traduzivel = Boolean(poema.texto && poema.idioma && destino && poema.idioma !== destino);
  const exibido = textoExibido({ titulo: poema.titulo, texto: poema.texto }, estado);
  const lingua = poema.idioma ? nomeDoIdioma(poema.idioma) : "";

  async function alternar() {
    const { estado: proximo, buscar } = alternarTraducao(estado);
    setEstado(proximo);
    if (!buscar) {
      if (proximo.mostrando) aoTraduzir?.();
      setAviso(proximo.mostrando ? `mostrando a tradução do ${lingua}, feita por IA` : "mostrando o original");
      return;
    }
    try {
      const traducao = await traduzirPoema(poema.id, destino as string);
      setEstado((atual) => traducaoChegou(atual, traducao));
      aoTraduzir?.();
      setAviso(`mostrando a tradução do ${lingua}, feita por IA`);
    } catch (e) {
      let erro: string;
      if (e instanceof ErroDaApi && e.status === 503) erro = "tradução indisponível agora";
      else if (e instanceof ErroDaApi && e.status === 429) erro = "limite de traduções atingido, tente mais tarde";
      else erro = mensagemDeFalha(e, "não deu para traduzir");
      setEstado((atual) => traducaoFalhou(atual, erro));
      setAviso(erro);
    }
  }

  const lang = exibido.lang ?? undefined;
  const titulo =
    exibido.titulo &&
    (linkarTitulo ? (
      <h2 className="poema-titulo mt-2" lang={lang}>
        <Link href={`/poema/${poema.id}`} className="hover:underline">
          {exibido.titulo}
        </Link>
      </h2>
    ) : (
      <h1 className="poema-titulo mt-2" lang={lang}>
        {exibido.titulo}
      </h1>
    ));

  let texto: ReactNode = null;
  if (poema.texto) {
    texto =
      corpo && !exibido.traduzido ? (
        corpo(poema)
      ) : (
        <Corpo
          id={poema.id}
          texto={exibido.texto}
          comTitulo={Boolean(exibido.titulo)}
          inteiro={inteiro}
          lang={lang}
          // A seleção é de versos do original: com a tradução na tela, nada de barra.
          criticavel={!semCritica && !exibido.traduzido}
        />
      );
  }

  const link =
    "inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-destaque hover:underline";

  return (
    <>
      {titulo}
      {texto}
      {traduzivel && (
        <div className="mt-1">
          {/* Um botão só, que troca de texto: o foco fica nele ao alternar. */}
          <p className="flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-tinta-suave">
            {exibido.traduzido && (
              <>
                <span>Traduzido do {lingua} por IA</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <button
              type="button"
              onClick={alternar}
              // aria-disabled, não disabled: o botão desabilitado perde o foco, e o foco
              // tem de continuar nele quando a tradução chega. O clique é ignorado ao carregar.
              aria-disabled={estado.carregando}
              aria-label={exibido.traduzido ? undefined : `${rotuloDoBotao(estado).replace("…", "")} do ${lingua}`}
              className={`${link} ${exibido.traduzido ? "" : "-ml-3 gap-1 pr-2"} aria-disabled:cursor-wait aria-disabled:opacity-60`}
            >
              {!exibido.traduzido && (
                <span className="flex h-11 w-11 items-center justify-center">
                  <IconeTraduzir className="h-5 w-5" />
                </span>
              )}
              {rotuloDoBotao(estado)}
            </button>
          </p>
          {exibido.traduzido && corpo && (
            <p className="text-xs text-tinta-suave">
              Para comentar ou citar versos, ou ver as críticas de cada verso, volte ao original.
            </p>
          )}
          {estado.erro && <p className="text-xs text-destaque">{estado.erro}</p>}
          <p className="sr-only" aria-live="polite">
            {aviso}
          </p>
        </div>
      )}
    </>
  );
}

// Corta só a exibição: o texto do poema não muda, e o link leva à versão inteira.
// Cada linha leva o número dela no poema inteiro (o corte só esconde o fim; as
// linhas em branco contam, como na página e no backend). Selecionar o texto
// (mouse ou toque) mostra a barra "comentar estes versos / citar estes versos":
// comentar abre a página do poema com eles selecionados (#71); a crítica é lá.
// A barra some com "limpar", Esc ou um toque fora dela.
function Corpo({
  id,
  texto,
  comTitulo,
  inteiro,
  lang,
  criticavel,
}: {
  id: number;
  texto: string;
  comTitulo: boolean;
  inteiro: boolean;
  lang?: string;
  criticavel: boolean;
}) {
  const versos = texto.split("\n");
  const visiveis = inteiro ? null : linhasVisiveis(versos);
  const cortar = visiveis !== null;
  const mostrados = cortar ? versos.slice(0, visiveis) : versos;
  const elemento = useRef<HTMLParagraphElement>(null);
  const barra = useRef<HTMLDivElement>(null);
  const [selecao, setSelecao] = useState<SelecaoDeVersos | null>(null);

  // Só a seleção que começa neste corpo conta: a de fora (ou a que começa noutro
  // card) não mexe aqui. Seleção recolhida não apaga a barra: no toque, ela se
  // desfaz no mesmo toque que vai à barra; quem apaga é o toque fora dela.
  useEffect(() => {
    if (!criticavel) return;
    function aoMudarSelecao() {
      const doc = document.getSelection();
      const p = elemento.current;
      if (!doc || !p || doc.isCollapsed || !doc.anchorNode || !p.contains(doc.anchorNode)) return;
      const nova = versosDaSelecao(
        textoSemMarcas(texto),
        versosTocados(doc, p.querySelectorAll<HTMLElement>("[data-verso]")),
      );
      setSelecao((atual) => (nova && atual?.inicio === nova.inicio && atual.fim === nova.fim ? atual : nova));
    }
    document.addEventListener("selectionchange", aoMudarSelecao);
    return () => document.removeEventListener("selectionchange", aoMudarSelecao);
  }, [criticavel, texto]);

  useEffect(() => {
    if (!selecao) return;
    function aoTocar(e: PointerEvent) {
      if (!barra.current?.contains(e.target as Node)) setSelecao(null);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      document.getSelection()?.removeAllRanges();
      setSelecao(null);
    }
    document.addEventListener("pointerdown", aoTocar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoTocar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [selecao]);

  return (
    <>
      <p ref={elemento} lang={lang} className={`poema-corpo ${comTitulo ? "mt-2" : "mt-1"}`}>
        {mostrados.map((linha, i) => (
          <Fragment key={i}>
            {i > 0 && "\n"}
            <span data-verso={i + 1}>
              <VersoFormatado linha={linha} />
            </span>
          </Fragment>
        ))}
      </p>
      {criticavel && selecao && (
        <div ref={barra} role="group" aria-label="versos selecionados" className={CLASSE_DA_BARRA_DE_VERSOS}>
          <span className="px-1 text-sm text-tinta-suave">{referenciaDosVersos(selecao)}</span>
          <Link href={caminhoDaCriticaDeVersos(id, selecao)} className={CLASSE_DA_ACAO_DE_VERSOS}>
            comentar estes versos
          </Link>
          <Link href={caminhoDaCitacaoDeVersos(id, trechoDosVersos(texto, selecao))} className={CLASSE_DA_ACAO_DE_VERSOS}>
            citar estes versos
          </Link>
          <button
            type="button"
            onClick={() => {
              document.getSelection()?.removeAllRanges();
              setSelecao(null);
            }}
            className={`${CLASSE_DA_ACAO_DE_VERSOS} text-tinta-suave`}
          >
            limpar
          </button>
        </div>
      )}
      {cortar && (
        <Link
          href={`/poema/${id}`}
          className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-destaque hover:underline"
        >
          ler poema inteiro
        </Link>
      )}
    </>
  );
}

// A linha acima do poema, como no X: ícone numa coluna do tamanho do avatar e os
// nomes ("ana", "ana e bia", "ana, bia e mais 2") entre o texto de antes e o de depois.
function RotuloDeAtividade({
  icone,
  usuarios,
  antes = "",
  depois = "",
}: {
  icone: ReactNode;
  usuarios: User[];
  antes?: string;
  depois?: string;
}) {
  const [a, b] = usuarios;
  const resto = usuarios.length - 2;
  return (
    <p className="mb-1 flex items-center gap-3 text-[0.8125rem] font-semibold text-tinta-suave">
      <span className="flex w-10 shrink-0 justify-end">{icone}</span>
      <span className="min-w-0">
        {antes}
        <NomeLink usuario={a} />
        {b && (resto > 0 ? ", " : " e ")}
        {b && <NomeLink usuario={b} />}
        {resto > 0 && ` e mais ${resto}`}
        {depois}
      </span>
    </p>
  );
}

// Só no "Para você": o poema subiu por um comentário ou crítica, como o "repostado
// por" do X ("ana comentou", "ana e bia criticaram os versos").
function ComentadoPor({ post }: { post: Post }) {
  const rotulo = rotuloDoComentario(post);
  if (!rotulo) return null;
  return (
    <RotuloDeAtividade
      icone={<IconeComentar className="h-4 w-4" />}
      usuarios={post.comentado_por ?? []}
      depois={` ${rotulo.verbo}`}
    />
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
// Enquanto um pedido da ação está em voo, novos cliques nela são ignorados: dois
// pedidos simultâneos podem ser processados fora de ordem e deixar a tela
// diferente do servidor.
function Acoes({ poema }: { poema: Post }) {
  const [curti, setCurti] = useState(poema.curti);
  const [curtidas, setCurtidas] = useState(poema.curtidas);
  const [repostei, setRepostei] = useState(poema.repostei);
  const [reposts, setReposts] = useState(poema.reposts);
  const [erro, setErro] = useState<string | null>(null);
  const curtindo = useRef(false);
  const repostando = useRef(false);

  async function alternarCurtida() {
    if (curtindo.current) return;
    curtindo.current = true;
    const novo = !curti;
    setCurti(novo);
    setCurtidas((n) => n + (novo ? 1 : -1));
    setErro(null);
    try {
      await curtir(poema.id, novo);
    } catch (e) {
      setCurti(!novo);
      setCurtidas((n) => n + (novo ? -1 : 1));
      setErro(mensagemDeFalha(e, "não deu para curtir"));
    } finally {
      curtindo.current = false;
    }
  }

  async function alternarRepost() {
    if (repostando.current) return;
    repostando.current = true;
    const novo = !repostei;
    setRepostei(novo);
    setReposts((n) => n + (novo ? 1 : -1));
    setErro(null);
    try {
      await repostar(poema.id, novo);
    } catch (e) {
      setRepostei(!novo);
      setReposts((n) => n + (novo ? -1 : 1));
      setErro(mensagemDeFalha(e, "não deu para repostar"));
    } finally {
      repostando.current = false;
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
        <EnviarPorMensagem postId={poema.id} classeBotao={botao} classeCirculo={circulo} classeIcone={icone} />
      </div>
      {erro && <p className="mt-2 text-xs text-destaque">{erro}</p>}
    </div>
  );
}

function Contador({ n }: { n: number }) {
  return n > 0 ? <span aria-hidden="true">{n}</span> : null;
}
