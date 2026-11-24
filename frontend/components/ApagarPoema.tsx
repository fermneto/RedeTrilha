"use client";
// "apagar poema" do autor, na página do poema. Pede confirmação ali mesmo, como
// no apagar comentário e no apagar antologia: vira "apagar o poema? sim / não";
// Esc ou clique fora cancelam. O aviso do que se perde aparece só na confirmação.

import { useEffect, useRef, useState } from "react";

import { useFecharAoSair } from "@/hooks/useFecharAoSair";
import { apagarPoema } from "@/lib/api";

type Props = {
  postId: number;
  // Chamado depois que o backend apagou: a página sai do poema, que não existe mais.
  aoApagar: () => void;
};

export function ApagarPoema({ postId, aoApagar }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const confirmacao = useRef<HTMLDivElement>(null);
  const botaoApagar = useRef<HTMLButtonElement>(null);

  // O foco vai para o "não": Enter sem querer não apaga nada.
  useEffect(() => {
    if (confirmando) confirmacao.current?.querySelector<HTMLButtonElement>("button:last-of-type")?.focus();
  }, [confirmando]);

  // Esc devolve o foco ao "apagar"; o clique fora deixa o foco onde o clique o pôs.
  useFecharAoSair(confirmando, confirmacao, (e) => {
    setConfirmando(false);
    if (e.type === "keydown") requestAnimationFrame(() => botaoApagar.current?.focus());
  });

  async function apagar() {
    setConfirmando(false);
    setApagando(true);
    setErro(null);
    try {
      await apagarPoema(postId);
      aoApagar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu para apagar o poema");
      setApagando(false);
    }
  }

  return (
    // pl-17: alinha com o texto do card (px-4 + avatar de 40 px + gap-3).
    <div className="pr-4 pb-3 pl-17">
      {confirmando ? (
        <div ref={confirmacao} className="text-sm text-tinta-suave">
          apagar o poema?{" "}
          <button type="button" onClick={apagar} className="min-h-11 cursor-pointer text-destaque hover:underline">
            sim
          </button>{" "}
          /{" "}
          <button
            type="button"
            onClick={() => {
              setConfirmando(false);
              requestAnimationFrame(() => botaoApagar.current?.focus());
            }}
            className="min-h-11 cursor-pointer hover:text-tinta"
          >
            não
          </button>
          <p className="text-xs">
            O poema publicado não se edita: para corrigir, apague e publique de novo. Curtidas, comentários e
            críticas nos versos, reposts e o lugar nas antologias vão junto; as citações ficam sem o original.
          </p>
        </div>
      ) : (
        <button
          ref={botaoApagar}
          type="button"
          onClick={() => setConfirmando(true)}
          disabled={apagando}
          className="min-h-11 cursor-pointer text-sm text-tinta-suave hover:text-tinta disabled:opacity-50"
        >
          {apagando ? "apagando..." : "apagar poema"}
        </button>
      )}
      {erro && <p className="mt-1 text-sm text-destaque">{erro}</p>}
    </div>
  );
}
