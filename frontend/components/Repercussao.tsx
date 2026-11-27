"use client";
// A repercussão de um poema ou de uma renga, na página da conversa, logo abaixo
// das ações: quem curtiu, quem repostou e onde foi citado, uma linha para cada
// (só as que têm alguém), com os rostos de quem chegou por último. Tocar na
// linha abre a lista inteira ali mesmo, embaixo dela (uma aberta por vez); sem
// modal, para a conversa continuar à vista. Curtir ou repostar ali mesmo põe
// (ou tira) a própria pessoa da linha e da lista aberta na hora, sem nova
// requisição (lib/repercussao.ts).

import Link from "next/link";
import { type ReactNode, useEffect, useId, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { NomeAutor } from "@/components/NomeAutor";
import { TextoFormatado } from "@/components/TextoFormatado";
import {
  buscarCitacoes,
  buscarQuemCurtiu,
  buscarQuemRepostou,
  formatarData,
  mensagemDeFalha,
  type Alvo,
  type Page,
  type Post,
  type User,
} from "@/lib/api";
import { noPlural } from "@/lib/numeros";
import { comAPessoa, ouvirAcoes } from "@/lib/repercussao";

// Quantos rostos a linha mostra.
const ROSTOS = 3;
const POR_PAGINA = 20;

type Qual = "curtidas" | "reposts" | "citacoes";
type Previas = { curtidas: Page<User>; reposts: Page<User>; citacoes: Page<Post> };

// `eu`: quem está lendo, que a página já buscou; sem ele, a linha não acompanha
// as ações (e espera a próxima visita).
export function Repercussao({ alvo, eu }: { alvo: Alvo; eu: User | null }) {
  const [previas, setPrevias] = useState<Previas | null>(null);
  const [aberta, setAberta] = useState<Qual | null>(null);
  const idDoPainel = useId();

  useEffect(() => {
    let vivo = true;
    Promise.all([
      buscarQuemCurtiu(alvo, 0, ROSTOS),
      buscarQuemRepostou(alvo, 0, ROSTOS),
      buscarCitacoes(alvo, 0, ROSTOS),
    ])
      .then(([curtidas, reposts, citacoes]) => {
        if (vivo) setPrevias({ curtidas, reposts, citacoes });
      })
      // Sem a repercussão, a página continua: as ações já mostram os números.
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [alvo.tipo, alvo.id]);

  useEffect(() => {
    if (!eu) return;
    return ouvirAcoes(({ alvo: daAcao, acao, ativo }) => {
      if (daAcao.tipo !== alvo.tipo || daAcao.id !== alvo.id) return;
      setPrevias((antes) => antes && { ...antes, [acao]: comAPessoa(antes[acao], eu, ativo, ROSTOS) });
    });
  }, [alvo.tipo, alvo.id, eu]);

  if (!previas) return null;
  // Poema é "curtido", renga é "curtida".
  const a = alvo.tipo === "renga" ? "a" : "o";
  type Linha = { qual: Qual; total: number; rostos: User[]; frase: ReactNode; lista: ReactNode };
  const todas: Linha[] = [
    {
      qual: "curtidas",
      total: previas.curtidas.total,
      rostos: previas.curtidas.items,
      frase: <Nomes antes={`curtid${a} por`} pagina={previas.curtidas} euId={eu?.id ?? null} />,
      lista: (
        <ListaDePessoas
          alvo={alvo}
          qual="curtidas"
          eu={eu}
          buscar={(offset) => buscarQuemCurtiu(alvo, offset, POR_PAGINA)}
        />
      ),
    },
    {
      qual: "reposts",
      total: previas.reposts.total,
      rostos: previas.reposts.items,
      frase: <Nomes antes={`repostad${a} por`} pagina={previas.reposts} euId={eu?.id ?? null} />,
      lista: (
        <ListaDePessoas
          alvo={alvo}
          qual="reposts"
          eu={eu}
          buscar={(offset) => buscarQuemRepostou(alvo, offset, POR_PAGINA)}
        />
      ),
    },
    {
      qual: "citacoes",
      total: previas.citacoes.total,
      rostos: semRepetir(previas.citacoes.items.map((p) => p.autor)),
      frase: (
        <>
          citad{a} em{" "}
          <span className="font-semibold text-tinta tabular-nums">
            {previas.citacoes.total} {noPlural(previas.citacoes.total, "publicação", "publicações")}
          </span>
        </>
      ),
      lista: <ListaDeCitacoes alvo={alvo} />,
    },
  ];
  const linhas = todas.filter((linha) => linha.total > 0);
  if (linhas.length === 0) return null;

  return (
    <section aria-label="quem curtiu, repostou e citou" className="-mx-2">
      {linhas.map(({ qual, rostos, frase, lista }) => {
        const aberto = aberta === qual;
        return (
          <div key={qual}>
            <button
              type="button"
              aria-expanded={aberto}
              aria-controls={aberto ? idDoPainel : undefined}
              onClick={() => setAberta(aberto ? null : qual)}
              className="realce flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-left text-[0.8125rem] text-tinta-suave"
            >
              <Rostos usuarios={rostos} />
              <span className="min-w-0 flex-1">{frase}</span>
              <Seta aberta={aberto} />
            </button>
            {aberto && (
              <div id={idDoPainel} className="px-2 pt-1 pb-3">
                {lista}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function semRepetir(usuarios: User[]): User[] {
  return usuarios.filter((u, i) => usuarios.findIndex((v) => v.id === u.id) === i);
}

// Os rostos empilhados, quem chegou por último na frente.
function Rostos({ usuarios }: { usuarios: User[] }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 -space-x-1">
      {usuarios.slice(0, ROSTOS).map((u, i) => (
        <span key={u.id} className="rounded-full ring-2 ring-papel" style={{ zIndex: ROSTOS - i }}>
          <Avatar usuario={u} tamanho="mi" />
        </span>
      ))}
    </span>
  );
}

// "curtido por Ana, Bia e mais 3": os nomes sem link (a linha inteira é o botão).
// A própria pessoa aparece como "você" ("curtido por você, Ana e mais 3").
function Nomes({ antes, pagina, euId }: { antes: string; pagina: Page<User>; euId: number | null }) {
  const nomes = pagina.items.slice(0, 2).map((u) => (u.id === euId ? "você" : u.name));
  const resto = pagina.total - nomes.length;
  return (
    <>
      {antes}{" "}
      {nomes.map((nome, i) => (
        <span key={i}>
          {i > 0 && (resto > 0 ? ", " : " e ")}
          <span className="font-semibold text-tinta">{nome}</span>
        </span>
      ))}
      {resto > 0 && (
        <>
          {" "}
          e mais <span className="tabular-nums">{resto}</span>
        </>
      )}
    </>
  );
}

function Seta({ aberta }: { aberta: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 transition-transform duration-150 ${aberta ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// Uma lista paginada ("ver mais" pede a próxima página).
function usePaginas<T>(buscar: (offset: number) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(offset: number) {
    setCarregando(true);
    setErro(null);
    try {
      const pagina = await buscar(offset);
      setItems((antes) => (offset === 0 ? pagina.items : [...antes, ...pagina.items]));
      setTotal(pagina.total);
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para carregar a lista"));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar(0);
    // Uma vez, ao abrir: a lista monta de novo (e se atualiza) a cada vez que a linha abre.
  }, []);

  const rodape = (
    <>
      {erro && <p className="pt-2 text-xs text-destaque">{erro}</p>}
      {carregando && <p className="pt-2 text-xs text-tinta-suave">carregando...</p>}
      {!carregando && total !== null && items.length < total && (
        <button
          type="button"
          onClick={() => carregar(items.length)}
          className="mt-1 min-h-11 cursor-pointer text-[0.8125rem] font-semibold text-destaque hover:underline"
        >
          ver mais
        </button>
      )}
    </>
  );
  // Muda a lista já carregada sem pedir de novo (curtir ou repostar com ela
  // aberta). O "ver mais" segue de items.length, que continua certo: no servidor,
  // quem acabou de curtir também entrou no começo (ou saiu).
  function ajustar(mudar: (pagina: Page<T>) => Page<T>) {
    if (total === null) return;
    const mudada = mudar({ items, total, offset: 0, limit: items.length });
    setItems(mudada.items);
    setTotal(mudada.total);
  }

  return { items, rodape, ajustar };
}

function ListaDePessoas({
  alvo,
  qual,
  eu,
  buscar,
}: {
  alvo: Alvo;
  qual: "curtidas" | "reposts";
  eu: User | null;
  buscar: (offset: number) => Promise<Page<User>>;
}) {
  const { items, rodape, ajustar } = usePaginas(buscar);

  // Sem dependências: o ajustar de cada render enxerga a lista daquele render.
  useEffect(() => {
    if (!eu) return;
    return ouvirAcoes(({ alvo: daAcao, acao, ativo }) => {
      if (daAcao.tipo === alvo.tipo && daAcao.id === alvo.id && acao === qual) {
        ajustar((pagina) => comAPessoa(pagina, eu, ativo));
      }
    });
  });
  return (
    <>
      <ul>
        {items.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-1.5">
            <Avatar usuario={u} tamanho="p" />
            <span className="min-w-0 leading-tight">
              <NomeAutor usuario={u} className="text-sm font-semibold text-tinta" />
              <span className="block truncate text-xs text-tinta-suave">@{u.username}</span>
            </span>
          </li>
        ))}
      </ul>
      {rodape}
    </>
  );
}

// As publicações que citaram: quem, quando e o começo do texto (até quatro
// linhas, com as quebras), que leva à página da citação.
function ListaDeCitacoes({ alvo }: { alvo: Alvo }) {
  const { items, rodape } = usePaginas((offset) => buscarCitacoes(alvo, offset, POR_PAGINA));
  return (
    <>
      <ul className="divide-y divide-borda/70">
        {items.map((citacao) => (
          <li key={citacao.id} className="py-3 first:pt-1">
            <p className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-tinta-suave">
              <Avatar usuario={citacao.autor} tamanho="mi" />
              <NomeAutor usuario={citacao.autor} className="font-semibold text-tinta" />
              <time dateTime={citacao.created_at} className="shrink-0 tabular-nums">
                · {formatarData(citacao.created_at)}
              </time>
            </p>
            <Link
              href={`/poema/${citacao.id}`}
              className="realce -mx-2 mt-1 block rounded-lg px-2 py-1.5 font-serifada text-[0.9375rem] leading-relaxed"
            >
              {citacao.titulo && <span className="block font-semibold">{citacao.titulo}</span>}
              <span className="line-clamp-4 break-words whitespace-pre-wrap">
                <TextoFormatado texto={citacao.texto} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rodape}
    </>
  );
}
