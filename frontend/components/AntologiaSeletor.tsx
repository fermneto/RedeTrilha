"use client";
// Ação "Adicionar à antologia" do PoemaCard: o botão abre um popover com as
// minhas antologias (marcar/desmarcar põe e tira o poema) e "+ nova antologia".
// Fecha com Esc (o foco volta ao botão), clique fora ou quando o foco sai dele.

import { useEffect, useId, useRef, useState } from "react";

import { SeloPrivada } from "@/components/AntologiaLista";
import { IconeAdicionarAntologia } from "@/components/icones/IconeAdicionarAntologia";
import { useFecharAoSair } from "@/hooks/useFecharAoSair";
import {
  ANTOLOGIA_NOME_MAX,
  buscarAntologia,
  criarAntologia,
  listarMinhasAntologias,
  marcarNaAntologia,
  type Antologia,
} from "@/lib/api";

type Props = {
  postId: number;
  // Classes da barra de ações do card, para o botão ficar igual aos outros.
  classeBotao: string;
  classeCirculo: string;
  classeIcone: string;
};

export function AntologiaSeletor({ postId, classeBotao, classeCirculo, classeIcone }: Props) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idPopover = useId();

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }

  // Esc devolve o foco ao botão; o clique fora deixa o foco onde o clique o pôs.
  useFecharAoSair(aberto, caixa, (e) => {
    if (e.type === "keydown") e.preventDefault();
    fechar(e.type === "keydown");
  });

  // Tab para fora do popover (ou do botão) também fecha. Sem relatedTarget (o
  // elemento focado saiu da tela, como o "+ nova antologia" ao virar formulário),
  // não fecha: o clique fora já cobre o resto.
  function aoSairOFoco(e: React.FocusEvent) {
    const destino = e.relatedTarget as Node | null;
    if (aberto && destino && !caixa.current?.contains(destino)) setAberto(false);
  }

  return (
    <div ref={caixa} className="relative" onBlur={aoSairOFoco}>
      <button
        ref={botao}
        type="button"
        onClick={() => (aberto ? fechar(false) : setAberto(true))}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-controls={aberto ? idPopover : undefined}
        aria-label="adicionar à antologia"
        title="adicionar à antologia"
        className={`${classeBotao} ${aberto ? "text-destaque" : ""}`}
      >
        <span className={classeCirculo}>
          <IconeAdicionarAntologia className={classeIcone} />
        </span>
      </button>
      {aberto && <Popover id={idPopover} postId={postId} />}
    </div>
  );
}

// Cada antologia com a marca de "o poema está nela".
type Linha = Antologia & { contem: boolean };

function Popover({ id, postId }: { id: string; postId: number }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const painel = useRef<HTMLDivElement>(null);
  const campoNome = useRef<HTMLInputElement>(null);
  const idTitulo = useId();

  // O backend não diz em quais antologias o poema está: lê o detalhe de cada uma.
  useEffect(() => {
    let vivo = true;
    listarMinhasAntologias()
      .then((pagina) =>
        Promise.all(
          pagina.items.map(async (a) => {
            const detalhe = await buscarAntologia(a.id);
            return { ...a, contem: detalhe.poemas.some((p) => p.id === postId) };
          }),
        ),
      )
      .then((todas) => vivo && setLinhas(todas))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "não deu para carregar as antologias"));
    return () => {
      vivo = false;
    };
  }, [postId]);

  // Foco gerenciado: ao abrir vai para o painel; depois de carregar, para a primeira
  // antologia (ou para "+ nova antologia", se não houver nenhuma).
  const carregou = linhas !== null;
  useEffect(() => {
    if (!carregou) {
      painel.current?.focus();
      return;
    }
    focar("input, button");
  }, [carregou]);

  function focar(seletor: string) {
    requestAnimationFrame(() => painel.current?.querySelector<HTMLElement>(seletor)?.focus());
  }

  function abrirCriacao() {
    setCriando(true);
    requestAnimationFrame(() => campoNome.current?.focus());
  }

  function fecharCriacao() {
    setCriando(false);
    setNome("");
    focar("[data-nova]");
  }

  // Otimista: marca na hora e desfaz se o backend falhar.
  async function alternar(linha: Linha) {
    const novo = !linha.contem;
    const trocar = (contem: boolean) =>
      setLinhas((atuais) =>
        (atuais ?? []).map((l) =>
          l.id === linha.id ? { ...l, contem, qtd: l.qtd + (contem === l.contem ? 0 : contem ? 1 : -1) } : l,
        ),
      );
    trocar(novo);
    setErro(null);
    try {
      await marcarNaAntologia(linha.id, postId, novo);
    } catch (e) {
      trocar(!novo);
      setErro(e instanceof Error ? e.message : "não deu para mudar a antologia");
    }
  }

  // Cria a antologia (pública, como no backend) e já põe o poema nela.
  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("a antologia precisa de um nome");
      campoNome.current?.focus();
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const nova = await criarAntologia({ nome });
      await marcarNaAntologia(nova.id, postId, true);
      setLinhas((atuais) => [{ ...nova, qtd: 1, contem: true }, ...(atuais ?? [])]);
      setNome("");
      setCriando(false);
      focar("input[type=checkbox]");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "não deu para criar a antologia");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      ref={painel}
      id={id}
      role="dialog"
      aria-labelledby={idTitulo}
      tabIndex={-1}
      className="absolute top-full right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-borda bg-papel-alto p-2 text-sm text-tinta shadow-lg focus:outline-none"
    >
      <p id={idTitulo} className="px-2 pt-1 pb-2 font-bold">
        Adicionar à antologia
      </p>

      {linhas === null && !erro && <p className="px-2 py-2 text-tinta-suave">carregando...</p>}

      {linhas !== null && linhas.length === 0 && !criando && (
        <p className="px-2 py-1 text-tinta-suave">Você ainda não tem antologias.</p>
      )}

      {linhas !== null && linhas.length > 0 && (
        <ul className="max-h-60 overflow-y-auto">
          {linhas.map((l) => (
            <li key={l.id}>
              <label className="realce flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2">
                <input
                  type="checkbox"
                  checked={l.contem}
                  onChange={() => alternar(l)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-destaque)]"
                />
                <span className="min-w-0 flex-1 truncate">{l.nome}</span>
                {!l.publica && <SeloPrivada />}
              </label>
            </li>
          ))}
        </ul>
      )}

      {erro && (
        <p role="alert" className="px-2 py-1 text-xs text-destaque">
          {erro}
        </p>
      )}

      <div className="mt-1 border-t border-borda pt-1">
        {criando ? (
          <form onSubmit={criar} noValidate className="space-y-2 p-2">
            <label className="block text-xs text-tinta-suave">
              Nome da nova antologia
              <input
                ref={campoNome}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={ANTOLOGIA_NOME_MAX}
                required
                className="mt-1 w-full rounded-xl border border-borda bg-papel px-3 py-2 text-sm text-tinta focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={enviando}
                className="min-h-9 cursor-pointer rounded-full bg-destaque px-4 text-xs font-bold text-papel disabled:opacity-50"
              >
                {enviando ? "criando..." : "criar e adicionar"}
              </button>
              <button
                type="button"
                onClick={fecharCriacao}
                className="realce min-h-9 cursor-pointer rounded-full px-3 text-xs"
              >
                cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            data-nova
            onClick={abrirCriacao}
            className="realce flex min-h-11 w-full cursor-pointer items-center rounded-xl px-2 text-left font-semibold text-destaque"
          >
            + nova antologia
          </button>
        )}
      </div>
    </div>
  );
}
