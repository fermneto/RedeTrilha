"use client";
// "Avisos" (DECISIONS.md, decisão 16): quem curtiu, seguiu, repostou, citou,
// comentou, criticou um verso, respondeu, escreveu uma estrofe ou convidou para
// uma renga, o mais recente primeiro. As curtidas e os reposts de um mesmo poema
// vêm numa linha só ("Ana e mais 3 curtiram seu poema").
//
// Abrir a página marca como lido o que ela mostrou (o contador do menu zera); os
// que chegaram sem ter sido vistos ficam com o fundo do painel nesta visita. Com
// a página aberta, um aviso novo chega pelo stream e entra no topo.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EsqueletoDeAvisos } from "@/components/Esqueleto";
import { IconeAvisos } from "@/components/icones/IconeAvisos";
import { IconeCitar } from "@/components/icones/IconeCitar";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { IconeCurtir } from "@/components/icones/IconeCurtir";
import { IconePerfil } from "@/components/icones/IconePerfil";
import { IconeRenga } from "@/components/icones/IconeRenga";
import { IconeRepostar } from "@/components/icones/IconeRepostar";
import {
  acaoDoAviso,
  caminhoDoLogin,
  linkDoAviso,
  listarAvisos,
  marcarAvisosLidos,
  mensagemDeFalha,
  ouvirMensagens,
  quemNoAviso,
  temToken,
  tempoRelativo,
  type Aviso,
  type TipoDeAviso,
} from "@/lib/api";

type Lista = { itens: Aviso[]; cursor: string | null };

const ICONES: Record<TipoDeAviso, (props: { className?: string }) => React.ReactNode> = {
  curtida: (props) => <IconeCurtir cheio {...props} />,
  seguidor: IconePerfil,
  repost: IconeRepostar,
  citacao: IconeCitar,
  comentario: IconeComentar,
  critica: IconeComentar,
  resposta: IconeComentar,
  estrofe: IconeRenga,
  convite: IconeRenga,
};

export default function AvisosPage() {
  const router = useRouter();
  const [lista, setLista] = useState<Lista | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Os que chegaram não lidos nesta visita: continuam destacados depois de marcados.
  const [novos, setNovos] = useState<ReadonlySet<string>>(new Set());
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A primeira página, marcando como lido até o aviso mais recente dela.
  const recarregar = useCallback(() => {
    listarAvisos(null)
      .then((p) => {
        setLista({ itens: p.items, cursor: p.proximo_cursor });
        const chegaram = p.items.filter((a) => !a.lido).map(chaveDoAviso);
        if (chegaram.length > 0) setNovos((atuais) => new Set([...atuais, ...chegaram]));
        const maisRecente = Math.max(0, ...p.items.map((a) => a.id));
        if (p.items.some((a) => !a.lido) && document.visibilityState === "visible") {
          marcarAvisosLidos(maisRecente).catch(() => undefined);
        }
      })
      .catch((e) => setErro(mensagemDeFalha(e, "não deu para carregar os avisos")));
  }, []);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    recarregar();
    const cancelar = ouvirMensagens((evento) => {
      if (evento.tipo !== "aviso" && evento.tipo !== "conectou") return;
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(recarregar, 250);
    });
    return () => {
      cancelar();
      if (espera.current) clearTimeout(espera.current);
    };
  }, [router, recarregar]);

  async function carregarMais() {
    if (!lista?.cursor) return;
    try {
      const p = await listarAvisos(lista.cursor);
      setLista({ itens: [...lista.itens, ...p.items], cursor: p.proximo_cursor });
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para carregar mais avisos"));
    }
  }

  return (
    <div>
      <CabecalhoPagina titulo="Avisos" />
      {erro && <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>}
      {!lista ? (
        !erro && <EsqueletoDeAvisos quantos={6} />
      ) : lista.itens.length === 0 ? (
        <Vazio />
      ) : (
        <ul aria-label="Avisos, o mais recente primeiro">
          {lista.itens.map((aviso) => (
            <li key={chaveDoAviso(aviso)}>
              <LinhaDoAviso aviso={aviso} novo={!aviso.lido || novos.has(chaveDoAviso(aviso))} />
            </li>
          ))}
        </ul>
      )}
      {lista?.cursor && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={carregarMais}
            className="realce min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold text-destaque"
          >
            carregar mais avisos
          </button>
        </div>
      )}
    </div>
  );
}

// A linha agrupada muda de id quando chega uma curtida nova; a chave junta o id.
function chaveDoAviso(aviso: Aviso): string {
  return `${aviso.tipo}-${aviso.id}`;
}

function LinhaDoAviso({ aviso, novo }: { aviso: Aviso; novo: boolean }) {
  const Icone = ICONES[aviso.tipo];
  const ehComentario = aviso.comentario_id !== null;
  return (
    <Link
      href={linkDoAviso(aviso)}
      className={`realce flex gap-3 border-b border-borda px-4 py-3 focus-visible:outline-offset-[-2px] ${
        novo ? "bg-painel" : ""
      }`}
    >
      <span className="flex w-8 shrink-0 justify-end pt-1 text-tinta-suave">
        <Icone className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex gap-1">
          {aviso.atores.map((u) => (
            <Avatar key={u.id} usuario={u} tamanho="p" />
          ))}
        </span>
        <span className="mt-1.5 block text-[0.9375rem] leading-5">
          {novo && <span className="sr-only">Novo: </span>}
          <span className="font-bold">{quemNoAviso(aviso)}</span> {acaoDoAviso(aviso)}
          <span aria-hidden="true" className="text-tinta-suave">
            {" "}
            ·{" "}
          </span>
          <time dateTime={aviso.created_at} className="text-tinta-suave tabular-nums">
            {tempoRelativo(aviso.created_at)}
          </time>
        </span>
        {(aviso.titulo || aviso.trecho) && (
          <span className="mt-1 block truncate font-serifada text-[0.9375rem] text-tinta-suave">
            {aviso.titulo && <span className="italic">{aviso.titulo}</span>}
            {aviso.titulo && aviso.trecho && <span aria-hidden="true"> — </span>}
            {aviso.trecho && (ehComentario ? `“${aviso.trecho}”` : aviso.trecho)}
          </span>
        )}
      </span>
    </Link>
  );
}

function Vazio() {
  return (
    <div className="px-6 py-14 text-center">
      <IconeAvisos className="mx-auto h-10 w-10 text-tinta-suave" />
      <p className="mt-4 font-serifada text-xl">Nenhum aviso por enquanto.</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-tinta-suave">
        Quando alguém curtir ou citar um poema seu, criticar um verso, responder ao seu comentário, seguir você ou
        escrever uma estrofe na sua renga, aparece aqui.
      </p>
      <Link
        href="/escrever"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-destaque px-5 text-sm font-semibold text-papel transition-[filter] duration-150 hover:brightness-110"
      >
        Escrever um poema
      </Link>
    </div>
  );
}
