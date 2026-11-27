"use client";
// Client component: as ações (curtir, repostar) têm estado otimista.

import Link from "next/link";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { BarraDeAcoes } from "@/components/BarraDeAcoes";
import { BarraDeVersos, useVersosSelecionados } from "@/components/BarraDeVersos";
import { useFolhas } from "@/components/CadernoFolhas";
import { FaixaDoAutor } from "@/components/FaixaDoAutor";
import { NomeAutor } from "@/components/NomeAutor";
import { RengaCard } from "@/components/RengaCard";
import { VersoFormatado } from "@/components/TextoFormatado";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { IconeRepostar } from "@/components/icones/IconeRepostar";
import { IconeTraduzir } from "@/components/icones/IconeTraduzir";
import {
  caminhoDaCitacaoDeVersos,
  caminhoDaCriticaDeVersos,
  caminhoDaTag,
  ErroDaApi,
  formatarData,
  hashtag,
  idiomaDoNavegador,
  mensagemDeFalha,
  nomeDoIdioma,
  rotuloDoComentario,
  traduzirPoema,
  trechoDosVersos,
  type Post,
  type Traducao,
  type User,
} from "@/lib/api";
import { noPlural } from "@/lib/numeros";
import { nomeDaForma } from "@/lib/vocabulario";
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
  // A página do poema no caderno (CadernoPoema.tsx): sem avatar, o título grande,
  // o autor discreto logo abaixo e os versos; a ficha (forma, tags) e as ações
  // ficam na página da direita.
  folha?: boolean;
};

export function PoemaCard({
  post,
  aninhado = false,
  linkarTitulo = true,
  inteiro = false,
  corpo,
  aoTraduzir,
  semCritica = false,
  folha = false,
}: Props) {
  // Repost puro (texto vazio) fora do feed: mostra o original com o aviso de quem repostou.
  const repostPuro = post.repost_de !== null && post.texto === "";
  const poema = repostPuro && post.repost_de ? post.repost_de : post;
  const reposters = repostPuro ? [post.autor] : (post.repostado_por ?? []);
  const citacao =
    !repostPuro &&
    (post.repost_de !== null || post.repost_removido || post.repost_indisponivel || Boolean(post.renga_citada_id));

  if (folha) {
    return (
      <article className="folha-poema">
        {reposters.length > 0 && (
          <RotuloDeAtividade
            icone={<IconeRepostar className="h-4 w-4" />}
            usuarios={reposters}
            antes="repostado por "
            solto
          />
        )}
        <ComentadoPor post={post} solto />
        <TextoDoPoema
          key={`texto-${poema.id}`}
          poema={poema}
          linkarTitulo={linkarTitulo}
          inteiro
          corpo={corpo}
          aoTraduzir={aoTraduzir}
          semCritica={semCritica}
          folha
          autor={<FaixaDoAutor autor={poema.autor} criadoEm={poema.created_at} />}
        />
        {citacao && (
          <div className="mt-6">
            <Citado poema={poema} inteiro />
          </div>
        )}
        <div className="mt-8 border-t border-borda/70 pt-3 empty:hidden">
          <Detalhes poema={poema} solto />
        </div>
        <ResumoDaConversa poema={poema} />
      </article>
    );
  }

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
              <Citado poema={poema} inteiro={inteiro} />
            </div>
          )}

          <Detalhes poema={poema} />

          {!aninhado && <Acoes key={poema.id} poema={poema} />}
        </div>
      </div>
    </article>
  );
}

// O que a citação cita: o poema, a renga (#171) ou o aviso de que não está mais lá.
function Citado({ poema, inteiro }: { poema: Post; inteiro: boolean }) {
  if (poema.repost_de) return <PoemaCard post={poema.repost_de} aninhado inteiro={inteiro} />;
  if (poema.renga_citada) return <RengaCard renga={poema.renga_citada} aninhado />;
  const renga = Boolean(poema.renga_citada_id);
  return (
    <p className="rounded-2xl border border-dashed border-borda p-4 text-sm text-tinta-suave italic">
      {poema.repost_indisponivel
        ? renga
          ? "renga indisponível"
          : "poema indisponível"
        : "poema removido pelo autor"}
    </p>
  );
}

