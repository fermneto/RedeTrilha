"use client";
// Client component: o estado de login vem do token no localStorage, que só
// existe no navegador.
//
// A lombada do livro: a navegação gravada no pano da capa. No desktop (de
// 1024 px), uma faixa estreita à esquerda do miolo, com o nome do Verso no alto,
// os ícones grandes, sem texto (Início, Explorar, Avisos, Mensagens e o meu
// perfil, com o meu avatar) e, no pé, "Escrever" em destaque, um botão cor da
// gravura sobre o pano. No celular, a mesma faixa vira a borda de baixo da capa.
// Nos dois, o nome de cada item vai no aria-label e, no desktop, também no title. O item da seção atual fica rebaixado
// no pano (.gravado, em globals.css).
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

import { Avatar } from "@/components/Avatar";
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
  // O meu perfil mostra o meu avatar no lugar do ícone.
  eu?: User | null;
};

// O rótulo lido pelo leitor de tela: "Mensagens, 3 não lidas", "Avisos, 1 novo".
function rotuloComContador(rotulo: string, n: number): string {
  if (n === 0) return rotulo;
  if (rotulo === "Avisos") return `${rotulo}, ${n} ${n === 1 ? "novo" : "novos"}`;
  return `${rotulo}, ${n} ${n === 1 ? "não lida" : "não lidas"}`;
}

function useLombada(): { marcadores: Marcador[]; escrevendo: boolean } {
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
    { href: "/", rotulo: "Início", Icone: IconeInicio, atual: ativo("/"), contador: 0 },
    { href: "/explorar", rotulo: "Explorar", Icone: IconeExplorar, atual: ativo("/explorar"), contador: 0 },
  ];
  if (logado) {
    marcadores.push(
      { href: "/avisos", rotulo: "Avisos", Icone: IconeAvisos, atual: ativo("/avisos"), contador: avisos },
      { href: "/mensagens", rotulo: "Mensagens", Icone: IconeMensagens, atual: ativo("/mensagens"), contador: aLer },
    );
  }
  marcadores.push(
    logado
      ? {
          href: eu ? `/u/${encodeURIComponent(eu.username)}` : "/perfil",
          rotulo: "Perfil",
          Icone: IconePerfil,
          atual: noPerfil,
          contador: 0,
          eu,
        }
      : { href: "/login", rotulo: "Entrar", Icone: IconePerfil, atual: false, contador: 0 },
  );
  return { marcadores, escrevendo: ativo("/escrever") };
}

// O número a ler, sobre o ícone. Acima de 99, "99+". Um selo de papel em
// destaque: na capa, a única cor além da gravura.
function Contador({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute top-1 left-[calc(50%+0.5rem)] min-w-[1.125rem] rounded-full bg-destaque px-1 py-0.5 text-center text-[0.625rem] leading-none font-bold text-papel tabular-nums"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

function Simbolo({ m, classe, avatar = "p" }: { m: Marcador; classe: string; avatar?: "p" | "m" }) {
  if (m.eu)
    return (
      <span className={`flex items-center justify-center ${classe}`}>
        <span className={`rounded-full ring-1 ${m.atual ? "ring-gravura" : "ring-gravura/30"}`}>
          <Avatar usuario={m.eu} tamanho={avatar} />
        </span>
      </span>
    );
  return <m.Icone className={`${classe} ${m.atual ? "[stroke-width:1.9]" : ""}`} />;
}

// Desktop: a faixa da lombada, à esquerda do miolo.
export function Lombada() {
  const { marcadores, escrevendo } = useLombada();
  return (
    <nav aria-label="Principal" className="flex w-[5.25rem] shrink-0 flex-col items-center pt-5 pb-5">
      <Link
        href="/"
        aria-label="Verso, início"
        className="rounded font-serifada text-[1.375rem] leading-none font-semibold italic tracking-tight text-gravura"
      >
        <span aria-hidden="true">Verso</span>
      </Link>
      <span aria-hidden="true" className="mt-4 h-px w-8 bg-gravura/20" />
      <ul className="mt-5 flex flex-col items-center gap-2">
        {marcadores.map((m) => (
          <li key={m.href}>
            <Link
              href={m.href}
              aria-current={m.atual ? "page" : undefined}
              aria-label={rotuloComContador(m.rotulo, m.contador)}
              title={m.rotulo}
              className="gravado relative flex h-14 w-14 items-center justify-center rounded-xl"
            >
              <Simbolo m={m} classe="h-7 w-7" avatar="m" />
              <Contador n={m.contador} />
            </Link>
          </li>
        ))}
      </ul>
      <Escrever atual={escrevendo} />
    </nav>
  );
}

// Escrever: um botão cor da gravura sobre o pano, no pé da lombada.
function Escrever({ atual }: { atual: boolean }) {
  return (
    <Link
      href="/escrever"
      aria-current={atual ? "page" : undefined}
      aria-label="Escrever"
      title="Escrever"
      className="group mt-auto flex items-center justify-center rounded-full p-1"
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-gravura text-capa shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_2px_6px_rgb(0_0_0/0.35)] transition-transform duration-200 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none ${
          atual ? "ring-2 ring-gravura/60 ring-offset-2 ring-offset-capa" : ""
        }`}
      >
        <IconeEscrever className="h-7 w-7 [stroke-width:1.8]" />
      </span>
    </Link>
  );
}

// Celular: a borda de baixo da capa, os ícones numa fileira e o Escrever no fim.
export function LombadaDoCelular() {
  const { marcadores, escrevendo } = useLombada();
  return (
    <nav aria-label="Principal" className="pb-[env(safe-area-inset-bottom)]">
      <ul className="flex h-14 items-center gap-0.5 px-1">
        {marcadores.map((m) => (
          <li key={m.href} className="flex flex-1 justify-center">
            <Link
              href={m.href}
              aria-current={m.atual ? "page" : undefined}
              aria-label={rotuloComContador(m.rotulo, m.contador)}
              className="gravado relative flex h-11 w-full max-w-14 items-center justify-center rounded-lg"
            >
              <Simbolo m={m} classe="h-[1.375rem] w-[1.375rem]" />
              <Contador n={m.contador} />
            </Link>
          </li>
        ))}
        <li className="flex flex-1 justify-center">
          <Link
            href="/escrever"
            aria-current={escrevendo ? "page" : undefined}
            aria-label="Escrever"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gravura text-capa shadow-[0_2px_6px_rgb(0_0_0/0.35)]"
          >
            <IconeEscrever className="h-[1.375rem] w-[1.375rem] [stroke-width:1.8]" />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
