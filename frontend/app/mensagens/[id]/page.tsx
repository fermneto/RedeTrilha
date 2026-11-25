"use client";
// Uma conversa: as mensagens em Literata (podem ser versos, com as quebras como
// foram escritas), o poema compartilhado como no card da citação, "Visto" embaixo
// da minha última mensagem e o campo de escrever no pé. Enter quebra a linha
// (é um lugar de poesia); Ctrl+Enter ou o botão envia.
//
// Tempo real: o stream das mensagens (ouvirMensagens) avisa mensagem nova, leitura
// e mudança na conversa; a página busca só o que falta (`depois=` a última que
// ela tem), inclusive ao reconectar, então nada se perde se o stream cair.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { ConfirmacaoInline } from "@/components/ConfirmacaoInline";
import { IconeEnviar } from "@/components/icones/IconeEnviar";
import { IconeMais } from "@/components/icones/IconeMais";
import { PoemaCard } from "@/components/PoemaCard";
import { useFecharAoSair } from "@/hooks/useFecharAoSair";
import {
  aceitarPedido,
  bloquear,
  buscarConversa,
  buscarEu,
  buscarMensagens,
  caminhoDoLogin,
  enviarMensagem,
  ErroDaApi,
  marcarLida,
  MENSAGEM_MAX_CARACTERES,
  mensagemDeFalha,
  ouvirMensagens,
  quandoEditado,
  recusarPedido,
  silenciarConversa,
  situacaoDaMinhaUltima,
  temToken,
  type Conversa,
  type Mensagem,
} from "@/lib/api";

// Duas mensagens seguidas com mais que isto entre elas ganham a hora embaixo.
const INTERVALO_DA_HORA_MS = 5 * 60_000;
// O contador de caracteres só aparece perto do limite.
const AVISO_DE_CARACTERES = MENSAGEM_MAX_CARACTERES - 1000;

