"use client";
// Árvore de comentários carregada como no X: as raízes vêm por página (cursor),
// cada uma com a prévia de até 3 respostas, recursivamente; o resto de cada nó
// vem em "ver mais respostas". Cada comentário renderiza as próprias respostas
// (recursão) e pode ser respondido em qualquer nível.
// Crítica ancorada (#71): com versos selecionados no poema, o comentário de 1º
// nível vai sobre eles e mostra o trecho citado; com `verso`, só aparecem as
// críticas daquele verso.
// O alvo é um poema ou uma renga (aberta ou fechada): as rotas mudam, as regras não.
// Como uma conversa de rede social: avatar, nome e @ em cada comentário, as
// respostas penduradas no fio que desce do avatar de quem foi respondido. Com
// `campoNoPe` (a página da conversa no livro), o campo de comentar fica preso no
// pé da página, sempre à vista; sem ele, no alto, antes dos comentários.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { ConfirmacaoInline } from "@/components/ConfirmacaoInline";
import { EsqueletoDeComentarios } from "@/components/Esqueleto";
import { NomeAutor } from "@/components/NomeAutor";
import { TextoFormatado } from "@/components/TextoFormatado";
import {
  ancoraCobreOVerso,
  apagarComentario,
  buscarComentarios,
  buscarComentariosDoVerso,
  buscarRespostas,
  comentar,
  criticarVersos,
  formatarData,
  mensagemDeFalha,
  numeroDoVerso,
  referenciaDosVersos,
  trechoDosVersos,
  type AlvoDosComentarios,
  type Ancora,
  type ComentarioNaArvore as Comentario,
  type SelecaoDeVersos,
  type User,
} from "@/lib/api";
import { noPlural } from "@/lib/numeros";

// Id do campo de comentário no poema: "comentar estes versos" leva o foco até ele.
export const ID_DO_CAMPO_DE_COMENTARIO = "comentar-poema";

type Props = {
  alvo: AlvoDosComentarios;
  // Id do usuário da sessão: só o autor vê "apagar".
  euId: number | null;
  // Chamado depois de comentar ou apagar, para a página atualizar o contador e as marcas.
  aoMudar: () => void;
  // Texto do poema (ou da renga) e versos selecionados nele: o próximo comentário vai sobre eles.
  textoDoPoema: string;
  selecao: SelecaoDeVersos | null;
  aoLimparSelecao: () => void;
  // Filtro da marca no verso: null mostra todos os comentários.
  verso: number | null;
  aoLimparFiltro: () => void;
  // O campo de comentar preso no pé da página (ver o topo do arquivo).
  campoNoPe?: boolean;
  // Quantos comentários o alvo tem, para o título ("Comentários · 12").
  total?: number;
};

// Junta listas sem repetir comentário (a primeira página de respostas repete a prévia).
function semRepetir(atuais: Comentario[], novos: Comentario[]): Comentario[] {
  const vistos = new Set(atuais.map((c) => c.id));
  return [...atuais, ...novos.filter((c) => !vistos.has(c.id))];
}

// A partir deste nível as respostas param de recuar (alinham no 4º), mas
// continuam com a linha da árvore à esquerda.
const NIVEL_MAXIMO_DE_RECUO = 4;

