"use client";
// A vitrine da landing: o Verso mostrado por ele mesmo, como na entrada do
// Instagram, com o foco nos poemas e nas rengas. Na frente, um cartão no estilo do
// PoemaCard do feed (foto com anel, selo de consagrado, o poema e as ações com os
// contadores), com um verso grifado, a marca de críticas daquele verso e a barra
// "comentar estes versos", o diferencial da rede; a curtida fica presa ao canto
// dele. Ao lado, uma renga fechada no visual do RengaCard, e atrás do poema um
// cartão recolhido, só de profundidade. Só textos de domínio público de
// backend/data/consagrados/; os números são de exemplo.
//
// As peças abrem em leque na entrada (globals.css, .vitrine-*), a partir da
// posição final já visível; com prefers-reduced-motion, ficam paradas.

import { Fragment, useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { IconeCitar } from "@/components/icones/IconeCitar";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { IconeCurtir } from "@/components/icones/IconeCurtir";
import { IconeRenga } from "@/components/icones/IconeRenga";
import { IconeRepostar } from "@/components/icones/IconeRepostar";
import { SeloConsagrado } from "@/components/SeloConsagrado";
import { SeloDaRenga } from "@/components/SeloDaRenga";
import type { User } from "@/lib/api";

// A conta consagrada como no seed (fernando_pessoa.json).
const PESSOA: User = {
  id: 0,
  username: "fernando_pessoa",
  name: "Fernando Pessoa",
  bio: "",
  avatar_url:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/216_2310-Fernando-Pessoa.jpg/250px-216_2310-Fernando-Pessoa.jpg",
  consagrado: true,
  nascimento: 1888,
  morte: 1935,
  created_at: "",
};

// Primeira estrofe de "Autopsicografia" (1932), verso a verso; o 3 vai grifado.
// Os números são de exemplo, modestos, como os do cartão do feed.
const AUTOPSICOGRAFIA = {
  titulo: "Autopsicografia",
  versos: ["O poeta é um fingidor.", "Finge tão completamente", "Que chega a fingir que é dor", "A dor que deveras sente."],
  grifado: 3,
  criticasNoGrifado: 3,
  fonte: "https://pt.wikisource.org/wiki/Autopsicografia",
};

const ACOES = [
  { nome: "curtir", Icone: IconeCurtir, n: 86, ativa: true },
  { nome: "repostar", Icone: IconeRepostar, n: 9, ativa: false },
  { nome: "citar", Icone: IconeCitar, n: 0, ativa: false },
  { nome: "comentar", Icone: IconeComentar, n: 14, ativa: false },
];

// O cartão de trás, recolhido atrás do poema: só dá profundidade.
const DE_TRAS = {
  autor: "Emily Dickinson",
  titulo: "Hope is the thing with feathers",
  texto: "HOPE is the thing with feathers\nThat perches in the soul,",
};

// Uma renga fechada de consagrados: cada estrofe é o começo de um poema do seed,
// sem mudar uma letra (o Camões vem na grafia da fonte).
const consagrado = (username: string, name: string, nascimento: number, morte: number): User => ({
  id: 0,
  username,
  name,
  bio: "",
  avatar_url: "",
  consagrado: true,
  nascimento,
  morte,
  created_at: "",
});

const RENGA = {
  titulo: "Cheguei. Chegaste.",
  estrofes: [
    {
      autor: consagrado("olavo_bilac", "Olavo Bilac", 1865, 1918),
      texto: "Cheguei. Chegaste. Vinhas fatigada\nE triste, e triste e fatigado eu vinha,",
    },
    {
      autor: consagrado("florbela_espanca", "Florbela Espanca", 1894, 1930),
      texto: "Eu quero amar, amar perdidamente!\nAmar só por amar: Aqui... além...",
    },
    {
      autor: consagrado("camoes", "Luís de Camões", 1524, 1580),
      texto: "Amor he hum fogo que arde sem se ver;\nHe ferida que doe e não se sente;",
    },
  ],
  limite: 3,
  comentarios: 5,
};

const CARTAO = "rounded-2xl border border-borda bg-papel-alto sombra-de-papel";

// Do tablet em diante, um palco: o poema à esquerda, na frente, com o cartão de
// trás espiando por cima; a renga à direita, um pouco abaixo e inclinada. No
// celular, os dois empilhados.
export function Vitrine() {
  return (
    <div className="relative mx-auto grid w-full max-w-[26rem] gap-8 md:mx-0 md:block xl:mx-auto md:h-[29rem] md:max-w-[42rem] 2xl:h-[31rem] 2xl:max-w-[44rem]">
      <div
        aria-hidden="true"
        className={`vitrine-leque absolute top-0 left-4 hidden w-[16rem] px-5 py-4 md:block [--giro:-4deg] [--de:2rem] ${CARTAO}`}
      >
        <p className="text-[0.8125rem] font-semibold text-tinta-suave">{DE_TRAS.autor}</p>
        <p lang="en" className="poema-titulo mt-1 text-base">
          {DE_TRAS.titulo}
        </p>
        <p lang="en" className="poema-corpo mt-1 text-[0.9375rem] leading-relaxed">
          {DE_TRAS.texto}
        </p>
      </div>

      <div className="relative z-20 md:absolute md:top-5 md:left-0 md:w-[21.5rem] 2xl:w-[22.5rem]">
        <CartaoDaFrente />
        <span
          aria-hidden="true"
          className="vitrine-flutua absolute -top-5 -right-1 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-destaque text-papel sombra-de-papel [--giro:12deg] [--atraso:380ms] sm:-right-5"
        >
          <IconeCurtir cheio className="h-7 w-7" />
        </span>
      </div>

      <CartaoDaRenga />
    </div>
  );
}

// No visual do RengaCard do feed: rótulo, título com o selo "fechada", os autores,
// as estrofes com o autor embaixo e o rodapé com as estrofes e os comentários.
function CartaoDaRenga() {
  return (
    <figure
      className={`vitrine-leque relative z-10 px-5 pt-3 pb-1 [--giro:3deg] [--de:-3rem] md:absolute md:top-14 md:right-0 md:w-[20rem] 2xl:w-[21rem] ${CARTAO}`}
    >
      <p className="mb-1 flex items-center gap-2 text-[0.8125rem] font-semibold text-tinta-suave">
        <IconeRenga className="h-4 w-4 shrink-0" />
        renga
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="poema-titulo">{RENGA.titulo}</h2>
        <SeloDaRenga fechada />
      </div>
      <figcaption className="mt-1 text-sm leading-snug text-tinta-suave">
        um poema de{" "}
        {RENGA.estrofes.map(({ autor }, i) => (
          <Fragment key={autor.username}>
            <span className="whitespace-nowrap">
              <span className="font-semibold text-tinta">{autor.name}</span> <SeloConsagrado usuario={autor} />
              {i < RENGA.estrofes.length - 1 && ","}
            </span>{" "}
          </Fragment>
        ))}
      </figcaption>

      <ol aria-label="estrofes" className="mt-3 space-y-3">
        {RENGA.estrofes.map(({ autor, texto }) => (
          <li key={autor.username}>
            <p className="poema-corpo text-[0.9375rem] leading-relaxed">{texto}</p>
            <p className="mt-0.5 text-[0.8125rem] text-tinta-suave">
              <span aria-hidden="true">— </span>
              <span className="sr-only">estrofe de </span>
              <span className="font-semibold">{autor.name}</span>
            </p>
          </li>
        ))}
      </ol>

      <p aria-hidden="true" className="mt-1 flex items-center gap-x-3 text-sm">
        <span className="text-xs text-tinta-suave tabular-nums">
          {RENGA.estrofes.length} de {RENGA.limite} estrofes
        </span>
        <span className="inline-flex min-h-11 items-center gap-1 text-[0.8125rem] text-tinta-suave tabular-nums">
          <IconeComentar className="h-5 w-5" />
          {RENGA.comentarios}
        </span>
      </p>
    </figure>
  );
}

// A foto do seed com o anel; se ela não carregar (sem rede, link quebrado), as
// iniciais do Avatar. O erro pode chegar antes da hidratação, por isso a
// conferência do `complete` ao montar.
function FotoComAnel() {
  const foto = useRef<HTMLImageElement>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const img = foto.current;
    if (img && img.complete && img.naturalWidth === 0) setFalhou(true);
  }, []);

  return (
    <span className="shrink-0 rounded-full p-[2px] ring-2 ring-destaque ring-offset-2 ring-offset-papel-alto">
      {falhou ? (
        <Avatar usuario={{ ...PESSOA, avatar_url: "" }} tamanho="m" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={foto}
          src={PESSOA.avatar_url}
          alt=""
          onError={() => setFalhou(true)}
          className="h-10 w-10 rounded-full bg-borda object-cover"
        />
      )}
    </span>
  );
}

