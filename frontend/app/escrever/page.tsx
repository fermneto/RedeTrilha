"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Compositor, type PoemaEmAndamento } from "@/components/Compositor";
import { ConfirmacaoDaTroca } from "@/components/ConfirmacaoDaTroca";
import { FormatoDeEscrita, type Formato } from "@/components/FormatoDeEscrita";
import { caminhoDoLogin, criarRascunho, editarRascunho, temToken, textoDaCitacaoDeVersos } from "@/lib/api";
import { guardarPoemaParaRenga, temPoema } from "@/lib/trocaDeFormato";

// useSearchParams precisa de Suspense no build estático do Next.
export default function EscreverPage() {
  return (
    <Suspense>
      <Escrever />
    </Suspense>
  );
}

function Escrever() {
  const router = useRouter();
  const params = useSearchParams();
  const citarId = idDoParametro(params.get("citar"));
  // "citar estes versos", na página do poema: os versos vêm no parâmetro `versos`.
  const versos = citarId === null ? null : params.get("versos");
  // /escrever?rascunho=3 abre o rascunho no compositor (vindo da aba Rascunhos do perfil).
  const rascunhoId = citarId === null ? idDoParametro(params.get("rascunho")) : null;
  // Rascunho de citação: o compositor avisa ao carregar, e o título vira "Citar poema".
  const [rascunhoDeCitacao, setRascunhoDeCitacao] = useState(false);

  useEffect(() => {
    if (!temToken()) router.replace(caminhoDoLogin());
  }, [router]);

  // O seletor Poema · Renga · Antologia só num poema novo: citação e rascunho já
  // têm formato.
  const poemaNovo = citarId === null && rascunhoId === null;
  // O poema em andamento (o compositor conta a cada mudança) e a pergunta da antologia.
  const poema = useRef<PoemaEmAndamento | null>(null);
  const [perguntando, setPerguntando] = useState(false);
  const linkDaAntologia = useRef<HTMLAnchorElement | null>(null);

  // Sem poema, troca direto. Com poema: a renga leva o poema (corpo e título) pelo
  // sessionStorage; a antologia pergunta antes o que fazer com ele (decisão 17).
  function aoEscolher(formato: Formato, e: React.MouseEvent<HTMLAnchorElement>) {
    const atual = poema.current;
    if (!atual || !temPoema(atual.dados.texto)) return;
    if (formato === "renga") {
      guardarPoemaParaRenga({ titulo: atual.dados.titulo ?? "", texto: atual.dados.texto });
      return;
    }
    e.preventDefault();
    linkDaAntologia.current = e.currentTarget;
    setPerguntando(true);
  }

  async function salvarEIrParaAntologia() {
    const atual = poema.current;
    if (atual) {
      if (atual.rascunhoId === null) await criarRascunho(atual.dados);
      else await editarRascunho(atual.rascunhoId, atual.dados);
    }
    router.replace("/antologias/nova");
  }

  function continuarEscrevendo(comTeclado: boolean) {
    setPerguntando(false);
    if (comTeclado) requestAnimationFrame(() => linkDaAntologia.current?.focus());
  }

  return (
    <div>
      <CabecalhoPagina titulo={citarId === null && !rascunhoDeCitacao ? "Escrever" : "Citar poema"} />
      {poemaNovo && (
        <FormatoDeEscrita atual="poema" aoEscolher={aoEscolher}>
          {perguntando && (
            <ConfirmacaoDaTroca
              aoSalvar={salvarEIrParaAntologia}
              aoDescartar={() => router.replace("/antologias/nova")}
              aoContinuar={continuarEscrevendo}
            />
          )}
        </FormatoDeEscrita>
      )}
      <div className="px-4 py-5">
        <Compositor
          key={citarId ?? (rascunhoId !== null ? `rascunho-${rascunhoId}` : "novo")}
          citarId={citarId}
          textoInicial={versos ? textoDaCitacaoDeVersos(versos) : undefined}
          rascunhoId={rascunhoId}
          aoAbrirCitacao={() => setRascunhoDeCitacao(true)}
          aoMudar={(p) => {
            poema.current = p;
          }}
        />
      </div>
    </div>
  );
}

function idDoParametro(valor: string | null): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}
