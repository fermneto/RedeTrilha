"use client";
// "Mensagens": a caixa, como no X. Duas abas: "Conversas" (de quem você segue, e
// os pedidos que você aceitou) e "Pedidos" (de quem você não segue). Cada linha
// mostra com quem, quando foi a última mensagem, o começo dela e quantas faltam
// ler; a mais recente primeiro. Atualiza sozinha pelo stream das mensagens.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { Abas } from "@/components/Abas";
import { Avatar } from "@/components/Avatar";
import { AvisoDeErro } from "@/components/AvisoDeErro";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EsqueletoDeConversas } from "@/components/Esqueleto";
import { useListaPorCursor, type ListaPorCursor } from "@/hooks/useListaPorCursor";
import { useRecarregarAoOuvir } from "@/hooks/useRecarregarAoOuvir";
import { useSessaoObrigatoria } from "@/hooks/useSessaoObrigatoria";
import {
  listarConversas,
  mensagemDeFalha,
  previaDaMensagem,
  quandoEditado,
  type AbaDaCaixa,
  type ConversaNaCaixa,
  type EventoDeMensagem,
} from "@/lib/api";

const buscarConversas = (cursor: string | null) => listarConversas("conversas", cursor);
const buscarPedidos = (cursor: string | null) => listarConversas("pedidos", cursor);
// Todo evento de mensagem (o "aviso" é da página de Avisos) recarrega a caixa.
const ouvirMensagensDaCaixa = (evento: EventoDeMensagem) => evento.tipo !== "aviso";

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
  const euId = useSessaoObrigatoria()?.id ?? null;
  const conversas = useListaPorCursor(buscarConversas);
  const pedidos = useListaPorCursor(buscarPedidos);
  const caixa = { conversas, pedidos };
  const [erro, setErro] = useState<string | null>(null);

  // Recarrega a primeira página das duas abas (o contador dos pedidos aparece na aba).
  const recarregarConversas = conversas.recarregar;
  const recarregarPedidos = pedidos.recarregar;
  const recarregar = useCallback(() => {
    for (const recarregarAba of [recarregarConversas, recarregarPedidos]) {
      recarregarAba().catch((e) => setErro(mensagemDeFalha(e, "não deu para carregar as mensagens")));
    }
  }, [recarregarConversas, recarregarPedidos]);
  useRecarregarAoOuvir(recarregar, ouvirMensagensDaCaixa);

  async function carregarMais(qual: AbaDaCaixa) {
    try {
      await caixa[qual].carregarMais();
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para carregar mais conversas"));
    }
  }

  const pedidosNovos = (pedidos.lista?.itens ?? []).filter((c) => c.nao_lidas > 0).length;
  const abas = [
    { valor: "conversas", rotulo: "Conversas" },
    { valor: "pedidos", rotulo: pedidosNovos > 0 ? `Pedidos (${pedidosNovos})` : "Pedidos" },
  ] as const;

  return (
    <div>
      <CabecalhoPagina titulo="Mensagens" />
      {erro && <AvisoDeErro className="m-4">{erro}</AvisoDeErro>}
      <Abas
        abas={abas}
        atual={aba}
        aoMudar={(nova) => router.replace(nova === "pedidos" ? "/mensagens?aba=pedidos" : "/mensagens", { scroll: false })}
        rotulo="Caixa de mensagens"
      >
        {(qual) => (
          <ListaDaCaixa aba={qual} lista={caixa[qual].lista} euId={euId} aoCarregarMais={() => carregarMais(qual)} />
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
  lista: ListaPorCursor<ConversaNaCaixa> | null;
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
