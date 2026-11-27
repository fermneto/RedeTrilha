"use client";
// A página da direita do caderno nas rotas que não desenham as próprias folhas
// (só na página dupla, de 1024 px): a busca (tags e poetas, a mesma do Explorar),
// o poema do dia e consagrados para seguir. Pouca coisa por página: as tags em
// alta ficam no Explorar. No Explorar, a busca já está no corpo da tela, então a
// página fica só com os outros dois; na página única, esses dois vão para o
// Explorar (DescobrirNoTopo).
// Todas as rotas, a da busca inclusive, são protegidas: sem login, a coluna fica vazia.
// Enquanto carrega, cada bloco mostra o título e o esqueleto do conteúdo; depois,
// some quando não tem o que mostrar (ou quando a rota falha).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { BuscaDoExplorar } from "@/components/BuscaDoExplorar";
import { EsqueletoDePessoas, EsqueletoDoPoemaDoDia } from "@/components/Esqueleto";
import { NomeAutor } from "@/components/NomeAutor";
import { Icone } from "@/components/icones/Icone";
import { TextoFormatado } from "@/components/TextoFormatado";
import {
  buscarEu,
  buscarPoemaDoDia,
  listarSeguindo,
  listarUsuarios,
  seguir,
  temToken,
  type Post,
  type User,
} from "@/lib/api";

// Prévia do poema do dia: até o fim da estrofe que caiba nestas linhas.
const VERSOS_DO_DIA = 8;
const CONSAGRADOS_NO_BLOCO = 3;

export function ColunaDireita() {
  const caminho = usePathname();
  const [logado, setLogado] = useState(false);
  const noExplorar = caminho === "/explorar";

  useEffect(() => {
    setLogado(temToken());
  }, [caminho]);

  return (
    <aside aria-label="Descobrir" className="space-y-8 px-(--recuo-da-folha) pt-10 pb-6">
      {logado && (
        <>
          {!noExplorar && <BuscaDoExplorar variante="coluna" />}
          <PoemaDoDia />
          <ConsagradosParaSeguir />
        </>
      )}
    </aside>
  );
}

// Explorar na página única, onde esta página some. A busca e o "Em alta" ficam
// de fora: o Explorar já tem os dele. Para os poemas não descerem demais, os
// blocos vêm recolhíveis e fechados.
export function DescobrirNoTopo() {
  return (
    <>
      <PoemaDoDia recolhivel="fechado" />
      <ConsagradosParaSeguir recolhivel="fechado" />
    </>
  );
}

// Recolhível: um <details> nativo (teclado e leitor de tela de graça), com o
// título no <summary>; "aberto" ou "fechado" diz como ele começa.
type Recolhivel = "aberto" | "fechado";

function Bloco({
  titulo,
  recolhivel,
  children,
}: {
  titulo: string;
  recolhivel?: Recolhivel;
  children: React.ReactNode;
}) {
  const caixa = "rounded-2xl border border-borda bg-painel";
  // Na página do caderno, sem caixa: o título e o conteúdo, separados pelo espaço.
  if (!recolhivel) {
    return (
      <section>
        <h2 className="px-4 pb-1 text-base">{titulo}</h2>
        {children}
      </section>
    );
  }
  return (
    <details open={recolhivel === "aberto"} className={`group ${caixa}`}>
      <summary className="realce flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-2 [&::-webkit-details-marker]:hidden">
        <h2 className="text-lg">{titulo}</h2>
        <IconeSeta className="h-5 w-5 shrink-0 text-tinta-suave transition-transform duration-150 group-open:rotate-180" />
      </summary>
      {children}
    </details>
  );
}

// Seta para baixo; vira para cima quando o bloco está aberto.
function IconeSeta({ className }: { className?: string }) {
  return (
    <Icone className={className}>
      <path d="M6 9l6 6 6-6" />
    </Icone>
  );
}

