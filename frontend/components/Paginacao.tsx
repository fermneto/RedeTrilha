// Paginação numerada: "‹ 1 2 3 … 8 ›". São links (o voltar do navegador volta de
// página), e a página atual leva aria-current.

import Link from "next/link";

type Props = {
  atual: number;
  total: number;
  // Caminho de cada página, com os filtros da tela.
  href: (pagina: number) => string;
};

// Vizinhas da atual que aparecem dos dois lados; o resto vira "…".
const VIZINHAS = 1;

// [1, "…", 4, 5, 6, "…", 12]: a primeira, a última e as vizinhas da atual. Um "…"
// que esconderia uma página só vira a própria página.
function paginasVisiveis(atual: number, total: number): (number | "…")[] {
  const numeros = new Set([1, total]);
  for (let p = atual - VIZINHAS; p <= atual + VIZINHAS; p++) {
    if (p >= 1 && p <= total) numeros.add(p);
  }
  const ordenados = [...numeros].sort((a, b) => a - b);
  const saida: (number | "…")[] = [];
  ordenados.forEach((p, i) => {
    const anterior = ordenados[i - 1];
    if (anterior !== undefined && p - anterior === 2) saida.push(anterior + 1);
    else if (anterior !== undefined && p - anterior > 2) saida.push("…");
    saida.push(p);
  });
  return saida;
}

const base =
  "flex h-11 min-w-11 items-center justify-center rounded-full px-2 text-sm font-bold tabular-nums";

export function Paginacao({ atual, total, href }: Props) {
  if (total <= 1) return null;
  return (
    <nav aria-label="páginas" className="flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          <Seta pagina={atual - 1} total={total} href={href} rotulo="página anterior" simbolo="‹" />
        </li>
        {paginasVisiveis(atual, total).map((p, i) =>
          p === "…" ? (
            <li key={`reticencias-${i}`} aria-hidden="true" className={`${base} text-tinta-suave`}>
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                aria-current={p === atual ? "page" : undefined}
                aria-label={`página ${p}`}
                className={`${base} ${p === atual ? "bg-tinta text-papel" : "realce text-tinta"}`}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          <Seta pagina={atual + 1} total={total} href={href} rotulo="próxima página" simbolo="›" />
        </li>
      </ul>
    </nav>
  );
}

function Seta({
  pagina,
  total,
  href,
  rotulo,
  simbolo,
}: {
  pagina: number;
  total: number;
  href: (pagina: number) => string;
  rotulo: string;
  simbolo: string;
}) {
  const conteudo = (
    <span aria-hidden="true" className="text-lg leading-none">
      {simbolo}
    </span>
  );
  // Sem página para ir: fica no lugar (a fileira não pula), mas apagada e fora do Tab.
  if (pagina < 1 || pagina > total) {
    return (
      <a role="link" aria-disabled="true" aria-label={rotulo} className={`${base} text-tinta-suave opacity-40`}>
        {conteudo}
      </a>
    );
  }
  return (
    <Link href={href(pagina)} aria-label={rotulo} className={`${base} realce text-tinta`}>
      {conteudo}
    </Link>
  );
}
