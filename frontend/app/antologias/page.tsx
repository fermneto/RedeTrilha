"use client";
// "Minhas antologias": as coleções do usuário, privadas inclusive, e o
// formulário inline de "Nova antologia", que leva à antologia recém-criada.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AntologiaFormulario } from "@/components/AntologiaFormulario";
import { AntologiaLista } from "@/components/AntologiaLista";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { caminhoDoLogin, criarAntologia, listarMinhasAntologias, temToken } from "@/lib/api";

export default function MinhasAntologiasPage() {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [criando, setCriando] = useState(false);
  const botaoNova = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    setPronto(true);
  }, [router]);

  // Ao fechar o formulário, o foco volta para o botão que o abriu.
  function fecharFormulario() {
    setCriando(false);
    requestAnimationFrame(() => botaoNova.current?.focus());
  }

  return (
    <div>
      <CabecalhoPagina titulo="Minhas antologias" />
      <div className="border-b border-borda px-4 py-4">
        {criando ? (
          <AntologiaFormulario
            textoDoBotao="Criar antologia"
            aoEnviar={async (dados) => {
              const nova = await criarAntologia(dados);
              router.push(`/antologias/${nova.id}`);
            }}
            aoCancelar={fecharFormulario}
          />
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-tinta-suave">Coleções de poemas que você reúne.</p>
            <button
              ref={botaoNova}
              type="button"
              onClick={() => setCriando(true)}
              className="min-h-11 shrink-0 cursor-pointer rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110"
            >
              Nova antologia
            </button>
          </div>
        )}
      </div>

      {pronto && (
        <AntologiaLista
          buscar={listarMinhasAntologias}
          vazio={
            !criando && (
              <div className="px-4 py-10 text-center">
                <p className="font-serifada text-lg">Nenhuma antologia ainda.</p>
                <p className="mt-1 text-sm text-tinta-suave">
                  Reúna os poemas que você ama, como “Poemas de chuva” ou “Para ler no ônibus”.
                </p>
                <button
                  type="button"
                  onClick={() => setCriando(true)}
                  className="mt-4 min-h-11 cursor-pointer rounded-full border border-borda px-5 text-sm font-semibold realce"
                >
                  Criar a primeira antologia
                </button>
              </div>
            )
          }
        />
      )}
    </div>
  );
}
