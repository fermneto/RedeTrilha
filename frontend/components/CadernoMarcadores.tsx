"use client";
// Client component: o estado de login vem do token no localStorage, que só
// existe no navegador.
//
// Os marcadores de página do caderno: tiras de papel que saem da borda de cima
// (Início, Explorar, Avisos, Mensagens) e da borda esquerda (Escrever e o
// Perfil, o que é meu). O marcador da seção atual fica puxado para fora, da cor
// da página, emendado nela; os outros ficam guardados atrás do caderno, num tom
// entre a mesa e a folha. No celular, todos saem da borda de cima, só com o
// ícone (o nome vai no aria-label).
//
// "Avisos" e "Mensagens" levam um contador cada (linhas de aviso não lidas;
// conversas não lidas e pedidos novos), atualizados pelo stream das mensagens
// (ouvirMensagens, em lib/api.ts), que também traz o evento "aviso", sem recarregar.
// A navegação é enxuta (decisão 17): o Acervo, as rengas e as antologias se
// descobrem nas abas do Explorar; os rascunhos e as antologias próprias ficam no
// perfil, e as Preferências e o "Sair", no menu do meu perfil (MenuDoPerfil).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { IconeAvisos } from "@/components/icones/IconeAvisos";
import { IconeEscrever } from "@/components/icones/IconeEscrever";
import { IconeExplorar } from "@/components/icones/IconeExplorar";
import { IconeInicio } from "@/components/icones/IconeInicio";
import { IconeMensagens } from "@/components/icones/IconeMensagens";
import { IconePerfil } from "@/components/icones/IconePerfil";
import type { PropsIcone } from "@/components/icones/Icone";
import {
  buscarEu,
  buscarResumoDeAvisos,
  buscarResumoDeMensagens,
  ouvirMensagens,
  temToken,
  type User,
} from "@/lib/api";

type Marcador = {
  href: string;
  rotulo: string;
  Icone: (props: PropsIcone) => React.ReactNode;
  atual: boolean;
  contador: number;
  borda: "topo" | "esquerda";
};

// O rótulo lido pelo leitor de tela: "Mensagens, 3 não lidas", "Avisos, 1 novo".
function rotuloComContador(rotulo: string, n: number): string {
  if (n === 0) return rotulo;
  if (rotulo === "Avisos") return `${rotulo}, ${n} ${n === 1 ? "novo" : "novos"}`;
  return `${rotulo}, ${n} ${n === 1 ? "não lida" : "não lidas"}`;
}

function useMarcadores(): Marcador[] {
  const caminho = usePathname();
  const [logado, setLogado] = useState(false);
  const [eu, setEu] = useState<User | null>(null);
  const [aLer, setALer] = useState(0);
  const [avisos, setAvisos] = useState(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esperaDosAvisos = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Relê o token a cada navegação: o login grava e depois redireciona.
  useEffect(() => {
    const comToken = temToken();
    setLogado(comToken);
    if (!comToken) {
      setEu(null);
      return;
    }
    buscarEu()
      .then(setEu)
      .catch(() => setEu(null));
  }, [caminho]);

  // Os contadores: buscam ao navegar e a cada evento do stream (vários eventos
  // juntos, como uma mensagem e a leitura dela, viram uma busca só). O evento
  // "aviso" muda só o de Avisos; reconectar (que pode ter perdido eventos) os dois.
  useEffect(() => {
    if (!logado) {
      setALer(0);
      setAvisos(0);
      return;
    }
    const atualizarMensagens = () =>
      buscarResumoDeMensagens()
        .then((r) => setALer(r.nao_lidas + r.pedidos))
        .catch(() => undefined);
    const atualizarAvisos = () =>
      buscarResumoDeAvisos()
        .then((r) => setAvisos(r.nao_lidos))
        .catch(() => undefined);
    const depois = (relogio: typeof espera, atualizar: () => void) => {
      if (relogio.current) clearTimeout(relogio.current);
      relogio.current = setTimeout(atualizar, 250);
    };
    atualizarMensagens();
    atualizarAvisos();
    const cancelar = ouvirMensagens((evento) => {
      if (evento.tipo !== "aviso") depois(espera, atualizarMensagens);
      if (evento.tipo === "aviso" || evento.tipo === "conectou") depois(esperaDosAvisos, atualizarAvisos);
    });
    return () => {
      cancelar();
      if (espera.current) clearTimeout(espera.current);
      if (esperaDosAvisos.current) clearTimeout(esperaDosAvisos.current);
    };
  }, [logado, caminho]);

  const ativo = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href));
  const noPerfil = ativo("/perfil") || (eu !== null && caminho.startsWith(`/u/${encodeURIComponent(eu.username)}`));

  const marcadores: Marcador[] = [
    { href: "/", rotulo: "Início", Icone: IconeInicio, atual: ativo("/"), contador: 0, borda: "topo" },
    { href: "/explorar", rotulo: "Explorar", Icone: IconeExplorar, atual: ativo("/explorar"), contador: 0, borda: "topo" },
  ];
  if (logado) {
    marcadores.push(
      { href: "/avisos", rotulo: "Avisos", Icone: IconeAvisos, atual: ativo("/avisos"), contador: avisos, borda: "topo" },
      { href: "/mensagens", rotulo: "Mensagens", Icone: IconeMensagens, atual: ativo("/mensagens"), contador: aLer, borda: "topo" },
    );
  }
  marcadores.push({
    href: "/escrever",
    rotulo: "Escrever",
    Icone: IconeEscrever,
    atual: ativo("/escrever"),
    contador: 0,
    borda: "esquerda",
  });
  marcadores.push(
    logado
      ? {
          href: eu ? `/u/${encodeURIComponent(eu.username)}` : "/perfil",
          rotulo: "Perfil",
          Icone: IconePerfil,
          atual: noPerfil,
          contador: 0,
          borda: "esquerda",
        }
      : { href: "/login", rotulo: "Entrar", Icone: IconePerfil, atual: false, contador: 0, borda: "esquerda" },
  );
  return marcadores;
}

