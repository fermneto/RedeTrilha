"use client";
// A barra de ações de um poema ou de uma renga (#171: as duas têm as mesmas):
// curtir, repostar, citar, comentar, guardar numa antologia e enviar por mensagem.
// O PoemaCard a usa pelo `Acoes`; o RengaCard e a página da renga, pelo `AcoesDaRenga`.

import Link from "next/link";
import { useRef, useState } from "react";

import { AntologiaSeletor } from "@/components/AntologiaSeletor";
import { EnviarPorMensagem } from "@/components/EnviarPorMensagem";
import { IconeCitar } from "@/components/icones/IconeCitar";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { IconeCurtir } from "@/components/icones/IconeCurtir";
import { IconeRepostar } from "@/components/icones/IconeRepostar";
import { caminhoDaCitacao, curtir, mensagemDeFalha, repostar, type Alvo, type Renga } from "@/lib/api";
import { contagemCurta } from "@/lib/numeros";
import { avisarAcao } from "@/lib/repercussao";
import { lembrarAcao } from "@/lib/sessaoDoFeed";

// As ações da renga, como as do poema; a conversa é a da página da renga.
export function AcoesDaRenga({ renga, contadores = false }: { renga: Renga; contadores?: boolean }) {
  return (
    <BarraDeAcoes
      alvo={{ tipo: "renga", id: renga.id }}
      inicial={renga}
      comentarios={renga.comentarios}
      caminhoDaConversa={`/rengas/${renga.id}#comentarios`}
      contadores={contadores}
    />
  );
}

// O que a barra precisa saber do poema ou da renga (#171: as duas têm as mesmas ações).
type EstadoDasAcoes = { curti: boolean; curtidas: number; repostei: boolean; reposts: number };

