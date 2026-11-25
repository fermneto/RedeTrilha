"use client";
// Árvore de comentários carregada como no X: as raízes vêm por página (cursor),
// cada uma com a prévia de até 3 respostas, recursivamente; o resto de cada nó
// vem em "ver mais respostas". Cada comentário renderiza as próprias respostas
// (recursão) e pode ser respondido em qualquer nível.
// Crítica ancorada (#71): com versos selecionados no poema, o comentário de 1º
// nível vai sobre eles e mostra o trecho citado; com `verso`, só aparecem as
// críticas daquele verso.
// O alvo é um poema ou uma renga (aberta ou fechada): as rotas mudam, as regras não.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ConfirmacaoInline } from "@/components/ConfirmacaoInline";
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
  referenciaDosVersos,
  trechoDosVersos,
  type AlvoDosComentarios,
  type Ancora,
  type ComentarioNaArvore as Comentario,
  type SelecaoDeVersos,
  type User,
} from "@/lib/api";

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

  return (
    <section id="comentarios" className="space-y-4">
      <h2 className="text-xl">Comentários</h2>
      <FormComentario
        alvo={alvo}
        parentId={null}
        selecao={selecao}
        trecho={selecao && trechoDosVersos(textoDoPoema, selecao)}
        aoLimparSelecao={aoLimparSelecao}
        aoComentar={(novo) => {
          setMeusNovos((atuais) => [novo, ...atuais]);
          aoLimparSelecao();
          aoMudar();
        }}
      />
      {verso !== null && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave">
          <span>Comentários sobre o verso {verso}</span>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={aoLimparFiltro} className="cursor-pointer underline hover:text-tinta">
            ver todos os comentários
          </button>
        </p>
      )}
      {erro && <p className="text-sm text-destaque">{erro}</p>}
      {visiveis.length === 0 && !carregando && !erro ? (
        <p className="text-sm text-tinta-suave">Ainda não há comentários.</p>
      ) : (
        <ListaComentarios
          alvo={alvo}
          comentarios={visiveis}
          destacados={idsNovos}
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
          className="cursor-pointer text-sm text-tinta-suave underline hover:text-tinta disabled:opacity-50"
        >
          {carregando ? "carregando..." : "carregar mais comentários"}
        </button>
      )}
    </section>
  );
}

type PropsLista = {
  alvo: AlvoDosComentarios;
  comentarios: Comentario[];
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
    <ul className="space-y-3">
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

  const acao = "cursor-pointer text-xs text-tinta-suave hover:text-tinta disabled:opacity-50";
  // Até NIVEL_MAXIMO_DE_RECUO cada nível recua; depois, o recuo negativo anula o
  // da linha e as respostas alinham no 4º nível, com a linha sobre a do pai.
  const recuo =
    nivel + 1 <= NIVEL_MAXIMO_DE_RECUO ? "ml-4" : "-ml-[calc(0.75rem+1px)]";
  return (
    <div>
      <div
        className={
          novo
            ? "rounded-md border border-destaque/40 bg-destaque/5 p-3"
            : "rounded-md border border-borda bg-papel-alto p-3"
        }
      >
        {novo && <p className="mb-1 text-xs text-destaque">seu comentário</p>}
        {comentario.ancora && <TrechoCitado ancora={comentario.ancora} />}
        {nivel > NIVEL_MAXIMO_DE_RECUO && autorDoPai !== undefined && (
          <p className="mb-1 text-xs text-tinta-suave">
            ↳ respondendo a{" "}
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
          <p className="text-sm text-tinta-suave italic">comentário removido</p>
        ) : (
          <>
            <p className="text-xs text-tinta-suave">
              <NomeAutor usuario={autor} className="font-medium text-tinta" />{" "}
              @{autor.username} ·{" "}
              <time dateTime={comentario.created_at}>{formatarData(comentario.created_at)}</time>
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{comentario.texto}</p>
            <div className="mt-1 flex gap-4">
              <button type="button" onClick={() => setRespondendo((r) => !r)} className={acao}>
                {respondendo ? "cancelar" : "responder"}
              </button>
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
      {respondendo && !removido && (
        <div className="mt-2 ml-4">
          <FormComentario
            alvo={alvo}
            parentId={comentario.id}
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
        <div className={`mt-3 ${recuo} space-y-2 border-l border-borda pl-3`}>
          <ListaComentarios
            alvo={alvo}
            comentarios={respostas}
            nivel={nivel + 1}
            autorDoPai={autor}
            euId={euId}
            aoMudar={aoMudar}
            aoSumir={removerResposta}
          />
          {faltam > 0 && cursor !== null && (
            <button type="button" onClick={verMais} disabled={ocupado} className={acao}>
              {ocupado ? "carregando..." : `ver mais respostas (${faltam})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// O trecho que a crítica comenta, acima do texto dela, com as quebras do poema.
function TrechoCitado({ ancora }: { ancora: Ancora }) {
  return (
    <figure className="mb-2 border-l-2 border-destaque/50 pl-3">
      <figcaption className="text-xs text-tinta-suave">
        {referenciaDosVersos({ inicio: ancora.verso_inicio, fim: ancora.verso_fim })}
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
  trecho = null,
  aoLimparSelecao,
}: {
  alvo: AlvoDosComentarios;
  parentId: number | null;
  aoComentar: (novo: Comentario) => void;
  // Só no comentário de 1º nível: os versos selecionados no poema e o texto deles.
  selecao?: SelecaoDeVersos | null;
  trecho?: string | null;
  aoLimparSelecao?: () => void;
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

  return (
    <form onSubmit={enviar} className="space-y-2">
      {selecao && trecho !== null && (
        <div className="rounded-md border border-borda bg-papel-alto p-3">
          <TrechoCitado ancora={{ verso_inicio: selecao.inicio, verso_fim: selecao.fim, trecho }} />
          <button
            type="button"
            onClick={aoLimparSelecao}
            className="cursor-pointer text-xs text-tinta-suave underline hover:text-tinta"
          >
            {alvo.tipo === "poema" ? "comentar o poema todo" : "comentar a renga toda"}
          </button>
        </div>
      )}
      <textarea
        id={parentId === null ? ID_DO_CAMPO_DE_COMENTARIO : undefined}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        required
        rows={parentId === null ? 3 : 2}
        placeholder={
          parentId !== null
            ? "Sua resposta"
            : selecao
              ? `Comente ${selecao.inicio === selecao.fim ? "o" : "os"} ${referenciaDosVersos(selecao)}`
              : alvo.tipo === "poema"
                ? "Comente o poema"
                : "Comente a renga"
        }
        className="w-full rounded border border-borda bg-papel px-3 py-2 text-sm text-tinta"
      />
      {erro && <p className="text-xs text-destaque">{erro}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="cursor-pointer rounded bg-tinta px-3 py-1.5 text-sm text-papel disabled:opacity-50"
      >
        {enviando ? "enviando..." : parentId === null ? "comentar" : "responder"}
      </button>
    </form>
  );
}