function PoemaDoDia({ recolhivel }: { recolhivel?: Recolhivel }) {
  // undefined enquanto carrega; null quando a rota falha.
  const [poema, setPoema] = useState<Post | null | undefined>(undefined);

  useEffect(() => {
    buscarPoemaDoDia()
      .then(setPoema)
      .catch(() => setPoema(null));
  }, []);

  if (poema === undefined)
    return (
      <Bloco titulo="Poema do dia" recolhivel={recolhivel}>
        <EsqueletoDoPoemaDoDia />
      </Bloco>
    );
  if (!poema) return null;
  const versos = poema.texto.split("\n");
  const corte = linhasDaPrevia(versos);
  const autor = poema.autor;
  return (
    <Bloco titulo="Poema do dia" recolhivel={recolhivel}>
      <div className="surgir px-4 pb-4">
        {poema.titulo && <p className="poema-titulo mt-1 text-[1.0625rem]">{poema.titulo}</p>}
        <p className={`poema-corpo mt-2 text-[0.9375rem] leading-[1.7]${corte === null ? "" : " poema-cortado"}`}>
          <TextoFormatado texto={corte === null ? poema.texto : versos.slice(0, corte).join("\n")} />
        </p>
        <p className="mt-3 text-sm text-tinta-suave">
          <NomeAutor usuario={autor} className="font-semibold text-tinta" />
        </p>
        <Link
          href={`/poema/${poema.id}`}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-destaque hover:underline"
        >
          {corte === null ? "abrir poema" : "ler poema inteiro"}
        </Link>
      </div>
    </Bloco>
  );
}

// Mesma ideia do PoemaCard: corta no fim de uma estrofe, sem terminar em linha vazia.
function linhasDaPrevia(versos: string[]): number | null {
  if (versos.length <= VERSOS_DO_DIA) return null;
  const vazia = (i: number) => versos[i].trim() === "";
  for (let fim = VERSOS_DO_DIA; fim > 0; fim--) {
    if (vazia(fim) && !vazia(fim - 1)) return fim;
  }
  return VERSOS_DO_DIA;
}

// Consagrados que o usuário ainda não segue. /usuarios não filtra por consagrado,
// então o filtro é feito aqui sobre a primeira página (até 100 contas).
function ConsagradosParaSeguir({ recolhivel }: { recolhivel?: Recolhivel }) {
  // null enquanto carrega.
  const [poetas, setPoetas] = useState<User[] | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [eu, todos] = await Promise.all([buscarEu(), listarUsuarios()]);
        const seguidos = await listarSeguindo(eu.username);
        const jaSigo = new Set(seguidos.items.map((u) => u.id));
        const sugestoes = todos.items
          .filter((u) => u.consagrado && !jaSigo.has(u.id))
          .slice(0, CONSAGRADOS_NO_BLOCO);
        if (vivo) setPoetas(sugestoes);
      } catch {
        if (vivo) setPoetas([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (poetas === null)
    return (
      <Bloco titulo="Consagrados para seguir" recolhivel={recolhivel}>
        <EsqueletoDePessoas quantos={CONSAGRADOS_NO_BLOCO} comLink />
      </Bloco>
    );
  if (poetas.length === 0) return null;
  return (
    <Bloco titulo="Consagrados para seguir" recolhivel={recolhivel}>
      <ul className="surgir pb-2">
        {poetas.map((poeta) => (
          <li key={poeta.id}>
            <LinhaPoeta poeta={poeta} />
          </li>
        ))}
      </ul>
      <Link
        href="/sugestoes"
        className="realce flex min-h-11 items-center rounded-b-2xl px-4 text-sm font-semibold text-destaque"
      >
        ver mais poetas para seguir
      </Link>
    </Bloco>
  );
}

// Também no bloco "Quem seguir" do feed Para você (QuemSeguirNoFeed).
export function LinhaPoeta({ poeta }: { poeta: User }) {
  const [sigo, setSigo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(false);

  async function alternar() {
    const novo = !sigo;
    setOcupado(true);
    setErro(false);
    try {
      await seguir(poeta.username, novo);
      setSigo(novo);
    } catch {
      setErro(true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Avatar usuario={poeta} />
      <div className="min-w-0 flex-1">
        <span className="flex">
          <NomeAutor usuario={poeta} />
        </span>
        <p className="truncate text-sm text-tinta-suave">
          {erro ? "não deu, tente de novo" : `@${poeta.username}`}
        </p>
      </div>
      <button
        type="button"
        onClick={alternar}
        disabled={ocupado}
        aria-pressed={sigo}
        aria-label={`Seguir ${poeta.name}`}
        className={`min-h-11 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors duration-150 disabled:cursor-wait disabled:opacity-60 ${
          sigo
            ? "border border-borda text-tinta hover:border-destaque hover:text-destaque"
            : "bg-tinta text-papel hover:bg-tinta/85"
        }`}
      >
        {sigo ? "Seguindo" : "Seguir"}
      </button>
    </div>
  );
}
