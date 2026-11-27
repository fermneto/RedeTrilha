"use client";
// Cabeçalho do perfil: avatar, nome, selo de consagrado, bio, contadores, os gostos
// (PerfilGostos) e a ação
// (Seguir/Deixar de seguir para os outros; Editar perfil e os ajustes da conta,
// com Preferências e Sair, para o próprio). Para
// quem não é consagrado (que não tem login), também "Mensagem", que abre a conversa,
// e "Bloquear" (ou "Desbloquear"), que vale para a rede inteira, como no X.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { ConfirmacaoInline } from "@/components/ConfirmacaoInline";
import { IconeMensagens } from "@/components/icones/IconeMensagens";
import { MenuDoPerfil } from "@/components/MenuDoPerfil";
import { PerfilGostos } from "@/components/PerfilGostos";
import { SeloConsagrado } from "@/components/SeloConsagrado";
import {
  abrirConversa,
  anosDeVida,
  bloquear,
  buscarBloqueio,
  mensagemDeFalha,
  seguir,
  type Perfil,
} from "@/lib/api";
import { noPlural } from "@/lib/numeros";

type Props = {
  perfil: Perfil;
  proprio: boolean;
  aoMudar: (perfil: Perfil) => void;
  aoEditar: () => void;
  // Avisa a página se eu bloqueei a pessoa: aí ela esconde as abas do perfil.
  aoMudarBloqueio?: (bloqueei: boolean) => void;
};

export function PerfilCabecalho({ perfil, proprio, aoMudar, aoEditar, aoMudarBloqueio }: Props) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const vida = anosDeVida(perfil);
  const podeBloquear = !proprio && !perfil.consagrado;
  const [bloqueei, setBloqueioLocal] = useState(false);
  function setBloqueei(valor: boolean) {
    setBloqueioLocal(valor);
    aoMudarBloqueio?.(valor);
  }

  useEffect(() => {
    if (!podeBloquear) return;
    buscarBloqueio(perfil.username)
      .then((r) => setBloqueei(r.bloqueei))
      .catch(() => undefined);
  }, [podeBloquear, perfil.username]);

  // Bloquear desfaz os follows nos dois sentidos (o contador acompanha).
  async function alternarBloqueio(novo: boolean) {
    setErro(null);
    try {
      await bloquear(perfil.username, novo);
      setBloqueei(novo);
      if (novo && perfil.sigo) aoMudar({ ...perfil, sigo: false, seguidores: perfil.seguidores - 1 });
    } catch (e) {
      setErro(mensagemDeFalha(e, novo ? "não deu para bloquear" : "não deu para desbloquear"));
    }
  }

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
      {/* No celular, como no X: o avatar e os botões numa linha e o nome embaixo,
          na largura toda, para não ficar espremido entre eles e partir a palavra
          ("Albuqu/erque"). Do sm em diante, os três numa linha. */}
      <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-3 sm:grid-cols-[auto_1fr_auto]">
        <Avatar usuario={perfil} tamanho="g" />
        <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          {/* Quebra só entre palavras (break-word só parte uma palavra maior que a
              linha inteira); o nome longo encolhe no celular. */}
          <h1 className={`break-words text-balance sm:text-3xl ${perfil.name.length > 20 ? "text-2xl" : "text-3xl"}`}>
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
          <div className="col-start-2 row-start-1 flex items-center justify-self-end gap-2 sm:col-start-3">
            <button
              type="button"
              onClick={aoEditar}
              className="shrink-0 cursor-pointer rounded border border-borda px-4 py-2 text-sm"
            >
              Editar perfil
            </button>
            <MenuDoPerfil username={perfil.username} />
          </div>
        ) : (
          <div className="col-start-2 row-start-1 flex items-center justify-self-end gap-2 sm:col-start-3">
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
            {!bloqueei && (
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
        )}
      </div>

      {perfil.bio && <p className="whitespace-pre-wrap break-words">{perfil.bio}</p>}

      <ul className="flex flex-wrap gap-x-5 text-sm text-tinta-suave">
        <Contador n={perfil.poemas} singular="poema" plural="poemas" />
        <Contador n={perfil.seguidores} singular="seguidor" plural="seguidores" />
        <Contador n={perfil.seguindo} singular="seguindo" plural="seguindo" />
      </ul>

      {/* Consagrado não tem preferências (não tem login); quem eu bloqueei, também não. */}
      {!perfil.consagrado && !bloqueei && <PerfilGostos username={perfil.username} proprio={proprio} />}

      {podeBloquear &&
        (bloqueei ? (
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-tinta-suave">
            Você bloqueou @{perfil.username}: vocês não se veem nos feeds e não interagem.
            <button
              type="button"
              onClick={() => alternarBloqueio(false)}
              className="min-h-11 cursor-pointer font-semibold text-destaque hover:underline"
            >
              Desbloquear
            </button>
          </p>
        ) : (
          <ConfirmacaoInline
            pergunta={`Bloquear @${perfil.username}? Vocês deixam de se seguir e de se ver nos feeds.`}
            rotulo={`Bloquear @${perfil.username}`}
            classeDoBotao="min-h-11 cursor-pointer text-sm text-tinta-suave hover:text-destaque hover:underline"
            aoConfirmar={() => alternarBloqueio(true)}
          />
        ))}

      {erro && <p className="text-sm text-destaque">{erro}</p>}
    </header>
  );
}

function Contador({ n, singular, plural }: { n: number; singular: string; plural: string }) {
  return (
    <li>
      <span className="font-medium text-tinta tabular-nums">{n}</span> {noPlural(n, singular, plural)}
    </li>
  );
}