export default function ConversaPage() {
  const router = useRouter();
  const id = Number(useParams<{ id: string }>().id);
  const [euId, setEuId] = useState<number | null>(null);
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [antes, setAntes] = useState<string | null>(null);
  const [naoExiste, setNaoExiste] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const ultimaId = useRef(0);
  // O id de quem lê, para os eventos do stream (que são ouvidos uma vez só).
  const euIdAtual = useRef<number | null>(null);
  euIdAtual.current = euId;
  const colarNoFim = useRef(true);

  const juntar = useCallback((novas: Mensagem[]) => {
    setMensagens((atuais) => {
      const vistas = new Set(atuais.map((m) => m.id));
      const juntas = [...atuais, ...novas.filter((m) => !vistas.has(m.id))].sort((a, b) => a.id - b.id);
      ultimaId.current = juntas.length > 0 ? juntas[juntas.length - 1].id : 0;
      return juntas;
    });
  }, []);

  const recarregarConversa = useCallback(
    () =>
      buscarConversa(id)
        .then(setConversa)
        .catch((e) => {
          if (e instanceof ErroDaApi && e.status === 404) setNaoExiste(true);
          else setErro(mensagemDeFalha(e, "não deu para abrir a conversa"));
        }),
    [id],
  );

  // O que chegou depois da última que a tela tem (stream ou reconexão).
  const buscarNovas = useCallback(async () => {
    let depois = ultimaId.current;
    for (;;) {
      const pagina = await buscarMensagens(id, { depois });
      juntar(pagina.items);
      if (!pagina.proximo_cursor) return pagina.items;
      depois = Number(pagina.proximo_cursor);
    }
  }, [id, juntar]);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    if (!Number.isInteger(id)) {
      setNaoExiste(true);
      return;
    }
    buscarEu()
      .then((eu) => setEuId(eu.id))
      .catch(() => undefined);
    recarregarConversa();
    buscarMensagens(id)
      .then((pagina) => {
        juntar(pagina.items);
        setAntes(pagina.proximo_cursor);
      })
      .catch(() => undefined);
  }, [id, router, juntar, recarregarConversa]);

  // Eventos desta conversa. A mensagem do outro é anunciada pelo aria-live.
  useEffect(() => {
    return ouvirMensagens((evento) => {
      if (evento.tipo === "conectou") {
        recarregarConversa();
        if (ultimaId.current > 0) void buscarNovas().catch(() => undefined);
        return;
      }
      if (evento.conversa_id !== id) return;
      if (evento.tipo === "mensagem" || evento.tipo === "pedido") {
        void buscarNovas()
          .then((novas) => {
            const doOutro = novas.filter((m) => m.autor_id !== euIdAtual.current);
            const ultima = doOutro[doOutro.length - 1];
            if (ultima) setAnuncio(`Nova mensagem: ${ultima.texto.split("\n")[0] || "um poema"}`);
          })
          .catch(() => undefined);
      } else if (evento.tipo === "lida") {
        if (evento.leitor_id !== euIdAtual.current) {
          setConversa((c) => (c ? { ...c, visto_ate: evento.ultima_lida_id } : c));
        }
      } else {
        recarregarConversa();
      }
    });
  }, [id, buscarNovas, recarregarConversa]);

  // Leu o que está na tela: marca como lida, se a aba está visível e há algo novo.
  const ultimaNaTela = mensagens[mensagens.length - 1]?.id ?? 0;
  const lidaAte = conversa?.ultima_lida_id ?? 0;
  useEffect(() => {
    function marcar() {
      if (document.visibilityState !== "visible" || ultimaNaTela <= lidaAte) return;
      setConversa((c) => (c ? { ...c, ultima_lida_id: ultimaNaTela } : c));
      marcarLida(id, ultimaNaTela).catch(() => undefined);
    }
    marcar();
    document.addEventListener("visibilitychange", marcar);
    return () => document.removeEventListener("visibilitychange", marcar);
  }, [id, ultimaNaTela, lidaAte]);

  // Fica no fim quando chega mensagem, se a pessoa já estava lá embaixo.
  useLayoutEffect(() => {
    if (colarNoFim.current) window.scrollTo({ top: document.body.scrollHeight });
  }, [mensagens.length]);
  useEffect(() => {
    function aoRolar() {
      colarNoFim.current = window.innerHeight + window.scrollY >= document.body.scrollHeight - 120;
    }
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  async function carregarAnteriores() {
    if (!antes) return;
    const altura = document.body.scrollHeight;
    colarNoFim.current = false;
    try {
      const pagina = await buscarMensagens(id, { antes: Number(antes) });
      setMensagens((atuais) => [...pagina.items, ...atuais]);
      setAntes(pagina.proximo_cursor);
      // Mantém na tela a mensagem que estava no topo.
      requestAnimationFrame(() => window.scrollBy({ top: document.body.scrollHeight - altura }));
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para carregar as mensagens anteriores"));
    }
  }

  async function enviar(texto: string) {
    colarNoFim.current = true;
    const mensagem = await enviarMensagem(id, texto);
    juntar([mensagem]);
    // Responder um pedido o aceita (backend); a tela acompanha.
    setConversa((c) => (c ? { ...c, situacao: "caixa", ultima_lida_id: mensagem.id } : c));
  }

  if (naoExiste) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="font-bold">Conversa não encontrada</p>
        <Link href="/mensagens" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-destaque hover:underline">
          voltar para as mensagens
        </Link>
      </div>
    );
  }

  const minhaUltima = euId !== null && conversa ? situacaoDaMinhaUltima(mensagens, euId, conversa.visto_ate) : null;

  return (
    <div className="flex min-h-[calc(100dvh-3.25rem)] flex-col sm:min-h-dvh">
      <Cabecalho conversa={conversa} aoMudar={recarregarConversa} aoErro={setErro} />

      <div className="flex-1 px-4 pt-3 pb-4">
        {antes && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={carregarAnteriores}
              className="realce min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold text-destaque"
            >
              mensagens anteriores
            </button>
          </div>
        )}
        {conversa && mensagens.length === 0 && (
          <p className="py-10 text-center text-sm text-tinta-suave">
            Comece a conversa com @{conversa.outro.username}. Pode ser um verso.
          </p>
        )}
        <ol aria-label="Mensagens" className="flex flex-col">
          {mensagens.map((m, i) => {
            const minha = m.autor_id === euId;
            const proxima = mensagens[i + 1];
            const mesmoAutorDepois = proxima?.autor_id === m.autor_id;
            const intervalo = proxima ? Date.parse(proxima.created_at) - Date.parse(m.created_at) : Infinity;
            const comHora = !mesmoAutorDepois || intervalo > INTERVALO_DA_HORA_MS;
            return (
              <li
                key={m.id}
                className={`flex flex-col ${minha ? "items-end" : "items-start"} ${comHora ? "mb-4" : "mb-1"}`}
              >
                <BalaoDaMensagem mensagem={m} minha={minha} />
                {(comHora || minhaUltima?.id === m.id) && (
                  <p className="mt-1 px-1 text-xs text-tinta-suave tabular-nums">
                    {comHora && <time dateTime={m.created_at}>{quandoEditado(m.created_at)}</time>}
                    {minhaUltima?.id === m.id && (
                      <>
                        {comHora && <span aria-hidden="true"> · </span>}
                        {minhaUltima.rotulo}
                      </>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        <p aria-live="polite" className="sr-only">
          {anuncio}
        </p>
        {erro && <p className="mt-2 text-sm text-destaque">{erro}</p>}
      </div>

      {conversa && <Pe conversa={conversa} aoEnviar={enviar} aoMudar={recarregarConversa} />}
    </div>
  );
}

// Uma mensagem: o poema compartilhado (como o original de uma citação) e o texto
// num balão, à direita quando é minha. O poema fica fora do balão: um quadro dentro
// de outro seria um cartão dentro de um cartão.
function BalaoDaMensagem({ mensagem, minha }: { mensagem: Mensagem; minha: boolean }) {
  return (
    <div className={`flex max-w-[88%] flex-col gap-1 ${minha ? "items-end" : "items-start"} sm:max-w-[80%]`}>
      {mensagem.post && (
        <div className="w-full min-w-[16rem]">
          <PoemaCard post={mensagem.post} aninhado />
        </div>
      )}
      {mensagem.post_removido && (
        <p className="rounded-2xl border border-dashed border-borda px-4 py-3 text-sm text-tinta-suave italic">
          poema removido pelo autor
        </p>
      )}
      {mensagem.texto.trim() && (
        <p
          className={`poema-corpo rounded-[1.25rem] px-4 py-2 text-[1rem] leading-[1.65] ${
            minha ? "rounded-br-md bg-destaque/12" : "rounded-bl-md bg-painel"
          }`}
        >
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}

function Cabecalho({
  conversa,
  aoMudar,
  aoErro,
}: {
  conversa: Conversa | null;
  aoMudar: () => void;
  aoErro: (erro: string) => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex min-h-13 items-center gap-3 border-b border-borda bg-papel px-2">
      <Link
        href="/mensagens"
        aria-label="Voltar para as mensagens"
        className="realce flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 6L5 12L11 18" />
        </svg>
      </Link>
      {conversa ? (
        <>
          <Link href={`/u/${conversa.outro.username}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-full">
            <Avatar usuario={conversa.outro} tamanho="p" />
            <span className="min-w-0 leading-5">
              <h1 className="truncate text-[1.0625rem] font-bold">{conversa.outro.name}</h1>
              <span className="block truncate text-[0.8125rem] text-tinta-suave">
                @{conversa.outro.username}
                {conversa.silenciada && " · silenciada"}
              </span>
            </span>
          </Link>
          <MenuDaConversa conversa={conversa} aoMudar={aoMudar} aoErro={aoErro} />
        </>
      ) : (
        <span className="flex-1" />
      )}
    </header>
  );
}

// "⋯": silenciar ou não, bloquear (com confirmação) ou desbloquear.
function MenuDaConversa({
  conversa,
  aoMudar,
  aoErro,
}: {
  conversa: Conversa;
  aoMudar: () => void;
  aoErro: (erro: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idMenu = useId();
  const username = conversa.outro.username;

  useFecharAoSair(aberto, caixa, (e) => {
    setAberto(false);
    if (e instanceof KeyboardEvent) botao.current?.focus();
  });
  useEffect(() => {
    if (aberto) caixa.current?.querySelector<HTMLElement>("[data-menu] button")?.focus();
  }, [aberto]);

  async function agir(acao: () => Promise<void>, falha: string) {
    setAberto(false);
    try {
      await acao();
      aoMudar();
    } catch (e) {
      aoErro(mensagemDeFalha(e, falha));
    }
  }

  const item =
    "realce block min-h-11 w-full cursor-pointer px-4 py-2.5 text-left text-[0.9375rem] font-semibold focus-visible:outline-offset-[-2px]";
  return (
    <div
      ref={caixa}
      className="relative"
      onBlur={(e) => {
        if (!caixa.current?.contains(e.relatedTarget as Node | null)) setAberto(false);
      }}
    >
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={idMenu}
        aria-label="Opções da conversa"
        className="realce flex h-11 w-11 cursor-pointer items-center justify-center rounded-full"
      >
        <IconeMais className="h-5 w-5" />
      </button>
      <div
        id={idMenu}
        data-menu
        hidden={!aberto}
        className="absolute top-full right-0 z-30 mt-1 w-64 max-w-[calc(100vw-1rem)] rounded-2xl border border-borda bg-papel-alto py-2 shadow-[0_4px_24px_-6px_rgb(0_0_0/0.2)]"
      >
        <button
          type="button"
          className={item}
          onClick={() => agir(() => silenciarConversa(conversa.id, !conversa.silenciada), "não deu para silenciar")}
        >
          {conversa.silenciada ? "Voltar a contar as não lidas" : "Silenciar conversa"}
          <span className="block text-xs font-normal text-tinta-suave">
            {conversa.silenciada ? "As mensagens voltam a aparecer no contador." : "As mensagens não entram no contador."}
          </span>
        </button>
        {conversa.bloqueei ? (
          <button type="button" className={item} onClick={() => agir(() => bloquear(username, false), "não deu para desbloquear")}>
            Desbloquear @{username}
          </button>
        ) : (
          <div className="px-4 py-2">
            <ConfirmacaoInline
              pergunta={`Bloquear @${username}? Nenhum dos dois manda mais mensagem.`}
              rotulo={`Bloquear @${username}`}
              classeDoBotao="min-h-11 w-full cursor-pointer text-left text-[0.9375rem] font-semibold text-destaque"
              aoConfirmar={() => agir(() => bloquear(username, true), "não deu para bloquear")}
              devolverFoco={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// O pé da conversa: o campo de escrever, ou o pedido para aceitar, ou o motivo
// de não poder responder (bloqueio).
function Pe({
  conversa,
  aoEnviar,
  aoMudar,
}: {
  conversa: Conversa;
  aoEnviar: (texto: string) => Promise<void>;
  aoMudar: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const fixo =
    "sticky bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-10 border-t border-borda bg-papel px-4 py-3 sm:bottom-0";

  if (conversa.situacao === "pedido") {
    return (
      <div className={fixo}>
        <p className="text-sm">
          <span className="font-bold">@{conversa.outro.username}</span> quer conversar. Você não segue esta pessoa: se
          aceitar, a conversa vai para a sua caixa e ela vê quando você ler.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              aceitarPedido(conversa.id)
                .then(aoMudar)
                .catch((e) => setErro(mensagemDeFalha(e, "não deu para aceitar")))
            }
            className="min-h-11 cursor-pointer rounded-full bg-tinta px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-125"
          >
            Aceitar
          </button>
          <ConfirmacaoInline
            pergunta="Recusar o pedido? A conversa some da sua lista."
            rotulo="Recusar"
            classeDoBotao="realce min-h-11 cursor-pointer rounded-full border border-borda px-5 text-sm font-semibold"
            aoConfirmar={() =>
              recusarPedido(conversa.id)
                .then(() => router.push("/mensagens?aba=pedidos"))
                .catch((e) => setErro(mensagemDeFalha(e, "não deu para recusar")))
            }
          />
        </div>
        {erro && <p className="mt-2 text-sm text-destaque">{erro}</p>}
      </div>
    );
  }

  if (!conversa.pode_responder) {
    return (
      <div className={fixo}>
        <p className="text-sm text-tinta-suave">{conversa.motivo}</p>
        {conversa.bloqueei && (
          <button
            type="button"
            onClick={() =>
              bloquear(conversa.outro.username, false)
                .then(aoMudar)
                .catch((e) => setErro(mensagemDeFalha(e, "não deu para desbloquear")))
            }
            className="realce mt-2 min-h-11 cursor-pointer rounded-full border border-borda px-5 text-sm font-semibold"
          >
            Desbloquear @{conversa.outro.username}
          </button>
        )}
        {erro && <p className="mt-2 text-sm text-destaque">{erro}</p>}
      </div>
    );
  }

  return (
    <div className={fixo}>
      <CampoDaMensagem para={conversa.outro.username} aoEnviar={aoEnviar} />
    </div>
  );
}

function CampoDaMensagem({ para, aoEnviar }: { para: string; aoEnviar: (texto: string) => Promise<void> }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const idDica = useId();

  // Cresce com o texto até um teto; passou dele, rola por dentro.
  useLayoutEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [texto]);

  const vazio = !texto.trim();
  const passou = texto.length > MENSAGEM_MAX_CARACTERES;

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (vazio || passou || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await aoEnviar(texto);
      setTexto("");
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para enviar"));
    } finally {
      setEnviando(false);
      campo.current?.focus();
    }
  }

  return (
    <form onSubmit={enviar} className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor={`${idDica}-campo`}>
          Mensagem para @{para}
        </label>
        <textarea
          id={`${idDica}-campo`}
          ref={campo}
          rows={1}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void enviar();
          }}
          aria-describedby={idDica}
          placeholder="Escreva uma mensagem"
          className="block max-h-48 w-full resize-none rounded-[1.25rem] border border-borda bg-papel-alto px-4 py-2.5 font-serifada text-[1rem] leading-[1.6] text-tinta focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none"
        />
        <p id={idDica} className="mt-1 flex justify-between gap-2 px-1 text-xs text-tinta-suave">
          <span>Enter quebra a linha; Ctrl+Enter envia.</span>
          {texto.length > AVISO_DE_CARACTERES && (
            <span className={`tabular-nums ${passou ? "font-semibold text-destaque" : ""}`}>
              {texto.length.toLocaleString("pt-BR")}/{MENSAGEM_MAX_CARACTERES.toLocaleString("pt-BR")}
            </span>
          )}
        </p>
        {erro && (
          <p role="alert" className="px-1 text-xs text-destaque">
            {erro}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={vazio || passou || enviando}
        aria-label="Enviar"
        title="Enviar (Ctrl+Enter)"
        className="mb-6 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-destaque text-papel transition-[filter,opacity] duration-150 hover:brightness-110 disabled:cursor-default disabled:opacity-40"
      >
        <IconeEnviar className="h-5 w-5" />
      </button>
    </form>
  );
}