function CartaoDaFrente() {
  return (
    <figure className={`vitrine-frente px-5 pt-4 pb-2 sm:px-6 ${CARTAO}`}>
      <div className="flex items-center gap-3">
        <FotoComAnel />
        <div className="min-w-0 text-[0.9375rem] leading-5">
          <p className="flex items-center gap-1 font-bold">
            {PESSOA.name}
            <SeloConsagrado usuario={PESSOA} />
          </p>
          <p className="truncate text-tinta-suave">@{PESSOA.username}</p>
        </div>
      </div>

      <h2 className="poema-titulo mt-3">{AUTOPSICOGRAFIA.titulo}</h2>
      <blockquote cite={AUTOPSICOGRAFIA.fonte} className="poema-corpo mt-1">
        {AUTOPSICOGRAFIA.versos.map((verso, i) =>
          i + 1 === AUTOPSICOGRAFIA.grifado ? (
            <span key={verso} className="-mx-1.5 flex items-baseline gap-2 rounded bg-destaque/12 px-1.5">
              <span className="min-w-0 flex-1">{verso}</span>
              <span
                aria-hidden="true"
                className="inline-flex shrink-0 items-center gap-0.5 font-sans text-xs text-tinta-suave tabular-nums"
              >
                <IconeComentar className="h-3.5 w-3.5" />
                {AUTOPSICOGRAFIA.criticasNoGrifado}
              </span>
            </span>
          ) : (
            <span key={verso} className="block">
              {verso}
            </span>
          ),
        )}
      </blockquote>
      <figcaption className="sr-only">{PESSOA.name}</figcaption>

      <div
        aria-hidden="true"
        className="vitrine-flutua mt-2 inline-flex w-max max-w-full items-center gap-1.5 rounded-full border border-borda bg-papel-alto px-3 py-1.5 text-sm sombra-de-papel [--giro:-1.5deg] [--atraso:520ms]"
      >
        <span className="text-tinta-suave">verso {AUTOPSICOGRAFIA.grifado}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-destaque">
          <IconeComentar className="h-4 w-4" />
          comentar estes versos
        </span>
      </div>

      <div aria-hidden="true" className="-ml-3 mt-1 flex max-w-xs justify-between text-[0.8125rem] text-tinta-suave">
        {ACOES.map(({ nome, Icone, n, ativa }) => (
          <span key={nome} className={`inline-flex min-h-11 items-center gap-1 pr-2 tabular-nums ${ativa ? "text-destaque" : ""}`}>
            <span className="flex h-11 w-11 items-center justify-center">
              {nome === "curtir" ? <IconeCurtir cheio={ativa} className="h-5 w-5" /> : <Icone className="h-5 w-5" />}
            </span>
            {n > 0 && n}
          </span>
        ))}
      </div>
    </figure>
  );
}
