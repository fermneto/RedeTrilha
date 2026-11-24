"use client";
// Cabeçalho do perfil: avatar, nome, selo de consagrado, bio, contadores e a ação
// (Seguir/Deixar de seguir para os outros, Editar perfil para o próprio).

import { useState } from "react";

import { anosDeVida, seguir, type Perfil } from "@/lib/api";

type Props = {
  perfil: Perfil;
  proprio: boolean;
  aoMudar: (perfil: Perfil) => void;
  aoEditar: () => void;
};

export function PerfilCabecalho({ perfil, proprio, aoMudar, aoEditar }: Props) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const vida = anosDeVida(perfil);

  // Otimista: muda o botão e o contador antes da resposta e volta atrás se falhar.
  async function alternarSeguir() {
    const novo = !perfil.sigo;
    const antes = perfil;
    aoMudar({ ...perfil, sigo: novo, seguidores: perfil.seguidores + (novo ? 1 : -1) });
    setErro(null);
    setEnviando(true);
    try {
      await seguir(perfil.username, novo);
    } catch (e) {
      aoMudar(antes);
      setErro(e instanceof Error ? e.message : "não deu para seguir");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <header className="space-y-4">
      <div className="flex items-start gap-4">
        <Avatar perfil={perfil} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl break-words">{perfil.name}</h1>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <span className="text-tinta-suave">@{perfil.username}</span>
            {perfil.consagrado && (
              <span className="rounded-full border border-destaque px-2 text-xs text-destaque">
                Consagrado
              </span>
            )}
            {vida && <span className="text-xs text-tinta-suave">({vida})</span>}
          </div>
        </div>
        {proprio ? (
          <button
            type="button"
            onClick={aoEditar}
            className="shrink-0 cursor-pointer rounded border border-borda px-4 py-2 text-sm"
          >
            Editar perfil
          </button>
        ) : (
          <button
            type="button"
            onClick={alternarSeguir}
            disabled={enviando}
            aria-pressed={perfil.sigo}
            className={
              perfil.sigo
                ? "shrink-0 cursor-pointer rounded border border-borda px-4 py-2 text-sm"
                : "shrink-0 cursor-pointer rounded bg-tinta px-4 py-2 text-sm text-papel"
            }
          >
            {perfil.sigo ? "Deixar de seguir" : "Seguir"}
          </button>
        )}
      </div>

      {perfil.bio && <p className="whitespace-pre-wrap break-words">{perfil.bio}</p>}

      <ul className="flex flex-wrap gap-x-5 text-sm text-tinta-suave">
        <Contador n={perfil.poemas} singular="poema" plural="poemas" />
        <Contador n={perfil.seguidores} singular="seguidor" plural="seguidores" />
        <Contador n={perfil.seguindo} singular="seguindo" plural="seguindo" />
      </ul>

      {erro && <p className="text-sm text-destaque">{erro}</p>}
    </header>
  );
}

function Avatar({ perfil }: { perfil: Perfil }) {
  if (perfil.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={perfil.avatar_url} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div
      aria-hidden
      className="font-serifada flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-borda text-2xl text-tinta"
    >
      {iniciais(perfil.name)}
    </div>
  );
}

// "Cruz e Sousa" → "CS": a primeira letra do primeiro e do último nome.
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

function Contador({ n, singular, plural }: { n: number; singular: string; plural: string }) {
  return (
    <li>
      <span className="font-medium text-tinta tabular-nums">{n}</span> {n === 1 ? singular : plural}
    </li>
  );
}