// Curtir e repostar mudam a tela antes da resposta e voltam atrás se o backend falhar.
// Dando certo, o feed guardado (lib/sessaoDoFeed.ts) fica sabendo: ao voltar ao
// Início, o botão mostra o estado novo; e a repercussão da página (quem curtiu,
// quem repostou) põe ou tira a pessoa sem pedir nada ao backend (lib/repercussao.ts).
// Enquanto um pedido da ação está em voo, novos cliques nela são ignorados: dois
// pedidos simultâneos podem ser processados fora de ordem e deixar a tela
// diferente do servidor.
// `contadores`: na página da conversa, a linha "12 curtidas · 2 reposts" acima
// dos botões, com os números por extenso (e otimistas, como os botões).
// Serve ao poema (Acoes) e à renga (AcoesDaRenga, no RengaCard): `alvo` diz qual.
export function BarraDeAcoes({
  alvo,
  inicial,
  comentarios,
  caminhoDaConversa,
  contadores = false,
}: {
  alvo: Alvo;
  inicial: EstadoDasAcoes;
  comentarios: number;
  caminhoDaConversa: string;
  contadores?: boolean;
}) {
  const [curti, setCurti] = useState(inicial.curti);
  const [curtidas, setCurtidas] = useState(inicial.curtidas);
  const [repostei, setRepostei] = useState(inicial.repostei);
  const [reposts, setReposts] = useState(inicial.reposts);
  const [erro, setErro] = useState<string | null>(null);
  const curtindo = useRef(false);
  const repostando = useRef(false);

  async function alternarCurtida() {
    if (curtindo.current) return;
    curtindo.current = true;
    const novo = !curti;
    setCurti(novo);
    setCurtidas((n) => n + (novo ? 1 : -1));
    setErro(null);
    try {
      await curtir(alvo, novo);
      lembrarAcao(alvo, { curti: novo, curtidas: curtidas + (novo ? 1 : -1), repostei, reposts });
      avisarAcao({ alvo, acao: "curtidas", ativo: novo });
    } catch (e) {
      setCurti(!novo);
      setCurtidas((n) => n + (novo ? -1 : 1));
      setErro(mensagemDeFalha(e, "não deu para curtir"));
    } finally {
      curtindo.current = false;
    }
  }

  async function alternarRepost() {
    if (repostando.current) return;
    repostando.current = true;
    const novo = !repostei;
    setRepostei(novo);
    setReposts((n) => n + (novo ? 1 : -1));
    setErro(null);
    try {
      await repostar(alvo, novo);
      lembrarAcao(alvo, { curti, curtidas, repostei: novo, reposts: reposts + (novo ? 1 : -1) });
      avisarAcao({ alvo, acao: "reposts", ativo: novo });
    } catch (e) {
      setRepostei(!novo);
      setReposts((n) => n + (novo ? -1 : 1));
      setErro(mensagemDeFalha(e, "não deu para repostar"));
    } finally {
      repostando.current = false;
    }
  }

  // Como no X: só ícone (20 px) e número, e o número some quando é zero. O nome
  // da ação vai no aria-label (com o número, que o aria-label esconderia) e no
  // title. As seis ações ficam em casas iguais (grid-cols-6), com o ícone no
  // mesmo ponto de cada casa e o número logo depois, como no X: os ícones ficam
  // à mesma distância uns dos outros, tenham número ou não. O círculo do hover
  // tem 34 px e o número vem colado nele (Contador), para um número de três
  // algarismos caber antes do ícone seguinte numa tela de 390 px. Cada botão
  // ainda tem área de toque de 44×44 px; o -ml-[0.4375rem] da linha alinha o
  // primeiro ícone com o texto do poema.
  const botao =
    "group inline-flex min-h-11 min-w-11 cursor-pointer items-center tabular-nums transition-colors duration-150 hover:text-destaque";
  const icone = "h-5 w-5";
  const circulo =
    "flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full transition-colors duration-150 group-hover:bg-destaque/10";
  const rotulo = (acao: string, n?: number) => (n ? `${acao} (${n})` : acao);
  const linha = [
    [curtidas, "curtida", "curtidas"],
    [reposts, "repost", "reposts"],
    [comentarios, "comentário", "comentários"],
  ] as const;
  return (
    <div className="mt-1">
      {contadores && (
        <p className="mb-1 flex flex-wrap gap-x-4 text-sm text-tinta-suave tabular-nums" aria-live="polite">
          {linha.map(([n, um, varios]) => (
            <span key={um}>
              <strong className="font-semibold text-tinta">{n}</strong> {n === 1 ? um : varios}
            </span>
          ))}
        </p>
      )}
      <div className="-ml-[0.4375rem] grid max-w-sm grid-cols-6 justify-items-start text-[0.8125rem] text-tinta-suave">
        <button
          type="button"
          onClick={alternarCurtida}
          aria-pressed={curti}
          aria-label={rotulo("curtir", curtidas)}
          title="curtir"
          className={`${botao} ${curti ? "text-destaque" : ""}`}
        >
          <span className={circulo}>
            <IconeCurtir cheio={curti} className={icone} />
          </span>
          {!contadores && <Contador n={curtidas} />}
        </button>
        <button
          type="button"
          onClick={alternarRepost}
          aria-pressed={repostei}
          aria-label={rotulo("repostar", reposts)}
          title="repostar"
          className={`${botao} ${repostei ? "text-destaque" : ""}`}
        >
          <span className={circulo}>
            <IconeRepostar className={icone} />
          </span>
          {!contadores && <Contador n={reposts} />}
        </button>
        <Link href={caminhoDaCitacao(alvo)} aria-label="citar" title="citar" className={botao}>
          <span className={circulo}>
            <IconeCitar className={icone} />
          </span>
        </Link>
        <Link
          href={caminhoDaConversa}
          aria-label={rotulo("comentar", comentarios)}
          title="comentar"
          className={botao}
        >
          <span className={circulo}>
            <IconeComentar className={icone} />
          </span>
          {!contadores && <Contador n={comentarios} />}
        </Link>
        <AntologiaSeletor alvo={alvo} classeBotao={botao} classeCirculo={circulo} classeIcone={icone} />
        <EnviarPorMensagem alvo={alvo} classeBotao={botao} classeCirculo={circulo} classeIcone={icone} />
      </div>
      {erro && <p className="mt-2 text-xs text-destaque">{erro}</p>}
    </div>
  );
}

// O número entra 3 px por cima da borda do círculo: fica a 4 px do ícone, e
// "999" ainda termina a 4 px do ícone da casa seguinte numa tela de 390 px. De
// mil em diante ele vem abreviado (lib/numeros.ts).
function Contador({ n }: { n: number }) {
  return n > 0 ? (
    <span aria-hidden="true" className="-ml-[0.1875rem] whitespace-nowrap">
      {contagemCurta(n)}
    </span>
  ) : null;
}
