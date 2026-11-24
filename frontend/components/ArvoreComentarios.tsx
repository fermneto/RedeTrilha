"use client";
// Árvore de comentários carregada como no X: as raízes vêm por página (cursor),
// cada uma com a prévia de até 3 respostas, recursivamente; o resto de cada nó
// vem em "ver mais respostas". Cada comentário renderiza as próprias respostas
// (recursão) e pode ser respondido em qualquer nível.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  apagarComentario,
  buscarComentarios,
  buscarRespostas,
  comentar,
  formatarData,
  type Comentario,
} from "@/lib/api";

type Props = {
  postId: number;
  // Id do usuário da sessão: só o autor vê "apagar".
  euId: number | null;
  // Chamado depois de comentar ou apagar, para a página atualizar o contador do poema.
  aoMudar: () => void;
};

// Junta listas sem repetir comentário (a primeira página de respostas repete a prévia).
function semRepetir(atuais: Comentario[], novos: Comentario[]): Comentario[] {
  const vistos = new Set(atuais.map((c) => c.id));
  return [...atuais, ...novos.filter((c) => !vistos.has(c.id))];
}

export function ArvoreComentarios({ postId, euId, aoMudar }: Props) {
  const [raizes, setRaizes] = useState<Comentario[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (depois: string | null) => {
      setCarregando(true);
      try {
        const pagina = await buscarComentarios(postId, depois);
        setRaizes((atuais) => (depois === null ? pagina.items : semRepetir(atuais, pagina.items)));
        setCursor(pagina.proximo_cursor);
        setErro(null);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "não deu para carregar os comentários");
      } finally {
        setCarregando(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    carregar(null);
  }, [carregar]);

  return (
    <section id="comentarios" className="space-y-4">
      <h2 className="text-xl">Comentários</h2>
      <FormComentario
        postId={postId}
        parentId={null}
        aoComentar={(novo) => {
          setRaizes((atuais) => semRepetir(atuais, [novo]));
          aoMudar();
        }}
      />
      {erro && <p className="text-sm text-destaque">{erro}</p>}
      {raizes.length === 0 && !carregando && !erro ? (
        <p className="text-sm text-tinta-suave">Ainda não há comentários.</p>
      ) : (
        <ListaComentarios
          comentarios={raizes}
          euId={euId}
          aoMudar={aoMudar}
          aoSumir={(id) => setRaizes((atuais) => atuais.filter((c) => c.id !== id))}
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
  comentarios: Comentario[];
  euId: number | null;
  aoMudar: () => void;
  // Um comentário sem respostas apagado sai do banco: some da lista do pai.
  aoSumir: (id: number) => void;
};

function ListaComentarios({ comentarios, euId, aoMudar, aoSumir }: PropsLista) {
  return (
    <ul className="space-y-3">
      {comentarios.map((c) => (
        <li key={c.id}>
          <ItemComentario comentario={c} euId={euId} aoMudar={aoMudar} aoSumir={aoSumir} />
        </li>
      ))}
    </ul>
  );
}

function ItemComentario({
  comentario,
  euId,
  aoMudar,
  aoSumir,
}: Omit<PropsLista, "comentarios"> & { comentario: Comentario }) {
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
      const pagina = await buscarRespostas(comentario.id, cursor ?? null);
      setRespostas((atuais) => semRepetir(atuais, pagina.items));
      setTotal(pagina.total);
      setCursor(pagina.proximo_cursor);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu para carregar as respostas");
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    if (!window.confirm("Apagar este comentário?")) return;
    setOcupado(true);
    try {
      await apagarComentario(comentario.id);
      // Com respostas, o backend deixa o marcador; sem, o comentário sai do banco.
      if (total > 0) setRemovido(true);
      else aoSumir(comentario.id);
      aoMudar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu para apagar");
    } finally {
      setOcupado(false);
    }
  }

  function removerResposta(id: number) {
    setRespostas((atuais) => atuais.filter((c) => c.id !== id));
    setTotal((n) => n - 1);
  }

  const acao = "cursor-pointer text-xs text-tinta-suave hover:text-tinta disabled:opacity-50";
  return (
    <div>
      <div className="rounded-md border border-borda bg-papel-alto p-3">
        {removido || !autor ? (
          <p className="text-sm text-tinta-suave italic">comentário removido</p>
        ) : (
          <>
            <p className="text-xs text-tinta-suave">
              <Link href={`/u/${autor.username}`} className="font-medium text-tinta hover:underline">
                {autor.name}
              </Link>{" "}
              @{autor.username} ·{" "}
              <time dateTime={comentario.created_at}>{formatarData(comentario.created_at)}</time>
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{comentario.texto}</p>
            <div className="mt-1 flex gap-4">
              <button type="button" onClick={() => setRespondendo((r) => !r)} className={acao}>
                {respondendo ? "cancelar" : "responder"}
              </button>
              {euId === autor.id && (
                <button type="button" onClick={apagar} disabled={ocupado} className={acao}>
                  apagar
                </button>
              )}
            </div>
          </>
        )}
        {erro && <p className="mt-1 text-xs text-destaque">{erro}</p>}
      </div>
      {respondendo && !removido && (
        <div className="mt-2 ml-4">
          <FormComentario
            postId={comentario.post_id}
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
        <div className="mt-3 ml-4 space-y-2 border-l border-borda pl-3">
          <ListaComentarios
            comentarios={respostas}
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

function FormComentario({
  postId,
  parentId,
  aoComentar,
}: {
  postId: number;
  parentId: number | null;
  aoComentar: (novo: Comentario) => void;
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
      const novo = await comentar(postId, texto, parentId);
      setTexto("");
      aoComentar(novo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "não deu para comentar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        required
        rows={parentId === null ? 3 : 2}
        placeholder={parentId === null ? "Comente o poema" : "Sua resposta"}
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