// O número a ler, depois do nome do marcador. Acima de 99, "99+".
function Contador({ n, solto = false }: { n: number; solto?: boolean }) {
  if (n === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={`text-[0.6875rem] leading-none font-bold text-destaque tabular-nums ${
        solto ? "absolute top-1 right-1.5" : ""
      }`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

// O papel do marcador: guardado (atrás do caderno, curto) ou puxado (emendado na folha).
const GUARDADO = "z-0 border border-borda bg-marcador text-tinta-suave hover:text-tinta";
const PUXADO = "z-20 bg-papel font-semibold text-tinta";

// Desktop: os marcadores de cima e os da esquerda, presos à borda do caderno.
// Cada grupo fica 6 px por trás da folha: o guardado some nela, o puxado emenda.
export function MarcadoresDoCaderno() {
  const marcadores = useMarcadores();
  const topo = marcadores.filter((m) => m.borda === "topo");
  const esquerda = marcadores.filter((m) => m.borda === "esquerda");
  return (
    <nav aria-label="Principal" className="contents">
      <ul className="absolute bottom-[calc(100%-6px)] left-10 flex items-end gap-1">
        {topo.map((m) => (
          <li key={m.href} className={m.atual ? "relative z-20" : "relative z-0"}>
            <Link
              href={m.href}
              aria-current={m.atual ? "page" : undefined}
              aria-label={rotuloComContador(m.rotulo, m.contador)}
              className={`flex items-start gap-1.5 rounded-t-md px-4 pt-2 text-sm transition-[height,color] duration-200 ease-out ${
                m.atual ? `${PUXADO} h-12` : `${GUARDADO} h-10 hover:h-11`
              }`}
            >
              {m.rotulo}
              <Contador n={m.contador} />
            </Link>
          </li>
        ))}
      </ul>
      <ul className="absolute top-12 right-[calc(100%-6px)] flex flex-col items-end gap-1">
        {esquerda.map((m) => (
          <li key={m.href} className={m.atual ? "relative z-20" : "relative z-0"}>
            <Link
              href={m.href}
              aria-current={m.atual ? "page" : undefined}
              aria-label={m.rotulo}
              className={`flex justify-start rounded-l-md py-4 pl-2 text-sm transition-[width,color] duration-200 ease-out ${
                m.atual ? `${PUXADO} w-12` : `${GUARDADO} w-10 hover:w-11`
              }`}
            >
              <span className="rotate-180 [writing-mode:vertical-rl]">{m.rotulo}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Celular: uma fileira na borda de cima, só os ícones, na ordem de sempre
// (Início, Explorar, Escrever, Avisos, Mensagens, Perfil).
export function MarcadoresDoCelular() {
  const marcadores = useMarcadores();
  const ordem = ["/", "/explorar", "/escrever", "/avisos", "/mensagens"];
  const fileira = [
    ...ordem.map((href) => marcadores.find((m) => m.href === href)).filter((m): m is Marcador => Boolean(m)),
    ...marcadores.filter((m) => !ordem.includes(m.href)),
  ];
  return (
    <nav aria-label="Principal">
      <ul className="relative flex h-12 items-end gap-1 px-1">
        {fileira.map((m) => (
          <li key={m.href} className={`relative flex flex-1 justify-center ${m.atual ? "z-20" : "z-0"}`}>
            <Link
              href={m.href}
              aria-current={m.atual ? "page" : undefined}
              aria-label={rotuloComContador(m.rotulo, m.contador)}
              className={`relative flex w-full max-w-16 items-start justify-center rounded-t-md pt-2.5 transition-[height] duration-200 ease-out ${
                m.atual ? `${PUXADO} h-[3.25rem]` : `${GUARDADO} h-11`
              }`}
            >
              <m.Icone className={`h-[22px] w-[22px] ${m.atual ? "[stroke-width:2]" : ""}`} />
              <Contador n={m.contador} solto />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
