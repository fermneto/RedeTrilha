"use client";
// "Mensagens": a caixa, como no X. Duas abas: "Conversas" (de quem você segue, e
// os pedidos que você aceitou) e "Pedidos" (de quem você não segue). Cada linha
// mostra com quem, quando foi a última mensagem, o começo dela e quantas faltam
// ler; a mais recente primeiro. Atualiza sozinha pelo stream das mensagens.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { Abas } from "@/components/Abas";
import { Avatar } from "@/components/Avatar";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EsqueletoDeConversas } from "@/components/Esqueleto";
import {
  buscarEu,
  caminhoDoLogin,
  listarConversas,
  mensagemDeFalha,
  ouvirMensagens,
  previaDaMensagem,
  quandoEditado,
  temToken,
  type AbaDaCaixa,
  type ConversaNaCaixa,
} from "@/lib/api";

type Lista = { itens: ConversaNaCaixa[]; cursor: string | null };

// useSearchParams precisa de Suspense no build do Next.
export default function MensagensPage() {
  return (
    <Suspense>
      <Caixa />
    </Suspense>
  );
}

function Caixa() {
  const router = useRouter();
  // A aba fica na URL (?aba=pedidos), como no perfil.
  const aba: AbaDaCaixa = useSearchParams().get("aba") === "pedidos" ? "pedidos" : "conversas";
  const [euId, setEuId] = useState<number | null>(null);
  const [listas, setListas] = useState<Partial<Record<AbaDaCaixa, Lista>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recarrega a primeira página das duas abas (o contador dos pedidos aparece na aba).
  const recarregar = useCallback(() => {
    for (const qual of ["conversas", "pedidos"] as const) {
      listarConversas(qual, null)
        .then((p) => setListas((atuais) => ({ ...atuais, [qual]: { itens: p.items, cursor: p.proximo_cursor } })))
        .catch((e) => setErro(mensagemDeFalha(e, "não deu para carregar as mensagens")));
    }
  }, []);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    buscarEu()
      .then((eu) => setEuId(eu.id))
      .catch(() => undefined);
    recarregar();
    const cancelar = ouvirMensagens((evento) => {
      if (evento.tipo === "aviso") return;
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(recarregar, 250);
    });
    return () => {
      cancelar();
      if (espera.current) clearTimeout(espera.current);
    };
  }, [router, recarregar]);

  async function carregarMais(qual: AbaDaCaixa) {
    const atual = listas[qual];
    if (!atual?.cursor) return;
    try {
      const p = await listarConversas(qual, atual.cursor);
      setListas((l) => ({ ...l, [qual]: { itens: [...atual.itens, ...p.items], cursor: p.proximo_cursor } }));
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para carregar mais conversas"));
    }
  }

  const pedidosNovos = (listas.pedidos?.itens ?? []).filter((c) => c.nao_lidas > 0).length;
  const abas = [
    { valor: "conversas", rotulo: "Conversas" },
    { valor: "pedidos", rotulo: pedidosNovos > 0 ? `Pedidos (${pedidosNovos})` : "Pedidos" },
  ] as const;

  return (
    <div>
      <CabecalhoPagina titulo="Mensagens" />
      {erro && <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>}
      <Abas
        abas={abas}
        atual={aba}
        aoMudar={(nova) => router.replace(nova === "pedidos" ? "/mensagens?aba=pedidos" : "/mensagens", { scroll: false })}
        rotulo="Caixa de mensagens"
      >
        {(qual) => (
          <ListaDaCaixa aba={qual} lista={listas[qual]} euId={euId} aoCarregarMais={() => carregarMais(qual)} />
        )}
      </Abas>
    </div>
  );
}

function ListaDaCaixa({
  aba,
  lista,
  euId,
  aoCarregarMais,
}: {
  aba: AbaDaCaixa;
  lista: Lista | undefined;
  euId: number | null;
  aoCarregarMais: () => void;
}) {
  if (!lista) return <EsqueletoDeConversas quantos={5} />;

  return (
    <>
      {aba === "pedidos" && (
        <p className="linha-da-folha border-b border-borda py-3 text-sm text-tinta-suave">
          Mensagens de quem você não segue. Quem mandou só fica sabendo que você leu se você aceitar.
        </p>
      )}
      {lista.itens.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="font-bold">{aba === "pedidos" ? "Nenhum pedido" : "Nenhuma conversa ainda"}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-tinta-suave">
            {aba === "pedidos"
              ? "Quando alguém que você não segue mandar uma mensagem, ela espera aqui."
              : "Abra uma conversa pelo perfil de um poeta, ou mande um poema pelo botão de enviar do card."}
          </p>
        </div>
      ) : (
        <ul>
          {lista.itens.map((conversa) => (
            <li key={conversa.id}>
              <LinhaDaConversa conversa={conversa} euId={euId} />
            </li>
          ))}
        </ul>
      )}
      {lista.cursor && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={aoCarregarMais}
            className="realce min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold text-destaque"
          >
            carregar mais conversas
          </button>
        </div>
      )}
    </>
  );
}

function LinhaDaConversa({ conversa, euId }: { conversa: ConversaNaCaixa; euId: number | null }) {
  const nova = conversa.nao_lidas > 0;
  const quando = conversa.ultima_mensagem ? quandoEditado(conversa.ultima_mensagem.created_at) : "";
  return (
    <Link
      href={`/mensagens/${conversa.id}`}
      className="realce linha-da-folha flex gap-3 border-b border-borda py-3 focus-visible:outline-offset-[-2px]"
    >
      <Avatar usuario={conversa.outro} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5 text-[0.9375rem] leading-5">
          {/* Texto, e não o link do NomeAutor: a linha inteira já é um link. */}
          <span className="truncate font-bold">{conversa.outro.name}</span>
          <span className="truncate text-tinta-suave">@{conversa.outro.username}</span>
          <span aria-hidden="true" className="text-tinta-suave">
            ·
          </span>
          <span className="shrink-0 text-tinta-suave">{quando}</span>
          {conversa.silenciada && <span className="shrink-0 text-xs text-tinta-suave italic">silenciada</span>}
        </span>
        <span
          className={`mt-1 block truncate font-serifada text-[0.9375rem] ${
            nova ? "font-semibold text-tinta" : "text-tinta-suave"
          }`}
        >
          {previaDaMensagem(conversa.ultima_mensagem, euId)}
        </span>
      </span>
      {nova && (
        <span className="flex shrink-0 items-center">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destaque px-1.5 text-[0.6875rem] font-bold text-papel tabular-nums">
            {conversa.nao_lidas}
          </span>
          <span className="sr-only">{conversa.nao_lidas === 1 ? "mensagem não lida" : "mensagens não lidas"}</span>
        </span>
      )}
    </Link>
  );
}
