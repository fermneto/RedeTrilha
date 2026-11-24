"use client";
// Botão que pede confirmação ali mesmo: vira "<pergunta> sim / não". Usado no
// apagar poema, no apagar comentário e no apagar antologia. Ao abrir, o foco vai
// para o "não" (Enter sem querer não confirma); Esc ou clique fora cancelam.

import { useEffect, useRef, useState } from "react";

import { useFecharAoSair } from "@/hooks/useFecharAoSair";

type Props = {
  pergunta: string;
  // Texto do botão antes da confirmação (ex.: "apagar", "apagando...").
  rotulo: string;
  classeDoBotao: string;
  aoConfirmar: () => void;
  // Desabilita o botão e o "sim" (ex.: enquanto apaga).
  desabilitado?: boolean;
  // Letra menor e sem a altura mínima de toque (ações miúdas, como no comentário).
  compacta?: boolean;
  // Cancelar pelo "não" ou pelo Esc devolve o foco ao botão; o clique fora deixa
  // o foco onde o clique o pôs.
  devolverFoco?: boolean;
  // Aviso que aparece só durante a confirmação, depois do "sim / não".
  children?: React.ReactNode;
};

export function ConfirmacaoInline({
  pergunta,
  rotulo,
  classeDoBotao,
  aoConfirmar,
  desabilitado = false,
  compacta = false,
  devolverFoco = true,
  children,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const confirmacao = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmando) confirmacao.current?.querySelector<HTMLButtonElement>("button:last-of-type")?.focus();
  }, [confirmando]);

  function cancelar(focarBotao: boolean) {
    setConfirmando(false);
    if (devolverFoco && focarBotao) requestAnimationFrame(() => botao.current?.focus());
  }

  useFecharAoSair(confirmando, confirmacao, (e) => cancelar(e.type === "keydown"));

  if (!confirmando) {
    return (
      <button
        ref={botao}
        type="button"
        onClick={() => setConfirmando(true)}
        disabled={desabilitado}
        className={classeDoBotao}
      >
        {rotulo}
      </button>
    );
  }

  const alturaDeToque = compacta ? "" : "min-h-11 ";
  return (
    <div ref={confirmacao} className={`${compacta ? "text-xs" : "text-sm"} text-tinta-suave`}>
      {pergunta}{" "}
      <button
        type="button"
        onClick={() => {
          setConfirmando(false);
          aoConfirmar();
        }}
        disabled={desabilitado}
        className={`${alturaDeToque}cursor-pointer text-destaque hover:underline disabled:opacity-50`}
      >
        sim
      </button>{" "}
      /{" "}
      <button type="button" onClick={() => cancelar(true)} className={`${alturaDeToque}cursor-pointer hover:text-tinta`}>
        não
      </button>
      {children}
    </div>
  );
}
