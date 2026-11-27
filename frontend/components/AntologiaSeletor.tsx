"use client";
// Ação "Adicionar à antologia" do poema e da renga (BarraDeAcoes): o botão abre um
// popover com as minhas antologias (marcar/desmarcar põe e tira o poema ou a
// renga) e "+ nova antologia".
// Fecha com Esc (o foco volta ao botão), clique fora ou quando o foco sai dele.

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { SwitchPublica } from "@/components/AntologiaFormulario";
import { SeloPrivada } from "@/components/AntologiaLista";
import { EsqueletoDoMenu } from "@/components/Esqueleto";
import { IconeAdicionarAntologia } from "@/components/icones/IconeAdicionarAntologia";
import { useFecharAoSair } from "@/hooks/useFecharAoSair";
import {
  ANTOLOGIA_NOME_MAX,
  criarAntologia,
  listarMinhasAntologiasMarcando,
  marcarNaAntologia,
  mensagemDeFalha,
  type Alvo,
  type AntologiaMarcada,
} from "@/lib/api";

// Avisa a página aberta que um poema (ou uma renga) entrou ou saiu de uma
// antologia pelo popover (o detalhe da antologia o tira da lista na hora). Evento
// de window para não passar callbacks por dentro do PoemaCard.
const EVENTO = "verso:antologia-mudou";

type MudancaNaAntologia = { antologiaId: number; alvo: Alvo; contem: boolean };

function avisarMudanca(mudanca: MudancaNaAntologia) {
  window.dispatchEvent(new CustomEvent<MudancaNaAntologia>(EVENTO, { detail: mudanca }));
}

// Assina as mudanças; devolve a função que cancela a assinatura (para o useEffect).
export function ouvirMudancas(aoMudar: (mudanca: MudancaNaAntologia) => void): () => void {
  const ouvinte = (e: Event) => aoMudar((e as CustomEvent<MudancaNaAntologia>).detail);
  window.addEventListener(EVENTO, ouvinte);
  return () => window.removeEventListener(EVENTO, ouvinte);
}

type Props = {
  alvo: Alvo;
  // Classes da barra de ações do card, para o botão ficar igual aos outros.
  classeBotao: string;
  classeCirculo: string;
  classeIcone: string;
};

export function AntologiaSeletor({ alvo, classeBotao, classeCirculo, classeIcone }: Props) {
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
      {aberto && <Popover id={idPopover} alvo={alvo} />}
    </div>
  );
}

// Cada antologia com a marca de "o poema está nela".
type Linha = AntologiaMarcada;

// Onde a tela acaba para o popover: no celular, a barra de navegação fixa
// cobre o fim da tela, então o limite é o topo dela.
function fimDaTela(): number {
  const barra = document.querySelector<HTMLElement>('nav[aria-label="Principal"]');
  const topo = barra && getComputedStyle(barra).position === "fixed" ? barra.getBoundingClientRect().top : 0;
  return topo > 0 ? topo : window.innerHeight;
}

function Popover({ id, alvo }: { id: string; alvo: Alvo }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [publica, setPublica] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const painel = useRef<HTMLDivElement>(null);
  const campoNome = useRef<HTMLInputElement>(null);
  const idTitulo = useId();
  const idSwitch = useId();
  // Abre para cima quando não cabe embaixo do botão (e em cima há mais espaço).
  const [paraCima, setParaCima] = useState(false);

  // Mede de novo quando o popover muda de altura (carregou, abriu a criação, erro).
  useLayoutEffect(() => {
    const ancora = painel.current?.parentElement?.getBoundingClientRect();
    const altura = painel.current?.offsetHeight ?? 0;
    if (!ancora) return;
    const abaixo = fimDaTela() - ancora.bottom;
    const acima = ancora.top;
    setParaCima(altura + 8 > abaixo && acima > abaixo);
  }, [linhas, criando, erro]);

  // Uma requisição por abertura: o backend já diz em quais o poema (ou a renga) está.
  const { tipo, id: alvoId } = alvo;
  useEffect(() => {
    let vivo = true;
    listarMinhasAntologiasMarcando({ tipo, id: alvoId })
      .then((pagina) => vivo && setLinhas(pagina.items))
      .catch((e) => vivo && setErro(mensagemDeFalha(e, "não deu para carregar as antologias")));
    return () => {
      vivo = false;
    };
  }, [tipo, alvoId]);

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
    setPublica(true);
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
      await marcarNaAntologia(linha.id, alvo, novo);
      avisarMudanca({ antologiaId: linha.id, alvo, contem: novo });
    } catch (e) {
      trocar(!novo);
      setErro(mensagemDeFalha(e, "não deu para mudar a antologia"));
    }
  }

  // Cria a antologia (pública por padrão) e já põe o poema (ou a renga) nela.
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
      const nova = await criarAntologia({ nome, publica });
      await marcarNaAntologia(nova.id, alvo, true);
      setLinhas((atuais) => [{ ...nova, qtd: 1, contem: true }, ...(atuais ?? [])]);
      setNome("");
      setPublica(true);
      setCriando(false);
      focar("input[type=checkbox]");
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para criar a antologia"));
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
      className={`absolute right-0 z-20 ${paraCima ? "bottom-full mb-1" : "top-full mt-1"} w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-borda bg-papel-alto p-2 text-sm text-tinta shadow-lg focus:outline-none`}
    >
      <p id={idTitulo} className="px-2 pt-1 pb-2 font-bold">
        Adicionar à antologia
      </p>

      {linhas === null && !erro && <EsqueletoDoMenu quantos={2} com="caixa" />}

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
                <span className="shrink-0 text-xs text-tinta-suave tabular-nums">
                  <span className="sr-only">, </span>
                  {l.qtd}
                  <span className="sr-only"> {l.qtd === 1 ? "poema" : "poemas"}</span>
                </span>
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs">
                {/* Rótulo fixo: o leitor de tela anuncia "Pública, ligado/desligado". */}
                <label htmlFor={idSwitch} className="cursor-pointer font-semibold">
                  Pública
                </label>
                <span className="block text-tinta-suave" aria-live="polite">
                  {publica ? "Aparece no seu perfil." : "Privada: só você vê."}
                </span>
              </span>
              <SwitchPublica id={idSwitch} publica={publica} aoMudar={setPublica} />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={enviando}
                className="min-h-10 cursor-pointer rounded-full bg-destaque px-4 text-xs font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
              >
                {enviando ? "criando..." : "criar e adicionar"}
              </button>
              <button
                type="button"
                onClick={fecharCriacao}
                className="realce min-h-10 cursor-pointer rounded-full px-3 text-xs"
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
