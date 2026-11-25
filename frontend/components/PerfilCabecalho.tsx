"use client";
// Cabeçalho do perfil: avatar, nome, selo de consagrado, bio, contadores e a ação
// (Seguir/Deixar de seguir para os outros, Editar perfil para o próprio). Para
// quem não é consagrado (que não tem login), também "Mensagem", que abre a conversa.

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { IconeMensagens } from "@/components/icones/IconeMensagens";
import { SeloConsagrado } from "@/components/SeloConsagrado";
import { abrirConversa, anosDeVida, mensagemDeFalha, seguir, type Perfil } from "@/lib/api";

type Props = {
  perfil: Perfil;
  proprio: boolean;
  aoMudar: (perfil: Perfil) => void;
  aoEditar: () => void;
};

export function PerfilCabecalho({ perfil, proprio, aoMudar, aoEditar }: Props) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const vida = anosDeVida(perfil);

  async function abrirMensagem() {
    setErro(null);
    try {
      const conversa = await abrirConversa(perfil.username);
      router.push(`/mensagens/${conversa.id}`);
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para abrir a conversa"));
    }
  }

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
      setErro(mensagemDeFalha(e, "não deu para seguir"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <header className="space-y-4">
      <div className="flex items-start gap-4">
        <Avatar usuario={perfil} tamanho="g" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl break-words">
            {perfil.name} <SeloConsagrado usuario={perfil} className="h-[0.8em] w-[0.8em]" />
          </h1>
          <p className="text-sm text-tinta-suave">@{perfil.username}</p>
          {perfil.consagrado && (
            <p className="mt-1 text-sm text-tinta-suave tabular-nums">
              {["Poeta consagrado", vida, "obra em domínio público"].filter(Boolean).join(" · ")}
            </p>
          )}
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
          <div className="flex shrink-0 items-center gap-2">
            {!perfil.consagrado && (
              <button
                type="button"
                onClick={abrirMensagem}
                aria-label={`Mensagem para @${perfil.username}`}
                title="Mensagem"
                className="realce flex h-[2.375rem] w-[2.375rem] cursor-pointer items-center justify-center rounded border border-borda"
              >
                <IconeMensagens className="h-5 w-5" />
              </button>
            )}
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
          </div>
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

function Contador({ n, singular, plural }: { n: number; singular: string; plural: string }) {
  return (
    <li>
      <span className="font-medium text-tinta tabular-nums">{n}</span> {n === 1 ? singular : plural}
    </li>
  );
}