export function ArvoreComentarios({
  alvo,
  euId,
  aoMudar,
  textoDoPoema,
  selecao,
  aoLimparSelecao,
  verso,
  aoLimparFiltro,
  campoNoPe = false,
  total,
}: Props) {
  const [raizes, setRaizes] = useState<Comentario[]>([]);
  // Comentários que o usuário acabou de publicar: no topo, mais novo primeiro,
  // com destaque. Ao recarregar a página, voltam à ordem cronológica.
  const [meusNovos, setMeusNovos] = useState<Comentario[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (depois: string | null) => {
      setCarregando(true);
      try {
        const pagina =
          verso === null
            ? await buscarComentarios(alvo, depois)
            : await buscarComentariosDoVerso(alvo, verso, depois);
        setRaizes((atuais) => (depois === null ? pagina.items : semRepetir(atuais, pagina.items)));
        setCursor(pagina.proximo_cursor);
        setErro(null);
      } catch (e) {
        setErro(mensagemDeFalha(e, "não deu para carregar os comentários"));
      } finally {
        setCarregando(false);
      }
    },
    [alvo.tipo, alvo.id, verso],
  );

  useEffect(() => {
    carregar(null);
  }, [carregar]);

  // Um comentário novo pode chegar de novo numa página carregada depois: fica só no topo.
  const idsNovos = new Set(meusNovos.map((c) => c.id));
  const visiveis = [
    ...meusNovos.filter((c) => ancoraCobreOVerso(c.ancora, verso)),
    ...raizes.filter((c) => !idsNovos.has(c.id)),
  ];

  const campo = (
    <FormComentario
      alvo={alvo}
      parentId={null}
      selecao={selecao}
      textoDoPoema={textoDoPoema}
      trecho={selecao && trechoDosVersos(textoDoPoema, selecao)}
      aoLimparSelecao={aoLimparSelecao}
      aoComentar={(novo) => {
        setMeusNovos((atuais) => [novo, ...atuais]);
        aoLimparSelecao();
        aoMudar();
      }}
    />
  );

  return (
    <section id="comentarios" className={campoNoPe ? "flex flex-1 flex-col" : "space-y-4"}>
      <h2 className="flex items-baseline gap-2 text-base">
        Comentários
        {total !== undefined && total > 0 && (
          <span className="text-sm font-normal text-tinta-suave tabular-nums">{total}</span>
        )}
      </h2>
      {!campoNoPe && campo}
      <div className={campoNoPe ? "mt-5 flex-1 space-y-4" : "space-y-4"}>
        {verso !== null && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave">
            <span>Comentários sobre o verso {numeroDoVerso(textoDoPoema, verso)}</span>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={aoLimparFiltro} className="cursor-pointer underline hover:text-tinta">
              ver todos os comentários
            </button>
          </p>
        )}
        {erro && <p className="text-sm text-destaque">{erro}</p>}
        {visiveis.length === 0 && carregando ? (
          <EsqueletoDeComentarios />
        ) : visiveis.length === 0 && !erro ? (
          <p className="py-6 text-sm text-tinta-suave">
            Ninguém comentou ainda. Diga o que este poema fez com você, ou selecione versos para comentar um trecho.
          </p>
        ) : (
          <ListaComentarios
            alvo={alvo}
            comentarios={visiveis}
            destacados={idsNovos}
            textoDoPoema={textoDoPoema}
            nivel={0}
            euId={euId}
            aoMudar={aoMudar}
            aoSumir={(id) => {
              setMeusNovos((atuais) => atuais.filter((c) => c.id !== id));
              setRaizes((atuais) => atuais.filter((c) => c.id !== id));
            }}
          />
        )}
        {cursor && (
          <button
            type="button"
            onClick={() => carregar(cursor)}
            disabled={carregando}
            className="min-h-11 cursor-pointer text-sm font-semibold text-destaque hover:underline disabled:opacity-50"
          >
            {carregando ? "carregando..." : "carregar mais comentários"}
          </button>
        )}
      </div>
      {campoNoPe && (
        // Preso no pé da página que rola: o papel por baixo esconde a conversa
        // que passa atrás dele, com um degradê curto no alto.
        <div className="pe-da-conversa sticky bottom-0 z-10 mt-6 pt-5 pb-1">{campo}</div>
      )}
    </section>
  );
}

type PropsLista = {
  alvo: AlvoDosComentarios;
  comentarios: Comentario[];
  // O texto em que as âncoras contam as linhas, para mostrar os números de verso.
  textoDoPoema: string;
  // Nível na árvore: 0 = comentário direto no poema.
  nivel: number;
  // Autor do comentário pai (null se o pai foi removido; undefined na raiz).
  // Depois do recuo máximo, a resposta mostra "↳ respondendo a @fulano".
  autorDoPai?: User | null;
  // Comentários recém-publicados pelo usuário, com o destaque "seu comentário".
  destacados?: Set<number>;
  euId: number | null;
  aoMudar: () => void;
  // Um comentário sem respostas apagado sai do banco: some da lista do pai.
  aoSumir: (id: number) => void;
};

function ListaComentarios({ comentarios, destacados, ...resto }: PropsLista) {
  return (
    <ul className="space-y-5">
      {comentarios.map((c) => (
        <li key={c.id}>
          <ItemComentario comentario={c} novo={destacados?.has(c.id) ?? false} {...resto} />
        </li>
      ))}
    </ul>
  );
}

