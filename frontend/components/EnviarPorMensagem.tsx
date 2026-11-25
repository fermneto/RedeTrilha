"use client";
// Ação "enviar por mensagem" do PoemaCard: o botão abre um popover para escolher a
// pessoa (as conversas recentes ou a busca por nome ou @, só poetas do Verso, que
// consagrados não recebem mensagens), escrever algo se quiser e enviar. O poema vai
// na mensagem como um card. Fecha com Esc (o foco volta ao botão) ou clique fora.

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { IconeEnviar } from "@/components/icones/IconeEnviar";
import { useFecharAoSair } from "@/hooks/useFecharAoSair";
import {
  abrirConversa,
  buscarQuemRecebeMensagem,
  enviarMensagem,
  listarConversas,
  MENSAGEM_MAX_CARACTERES,
  mensagemDeFalha,
  type User,
} from "@/lib/api";

type Props = {
  postId: number;
  classeBotao: string;
  classeCirculo: string;
  classeIcone: string;
};

export function EnviarPorMensagem({ postId, classeBotao, classeCirculo, classeIcone }: Props) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idPopover = useId();

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }

  useFecharAoSair(aberto, caixa, (e) => {
    if (e.type === "keydown") e.preventDefault();
    fechar(e.type === "keydown");
  });

  return (
    <div
      ref={caixa}
      className="relative"
      onBlur={(e) => {
        const destino = e.relatedTarget as Node | null;
        if (aberto && destino && !caixa.current?.contains(destino)) setAberto(false);
      }}
    >
      <button
        ref={botao}
        type="button"
        onClick={() => (aberto ? fechar(false) : setAberto(true))}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-controls={aberto ? idPopover : undefined}
        aria-label="enviar por mensagem"
        title="enviar por mensagem"
        className={`${classeBotao} ${aberto ? "text-destaque" : ""}`}
      >
        <span className={classeCirculo}>
          <IconeEnviar className={classeIcone} />
        </span>
      </button>
      {aberto && <Popover id={idPopover} postId={postId} />}
    </div>
  );
}

function Popover({ id, postId }: { id: string; postId: number }) {
  const [recentes, setRecentes] = useState<User[] | null>(null);
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<User[] | null>(null);
  const [para, setPara] = useState<User | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<{ conversaId: number; username: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  const campoTexto = useRef<HTMLTextAreaElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    campoBusca.current?.focus();
    listarConversas("conversas", null, 5)
      .then((p) => setRecentes(p.items.map((c) => c.outro)))
      .catch(() => setRecentes([]));
  }, []);

  // A busca espera a pessoa parar de digitar.
  useEffect(() => {
    const termo = busca.trim();
    if (!termo) {
      setAchados(null);
      return;
    }
    let vivo = true;
    const espera = setTimeout(() => {
      buscarQuemRecebeMensagem(termo)
        .then((p) => vivo && setAchados(p.items))
        .catch((e) => vivo && setErro(mensagemDeFalha(e, "não deu para buscar")));
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [busca]);

  function escolher(pessoa: User) {
    setPara(pessoa);
    setErro(null);
    requestAnimationFrame(() => campoTexto.current?.focus());
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!para) return;
    setEnviando(true);
    setErro(null);
    try {
      const conversa = await abrirConversa(para.username);
      await enviarMensagem(conversa.id, texto, postId);
      setEnviado({ conversaId: conversa.id, username: para.username });
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para enviar"));
    } finally {
      setEnviando(false);
    }
  }

  const pessoas = achados ?? recentes;
  return (
    <div
      id={id}
      role="dialog"
      aria-labelledby={idTitulo}
      className="absolute right-0 bottom-full z-20 mb-1 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-borda bg-papel-alto p-2 text-sm text-tinta shadow-[0_4px_24px_-6px_rgb(0_0_0/0.2)]"
    >
      <p id={idTitulo} className="px-2 pt-1 pb-2 font-bold">
        Enviar por mensagem
      </p>

      {enviado ? (
        <p role="status" className="px-2 pb-2">
          Enviado para @{enviado.username}.{" "}
          <Link href={`/mensagens/${enviado.conversaId}`} className="font-semibold text-destaque hover:underline">
            abrir conversa
          </Link>
        </p>
      ) : para ? (
        <form onSubmit={enviar} className="space-y-2 px-2 pb-1">
          <p className="flex items-center gap-2">
            <Avatar usuario={para} tamanho="p" />
            <span className="min-w-0 flex-1 truncate">
              Para <span className="font-semibold">@{para.username}</span>
            </span>
            <button type="button" onClick={() => setPara(null)} className="realce min-h-9 cursor-pointer rounded-full px-2 text-xs">
              trocar
            </button>
          </p>
          <label className="block text-xs text-tinta-suave">
            Escreva algo (opcional)
            <textarea
              ref={campoTexto}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={MENSAGEM_MAX_CARACTERES}
              rows={2}
              className="mt-1 block w-full resize-none rounded-xl border border-borda bg-papel px-3 py-2 font-serifada text-sm text-tinta focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={enviando}
            className="min-h-10 cursor-pointer rounded-full bg-destaque px-4 text-xs font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
          >
            {enviando ? "enviando..." : "enviar o poema"}
          </button>
        </form>
      ) : (
        <>
          <label className="block px-2 pb-2">
            <span className="sr-only">Buscar pessoa por nome ou @</span>
            <input
              ref={campoBusca}
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou @"
              className="w-full rounded-full border border-borda bg-papel px-3 py-2 text-sm focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none"
            />
          </label>
          {!achados && recentes && recentes.length > 0 && (
            <p className="px-2 pb-1 text-xs text-tinta-suave">Conversas recentes</p>
          )}
          {pessoas === null && <p className="px-2 py-2 text-tinta-suave">carregando...</p>}
          {pessoas !== null && pessoas.length === 0 && (
            <p className="px-2 py-2 text-tinta-suave">
              {achados ? "Ninguém com esse nome." : "Busque alguém para mandar o poema."}
            </p>
          )}
          {pessoas && pessoas.length > 0 && (
            <ul className="max-h-60 overflow-y-auto">
              {pessoas.map((pessoa) => (
                <li key={pessoa.id}>
                  <button
                    type="button"
                    onClick={() => escolher(pessoa)}
                    className="realce flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left"
                  >
                    <Avatar usuario={pessoa} tamanho="p" />
                    <span className="min-w-0 flex-1 leading-4">
                      <span className="block truncate font-semibold">{pessoa.name}</span>
                      <span className="block truncate text-xs text-tinta-suave">@{pessoa.username}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {erro && (
        <p role="alert" className="px-2 py-1 text-xs text-destaque">
          {erro}
        </p>
      )}
    </div>
  );
}
