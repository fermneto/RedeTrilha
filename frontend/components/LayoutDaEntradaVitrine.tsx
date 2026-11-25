// A vitrine da landing: o Verso mostrado por ele mesmo, como na entrada do
// Instagram. Na frente, um cartão no estilo do PoemaCard do feed (avatar, selo de
// consagrado, o poema e as ações), com um verso grifado e a barra "comentar estes
// versos", o diferencial da rede. Atrás, dois cartões inclinados com outros
// consagrados (só em telas largas, de 1280 px). Por cima flutuam a curtida e o "adicionar à
// antologia". Só textos de domínio público de backend/data/consagrados/; sem
// usuários, números nem comentários inventados.
//
// As peças abrem em leque na entrada (globals.css, .vitrine-*), a partir da
// posição final já visível; com prefers-reduced-motion, ficam paradas.

import { Avatar } from "@/components/Avatar";
import { IconeAdicionarAntologia } from "@/components/icones/IconeAdicionarAntologia";
import { IconeCitar } from "@/components/icones/IconeCitar";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { IconeCurtir } from "@/components/icones/IconeCurtir";
import { IconeRepostar } from "@/components/icones/IconeRepostar";
import { IconeTraduzir } from "@/components/icones/IconeTraduzir";
import { SeloConsagrado } from "@/components/SeloConsagrado";
import type { User } from "@/lib/api";

// Os dados da conta consagrada como no seed (fernando_pessoa.json); sem a foto,
// para a landing não depender de imagem de fora: o Avatar mostra as iniciais.
const PESSOA: User = {
  id: 0,
  username: "fernando_pessoa",
  name: "Fernando Pessoa",
  bio: "",
  avatar_url: "",
  consagrado: true,
  nascimento: 1888,
  morte: 1935,
  created_at: "",
};

// Primeira estrofe de "Autopsicografia" (1932), verso a verso; o 3 vai grifado.
const AUTOPSICOGRAFIA = {
  titulo: "Autopsicografia",
  versos: ["O poeta é um fingidor.", "Finge tão completamente", "Que chega a fingir que é dor", "A dor que deveras sente."],
  grifado: 3,
  fonte: "https://pt.wikisource.org/wiki/Autopsicografia",
};

// Os dois cartões de trás: os primeiros versos de cada poema, como no seed.
const DE_TRAS = [
  {
    autor: "Florbela Espanca",
    titulo: "Ser poeta",
    texto: "Ser poeta é ser mais alto, é ser maior\nDo que os homens! Morder como quem beija!",
    lang: "pt",
    posicao: "-left-32 -top-2 w-64 [--giro:-8deg] [--de:6rem]",
  },
  {
    autor: "Emily Dickinson",
    titulo: "Hope is the thing with feathers",
    texto: "HOPE is the thing with feathers\nThat perches in the soul,",
    lang: "en",
    posicao: "-right-32 top-36 w-60 [--giro:7deg] [--de:-6rem]",
  },
];

const CARTAO = "rounded-2xl border border-borda bg-papel-alto sombra-de-papel";
const PILULA =
  "inline-flex items-center gap-1.5 rounded-full border border-borda bg-papel-alto px-3 py-1.5 text-sm sombra-de-papel";

export function Vitrine() {
  return (
    <div className="relative mx-auto w-full max-w-[23rem]">
      {DE_TRAS.map((cartao) => (
        <div
          key={cartao.autor}
          aria-hidden="true"
          className={`vitrine-leque absolute hidden px-5 py-5 xl:block ${CARTAO} ${cartao.posicao}`}
        >
          <p className="text-[0.8125rem] font-semibold text-tinta-suave">{cartao.autor}</p>
          <p lang={cartao.lang} className="poema-titulo mt-1 text-base">
            {cartao.titulo}
          </p>
          <p lang={cartao.lang} className="poema-corpo mt-2 text-[0.9375rem] leading-relaxed">
            {cartao.texto}
          </p>
          {cartao.lang === "en" && (
            <p className="mt-3 inline-flex items-center gap-1 text-[0.8125rem] text-destaque">
              <IconeTraduzir className="h-4 w-4" />
              traduzir
            </p>
          )}
        </div>
      ))}

      <figure className={`vitrine-frente relative z-10 px-5 pt-4 pb-2 ${CARTAO}`}>
        <div className="flex items-center gap-3">
          <span className="rounded-full p-[2px] ring-2 ring-destaque ring-offset-2 ring-offset-papel-alto">
            <Avatar usuario={PESSOA} tamanho="m" />
          </span>
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
          {AUTOPSICOGRAFIA.versos.map((verso, i) => (
            <span
              key={verso}
              className={`-mx-1.5 block rounded px-1.5 ${i + 1 === AUTOPSICOGRAFIA.grifado ? "bg-destaque/12" : ""}`}
            >
              {verso}
            </span>
          ))}
        </blockquote>
        <figcaption className="sr-only">{PESSOA.name}</figcaption>

        <div
          aria-hidden="true"
          className={`vitrine-flutua mt-2 w-max max-w-full [--giro:-2deg] [--atraso:520ms] lg:translate-x-16 ${PILULA}`}
        >
          <span className="text-tinta-suave">verso {AUTOPSICOGRAFIA.grifado}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-destaque">
            <IconeComentar className="h-4 w-4" />
            comentar estes versos
          </span>
        </div>

        <div aria-hidden="true" className="-ml-3 mt-1 flex max-w-xs justify-between text-tinta-suave">
          {[
            <IconeCurtir key="curtir" cheio className="h-5 w-5 text-destaque" />,
            <IconeRepostar key="repostar" className="h-5 w-5" />,
            <IconeCitar key="citar" className="h-5 w-5" />,
            <IconeComentar key="comentar" className="h-5 w-5" />,
          ].map((icone) => (
            <span key={icone.key} className="flex h-11 w-11 items-center justify-center">
              {icone}
            </span>
          ))}
        </div>
      </figure>

      <span
        aria-hidden="true"
        className="vitrine-flutua absolute -top-5 -right-1 z-20 sm:-right-3 flex h-14 w-14 items-center justify-center rounded-full bg-destaque text-papel sombra-de-papel [--giro:12deg] [--atraso:380ms]"
      >
        <IconeCurtir cheio className="h-7 w-7" />
      </span>

      <span
        aria-hidden="true"
        className={`vitrine-flutua absolute -bottom-5 left-4 z-20 [--giro:3deg] [--atraso:660ms] lg:-left-10 font-semibold ${PILULA}`}
      >
        <IconeAdicionarAntologia className="h-4 w-4 text-destaque" />
        adicionar à antologia
      </span>
    </div>
  );
}