function ItemComentario({
  alvo,
  comentario,
  novo,
  textoDoPoema,
  nivel,
  autorDoPai,
  euId,
  aoMudar,
  aoSumir,
}: Omit<PropsLista, "comentarios" | "destacados"> & { comentario: Comentario; novo: boolean }) {
  const [removido, setRemovido] = useState(comentario.removido);
  const [respostas, setRespostas] = useState(comentario.respostas);
  const [total, setTotal] = useState(comentario.total_respostas);
  // undefined: ainda não pediu /respostas; null: já carregou tudo.
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [respondendo, setRespondendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const faltam = total - respostas.length;
  const autor = removido ? null : comentario.autor;

  async function verMais() {
    setOcupado(true);
    try {
      const pagina = await buscarRespostas(alvo, comentario.id, cursor ?? null);
      setRespostas((atuais) => semRepetir(atuais, pagina.items));
      setTotal(pagina.total);
      setCursor(pagina.proximo_cursor);
      setErro(null);
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para carregar as respostas"));
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    setOcupado(true);
    try {
      // Com respostas, o backend deixa o marcador; sem, o comentário sai do banco.
      // A resposta diz qual dos dois e traz o total atual, que pode ser maior que
      // o da tela (alguém respondeu depois): aí aparece o "ver mais respostas".
      const { resultado, total_respostas } = await apagarComentario(alvo, comentario.id);
      if (resultado === "apagado") {
        aoSumir(comentario.id);
      } else {
        setRemovido(true);
        setTotal(total_respostas);
      }
      aoMudar();
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para apagar"));
    } finally {
      setOcupado(false);
    }
  }

  function removerResposta(id: number) {
    setRespostas((atuais) => atuais.filter((c) => c.id !== id));
    setTotal((n) => n - 1);
  }

  const acao = "-my-2 min-h-9 cursor-pointer text-xs font-semibold text-tinta-suave hover:text-tinta disabled:opacity-50";
  // Até NIVEL_MAXIMO_DE_RECUO cada nível recua para baixo do texto do pai; depois,
  // as respostas alinham com o pai (o "respondendo a @fulano" diz a quem).
  const recua = nivel + 1 <= NIVEL_MAXIMO_DE_RECUO;
  const temFio = respostas.length > 0 || faltam > 0 || (respondendo && !removido);
  return (
    <div className="relative">
      {/* O fio da conversa: desce do avatar até as respostas. */}
      {temFio && recua && (
        <span aria-hidden="true" className="absolute top-10 bottom-0 left-4 w-px -translate-x-1/2 bg-borda" />
      )}
      <div className={`flex gap-3 ${novo ? "-mx-2 rounded-lg bg-destaque/6 px-2 py-2" : ""}`}>
        {removido || !autor ? (
          <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full border border-dashed border-borda" />
        ) : (
          <Link href={`/u/${autor.username}`} tabIndex={-1} aria-hidden="true" className="relative shrink-0">
            <Avatar usuario={autor} tamanho="p" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {nivel > NIVEL_MAXIMO_DE_RECUO && autorDoPai !== undefined && (
            <p className="mb-0.5 text-xs text-tinta-suave">
              respondendo a{" "}
              {autorDoPai ? (
                <Link href={`/u/${autorDoPai.username}`} className="hover:underline">
                  @{autorDoPai.username}
                </Link>
              ) : (
                "um comentário removido"
              )}
            </p>
          )}
          {removido || !autor ? (
            <p className="pt-1.5 text-sm text-tinta-suave italic">comentário removido</p>
          ) : (
            <>
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[0.8125rem] leading-5 text-tinta-suave">
                <NomeAutor usuario={autor} className="font-semibold text-tinta" />
                <span className="hidden truncate sm:inline">@{autor.username}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={comentario.created_at} className="tabular-nums">
                  {formatarData(comentario.created_at)}
                </time>
                {novo && <span className="font-semibold text-destaque">· seu comentário</span>}
              </p>
              {comentario.ancora && <TrechoCitado ancora={comentario.ancora} textoDoPoema={textoDoPoema} />}
              <p className="mt-0.5 text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap">
                {comentario.texto}
              </p>
              <div className="mt-1.5 flex gap-5">
                <button type="button" onClick={() => setRespondendo((r) => !r)} className={acao}>
                  {respondendo ? "cancelar" : "responder"}
                </button>
                {total > 0 && !respondendo && respostas.length === 0 && (
                  <span className="text-xs text-tinta-suave">
                    {total} {noPlural(total, "resposta", "respostas")}
                  </span>
                )}
                {euId === autor.id && (
                  // "apagar" pede confirmação ali mesmo: vira "apagar? sim / não".
                  <ConfirmacaoInline
                    pergunta="apagar?"
                    rotulo="apagar"
                    classeDoBotao={acao}
                    aoConfirmar={apagar}
                    desabilitado={ocupado}
                    compacta
                    devolverFoco={false}
                  />
                )}
              </div>
            </>
          )}
          {erro && <p className="mt-1 text-xs text-destaque">{erro}</p>}
        </div>
      </div>
      {respondendo && !removido && (
        <div className={`mt-3 ${recua ? "pl-11" : ""}`}>
          <FormComentario
            alvo={alvo}
            parentId={comentario.id}
            paraQuem={autor?.username}
            aoComentar={(novo) => {
              setRespostas((atuais) => semRepetir(atuais, [novo]));
              setTotal((n) => n + 1);
              setRespondendo(false);
              aoMudar();
            }}
          />
        </div>
      )}
      {(respostas.length > 0 || faltam > 0) && (
        <div className={`mt-4 space-y-4 ${recua ? "pl-11" : ""}`}>
          <ListaComentarios
            alvo={alvo}
            comentarios={respostas}
            textoDoPoema={textoDoPoema}
            nivel={nivel + 1}
            autorDoPai={autor}
            euId={euId}
            aoMudar={aoMudar}
            aoSumir={removerResposta}
          />
          {faltam > 0 && cursor !== null && (
            <button type="button" onClick={verMais} disabled={ocupado} className={`${acao} text-destaque`}>
              {ocupado ? "carregando..." : `ver mais ${faltam} ${noPlural(faltam, "resposta", "respostas")}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// O trecho que a crítica comenta, acima do texto dela, com as quebras do poema.
function TrechoCitado({ ancora, textoDoPoema }: { ancora: Ancora; textoDoPoema: string }) {
  return (
    <figure className="my-1.5 border-l-2 border-destaque/50 pl-3">
      <figcaption className="text-xs text-tinta-suave">
        {referenciaDosVersos(textoDoPoema, { inicio: ancora.verso_inicio, fim: ancora.verso_fim })}
      </figcaption>
      <blockquote className="poema-corpo mt-0.5 text-[0.9375rem]">
        <TextoFormatado texto={ancora.trecho} />
      </blockquote>
    </figure>
  );
}

function FormComentario({
  alvo,
  parentId,
  aoComentar,
  selecao = null,
  textoDoPoema = "",
  trecho = null,
  aoLimparSelecao,
  paraQuem,
}: {
  alvo: AlvoDosComentarios;
  parentId: number | null;
  aoComentar: (novo: Comentario) => void;
  // Só no comentário de 1º nível: os versos selecionados no poema e o texto deles.
  selecao?: SelecaoDeVersos | null;
  textoDoPoema?: string;
  trecho?: string | null;
  aoLimparSelecao?: () => void;
  // Na resposta: o @ de quem é respondido, no placeholder.
  paraQuem?: string;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      const novo = selecao
        ? await criticarVersos(alvo, texto, selecao)
        : await comentar(alvo, texto, parentId);
      setTexto("");
      aoComentar(novo);
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para comentar"));
    } finally {
      setEnviando(false);
    }
  }

  const rotulo =
    parentId !== null
      ? paraQuem
        ? `Responder a @${paraQuem}`
        : "Sua resposta"
      : selecao
        ? `Comente ${selecao.inicio === selecao.fim ? "o" : "os"} ${referenciaDosVersos(textoDoPoema, selecao)}`
        : alvo.tipo === "poema"
          ? "Comente o poema"
          : "Comente a renga";

  return (
    <form onSubmit={enviar} className="space-y-2">
      {selecao && trecho !== null && (
        <div className="rounded-lg border border-borda bg-papel-alto p-3">
          <TrechoCitado
            ancora={{ verso_inicio: selecao.inicio, verso_fim: selecao.fim, trecho }}
            textoDoPoema={textoDoPoema}
          />
          <button
            type="button"
            onClick={aoLimparSelecao}
            className="cursor-pointer text-xs text-tinta-suave underline hover:text-tinta"
          >
            {alvo.tipo === "poema" ? "comentar o poema todo" : "comentar a renga toda"}
          </button>
        </div>
      )}
      {/* O campo cresce com o texto (field-sizing), do tamanho de uma linha até seis. */}
      <div className="flex items-end gap-2 rounded-2xl border border-borda bg-papel-alto py-1 pr-1.5 pl-4 transition-colors duration-150 focus-within:border-destaque">
        <textarea
          id={parentId === null ? ID_DO_CAMPO_DE_COMENTARIO : undefined}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          required
          rows={1}
          aria-label={rotulo}
          placeholder={rotulo}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-[0.9375rem] text-tinta outline-none [field-sizing:content]"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="mb-0.5 h-9 shrink-0 cursor-pointer rounded-full bg-tinta px-4 text-sm font-semibold text-papel transition-opacity duration-150 disabled:cursor-default disabled:opacity-35"
        >
          {enviando ? "enviando..." : parentId === null ? "Comentar" : "Responder"}
        </button>
      </div>
      {erro && <p className="text-xs text-destaque">{erro}</p>}
    </form>
  );
}