// No celular, a conversa fica na página seguinte: o pé do poema traz as ações,
// para interagir sem virar a página, e um atalho que conta os comentários e leva
// até ela. Na página dupla tudo isso já está à vista na página da direita.
function ResumoDaConversa({ poema }: { poema: Post }) {
  const { duplo, mostrar } = useFolhas();
  if (duplo) return null;
  // Numa linha só, mesmo em 390 px: as curtidas já estão na fileira de ações acima.
  const n = poema.comentarios;
  const comentarios = n === 0 ? "nenhum comentário" : `${n} ${noPlural(n, "comentário", "comentários")}`;
  return (
    <>
      <div className="mt-6">
        <Acoes key={poema.id} poema={poema} />
      </div>
      <button
        type="button"
        onClick={() => mostrar("d")}
        className="mt-4 flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-borda px-4 text-left text-sm whitespace-nowrap transition-colors duration-150 hover:border-tinta-suave"
      >
        <IconeComentar className="h-[1.125rem] w-[1.125rem] shrink-0 text-tinta-suave" />
        <span className="min-w-0 truncate">
          <span className="text-tinta-suave tabular-nums">{comentarios}</span>
          <span className="text-tinta-suave"> · </span>
          <span className="font-semibold text-destaque">{poema.comentarios > 0 ? "ver a conversa" : "comentar"}</span>
        </span>
      </button>
    </>
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
  folha = false,
  autor,
}: {
  poema: Post;
  linkarTitulo: boolean;
  inteiro: boolean;
  corpo?: (poema: Post) => ReactNode;
  aoTraduzir?: () => void;
  semCritica: boolean;
  folha?: boolean;
  // Na folha, a linha do autor, entre o título e os versos.
  autor?: ReactNode;
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
  const classeDoTitulo = folha ? "poema-titulo poema-titulo-folha" : "poema-titulo mt-2";
  const titulo =
    exibido.titulo &&
    (linkarTitulo ? (
      <h2 className={classeDoTitulo} lang={lang}>
        <Link href={`/poema/${poema.id}`} className="hover:underline">
          {exibido.titulo}
        </Link>
      </h2>
    ) : (
      <h1 className={classeDoTitulo} lang={lang}>
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
      {autor}
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
  const { selecao, limpar, barra } = useVersosSelecionados(elemento, texto, criticavel);

  return (
    <>
      <p ref={elemento} lang={lang} className={`poema-corpo ${comTitulo ? "mt-2" : "mt-1"}${cortar ? " poema-cortado" : ""}`}>
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
        <BarraDeVersos
          texto={texto}
          selecao={selecao}
          barra={barra}
          caminhoDaCritica={caminhoDaCriticaDeVersos(id, texto, selecao)}
          caminhoDaCitacao={caminhoDaCitacaoDeVersos(id, trechoDosVersos(texto, selecao))}
          aoLimpar={limpar}
        />
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
  solto = false,
}: {
  icone: ReactNode;
  usuarios: User[];
  antes?: string;
  depois?: string;
  // Na folha não há a coluna do avatar: o ícone fica junto do texto.
  solto?: boolean;
}) {
  const [a, b] = usuarios;
  const resto = usuarios.length - 2;
  return (
    <p
      className={`flex items-center text-[0.8125rem] font-semibold text-tinta-suave ${solto ? "mb-4 gap-2" : "mb-1 gap-3"}`}
    >
      <span className={`flex shrink-0 justify-end ${solto ? "" : "w-10"}`}>{icone}</span>
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
function ComentadoPor({ post, solto = false }: { post: Post; solto?: boolean }) {
  const rotulo = rotuloDoComentario(post);
  if (!rotulo) return null;
  return (
    <RotuloDeAtividade
      icone={<IconeComentar className="h-4 w-4" />}
      usuarios={post.comentado_por ?? []}
      depois={` ${rotulo.verbo}`}
      solto={solto}
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

// `solto`: na folha, sem a margem de cima (a página já separa a ficha do poema).
export function Detalhes({ poema, solto = false }: { poema: Post; solto?: boolean }) {
  const origem = [poema.obra, poema.ano].filter(Boolean).join(", ");
  if (!poema.forma && !origem && !poema.fonte && poema.tags.length === 0) return null;
  return (
    <div className={`${solto ? "" : "mt-3"} space-y-1 text-[0.8125rem] text-tinta-suave`}>
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
                {hashtag(tag)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// As ações do poema na barra do card e na página da conversa (BarraDeAcoes).
export function Acoes({ poema, contadores = false }: { poema: Post; contadores?: boolean }) {
  return (
    <BarraDeAcoes
      alvo={{ tipo: "poema", id: poema.id }}
      inicial={poema}
      comentarios={poema.comentarios}
      caminhoDaConversa={`/poema/${poema.id}#comentarios`}
      contadores={contadores}
    />
  );
}
