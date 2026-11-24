"use client";
// Selo de poeta consagrado: um lacre de cera (borda em dez lóbulos) com uma pena
// de escrever no meio, na cor de destaque. Fica logo depois do nome, na altura do
// texto. Não depende só da cor: a forma é própria, tem aria-label e um tooltip no
// hover com "domínio público" e os anos de vida.

import { useEffect, useId, useState } from "react";

import { anosDeVida, type User } from "@/lib/api";

const ROTULO_CONSAGRADO = "Poeta consagrado (domínio público)";

// Largura máxima do tooltip (max-w-56) e folga mínima até a borda da tela.
const LARGURA_DO_TOOLTIP = 224;
const MARGEM_DA_TELA = 8;

// Centrado no selo, o tooltip passaria da borda num selo perto dela e criava
// rolagem horizontal no celular. Perto da borda direita, ele se alinha pela direita
// do selo (cresce para a esquerda); perto da esquerda, pela esquerda. Decide pela
// posição do selo antes de abrir, então nunca chega a ser desenhado fora da tela.
type Alinhamento = "centro" | "direita" | "esquerda";

const POSICAO: Record<Alinhamento, string> = {
  centro: "left-1/2 -translate-x-1/2",
  direita: "right-0",
  esquerda: "left-0",
};

function alinhamentoPara(selo: DOMRect): Alinhamento {
  const meio = selo.left + selo.width / 2;
  const largura = document.documentElement.clientWidth;
  if (meio + LARGURA_DO_TOOLTIP / 2 > largura - MARGEM_DA_TELA) return "direita";
  if (meio - LARGURA_DO_TOOLTIP / 2 < MARGEM_DA_TELA) return "esquerda";
  return "centro";
}

// Lacre: círculo de borda ondulada (dez lóbulos, raio 8,9 a 10). Pena: bico de
// escrever com a fenda e o furo, vazado na cor do papel.
function Lacre({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M9.25 3.54Q12 .4 14.75 3.54Q18.82 2.62 19.2 6.77Q23.03 8.42 20.9 12Q23.03 15.58 19.2 17.23Q18.82 21.38 14.75 20.46Q12 23.6 9.25 20.46Q5.18 21.38 4.8 17.23Q.97 15.58 3.1 12Q.97 8.42 4.8 6.77Q5.18 2.62 9.25 3.54Z"
      />
      <path
        fill="var(--color-papel)"
        d="M12 17.25L8.9 12.4C8.9 10.5 10.1 8.9 12 7.6C13.9 8.9 15.1 10.5 15.1 12.4Z"
      />
      <path stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" d="M12 16.3V12.9" />
      <circle cx="12" cy="11.9" r="0.95" fill="currentColor" />
    </svg>
  );
}

export function SeloConsagrado({ usuario, className = "h-[1.1em] w-[1.1em]" }: { usuario: User; className?: string }) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [alinhamento, setAlinhamento] = useState<Alinhamento>("centro");

  // Esc fecha o tooltip aberto pelo hover, sem mover o ponteiro nem o foco
  // (WCAG 1.4.13, "dispensável"). Ele só volta quando o ponteiro sai e entra de novo.
  useEffect(() => {
    if (!aberto) return;
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto]);

  if (!usuario.consagrado) return null;
  const vida = anosDeVida(usuario);

  // Fora da ordem de Tab: o aria-label já diz o que é, e o nome do autor ao lado é
  // um link para o perfil, que mostra a linha "Poeta consagrado · anos · domínio
  // público". O tooltip é descendente do selo, então passar o ponteiro do selo para
  // ele não dispara o mouseleave ("hoverable"); o pt-1.5 transparente é a ponte
  // sobre o vão, para o ponteiro não cair fora no caminho.
  return (
    <span
      role="img"
      aria-label={ROTULO_CONSAGRADO}
      aria-describedby={id}
      onMouseEnter={(e) => {
        setAlinhamento(alinhamentoPara(e.currentTarget.getBoundingClientRect()));
        setAberto(true);
      }}
      onMouseLeave={() => setAberto(false)}
      className="relative inline-flex shrink-0 cursor-help items-center align-[-0.15em] text-destaque"
    >
      <Lacre className={className} />
      <span hidden={!aberto} className={`absolute top-full z-40 pt-1.5 ${POSICAO[alinhamento]}`}>
        <span
          id={id}
          role="tooltip"
          className="block w-max max-w-56 rounded-lg bg-tinta px-2.5 py-1.5 text-left text-xs leading-snug font-medium tracking-normal text-papel shadow-[0_4px_16px_-4px_rgb(0_0_0/0.3)]"
        >
          Poeta consagrado · domínio público
          {vida && <span className="block font-normal tabular-nums opacity-80">{vida}</span>}
        </span>
      </span>
    </span>
  );
}
