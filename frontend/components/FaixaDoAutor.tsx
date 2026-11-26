"use client";
// A faixa do autor no alto da página do poema: o avatar grande, o nome (com o
// selo do consagrado), o @ e a data, e o "Seguir" à direita. Quem escreve vem
// antes do poema, como numa rede social; o poema continua sendo o centro da página.
//
// Se eu sigo a pessoa não vem no poema: a faixa pede o perfil dela ao montar (só
// a folha à vista monta) e mostra o botão quando ele chega. No meu próprio poema,
// sem botão. Seguir é otimista e volta atrás se o backend falhar.

import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { NomeAutor } from "@/components/NomeAutor";
import { buscarEu, buscarPerfil, formatarData, mensagemDeFalha, seguir, type User } from "@/lib/api";

// O usuário da sessão, pedido uma vez para todas as faixas do livro.
let euDaSessao: Promise<User | null> | null = null;
function lerEu(): Promise<User | null> {
  euDaSessao ??= buscarEu().catch(() => {
    euDaSessao = null;
    return null;
  });
  return euDaSessao;
}

export function FaixaDoAutor({ autor, criadoEm }: { autor: User; criadoEm: string }) {
  // null: ainda não sei (ou é o meu poema), e o botão não aparece.
  const [sigo, setSigo] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([lerEu(), buscarPerfil(autor.username)])
      .then(([eu, perfil]) => {
        if (vivo && eu?.id !== perfil.id) setSigo(perfil.sigo);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [autor.username]);

  async function alternar() {
    if (sigo === null || enviando) return;
    const novo = !sigo;
    setSigo(novo);
    setErro(null);
    setEnviando(true);
    try {
      await seguir(autor.username, novo);
    } catch (e) {
      setSigo(!novo);
      setErro(mensagemDeFalha(e, "não deu para seguir"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3">
        <Link href={`/u/${autor.username}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
          <Avatar usuario={autor} tamanho="l" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <NomeAutor usuario={autor} className="text-[0.9375rem] font-bold text-tinta" />
          <p className="truncate text-[0.8125rem] text-tinta-suave tabular-nums">
            @{autor.username}
            {!autor.consagrado && (
              <>
                {" · "}
                <time dateTime={criadoEm}>{formatarData(criadoEm)}</time>
              </>
            )}
          </p>
        </div>
        {sigo !== null && (
          <button
            type="button"
            onClick={alternar}
            aria-pressed={sigo}
            aria-label={sigo ? `Seguindo ${autor.name}` : `Seguir ${autor.name}`}
            className={`h-9 shrink-0 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${
              sigo
                ? "border border-borda text-tinta hover:border-destaque hover:text-destaque"
                : "bg-tinta text-papel hover:bg-tinta/85"
            }`}
          >
            {sigo ? "Seguindo" : "Seguir"}
          </button>
        )}
      </div>
      {erro && <p className="mt-2 text-xs text-destaque">{erro}</p>}
    </div>
  );
}
