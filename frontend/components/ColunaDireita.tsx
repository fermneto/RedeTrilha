"use client";
// Coluna direita (telas largas): busca por tag, poema do dia, tags em alta e
// consagrados para seguir. As três rotas são protegidas: sem login, só a busca.
// Cada bloco some quando não tem o que mostrar (ou quando a rota falha).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { IconeBuscar } from "@/components/icones/IconeBuscar";
import {
  buscarEu,
  buscarPoemaDoDia,
  buscarTrending,
  listarSeguindo,
  listarUsuarios,
  normalizarTag,
  seguir,
  temToken,
  type Post,
  type TagContagem,
  type User,
} from "@/lib/api";

// Prévia do poema do dia: até o fim da estrofe que caiba nestas linhas.
const VERSOS_DO_DIA = 8;
const CONSAGRADOS_NO_BLOCO = 3;

export function ColunaDireita() {
  const caminho = usePathname();
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    setLogado(temToken());
  }, [caminho]);

  return (
    <aside
      aria-label="Descobrir"
      className="hidden w-[350px] shrink-0 pl-7 min-[1100px]:block"
    >
      <div className="sticky top-0 max-h-dvh space-y-4 overflow-y-auto pb-6 [scrollbar-width:thin]">
        <Busca />
        {logado && (
          <>
            <PoemaDoDia />
            <EmAlta />
            <ConsagradosParaSeguir />
          </>
        )}
      </div>
    </aside>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-borda bg-painel">
      <h2 className="px-4 pt-3 pb-1 text-xl">{titulo}</h2>
      {children}
    </section>
  );
}

// Leva a /explorar?tag=<termo normalizado>, como o índice de tags do backend grava.
function Busca() {
  const router = useRouter();
  const [termo, setTermo] = useState("");

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const tag = normalizarTag(termo);
    if (!tag) return;
    router.push(`/explorar?tag=${encodeURIComponent(tag)}`);
  }

  return (
    <form role="search" onSubmit={buscar} className="pt-2">
      <label className="group flex h-11 items-center gap-3 rounded-full border border-borda bg-painel px-4 text-tinta-suave focus-within:border-destaque focus-within:bg-papel focus-within:text-destaque">
        <IconeBuscar className="h-5 w-5 shrink-0" />
        <span className="sr-only">Buscar poemas por tag</span>
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar tag"
          className="w-full bg-transparent text-[0.9375rem] text-tinta outline-none"
        />
      </label>
    </form>
  );
}

function PoemaDoDia() {
  const [poema, setPoema] = useState<Post | null>(null);

  useEffect(() => {
    buscarPoemaDoDia()
      .then(setPoema)
      .catch(() => setPoema(null));
  }, []);

  if (!poema) return null;
  const versos = poema.texto.split("\n");
  const corte = linhasDaPrevia(versos);
  const autor = poema.autor;
  return (
    <Bloco titulo="Poema do dia">
      <div className="px-4 pb-4">
        {poema.titulo && <p className="poema-titulo mt-1 text-[1.0625rem]">{poema.titulo}</p>}
        <p className="poema-corpo mt-2 text-[0.9375rem] leading-[1.7]">
          {corte === null ? poema.texto : versos.slice(0, corte).join("\n")}
        </p>
        <p className="mt-3 text-sm text-tinta-suave">
          <Link href={`/u/${autor.username}`} className="font-semibold text-tinta hover:underline">
            {autor.name}
          </Link>
          {autor.morte !== null && (
            <span>
              {" "}
              ({autor.nascimento !== null ? `${autor.nascimento}–${autor.morte}` : `m. ${autor.morte}`})
            </span>
          )}
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

function EmAlta() {
  const [tags, setTags] = useState<TagContagem[]>([]);

  useEffect(() => {
    buscarTrending()
      .then((r) => setTags(r.items))
      .catch(() => setTags([]));
  }, []);

  if (tags.length === 0) return null;
  return (
    <Bloco titulo="Em alta">
      <ul className="pb-2">
        {tags.map(({ tag, contagem }) => (
          <li key={tag}>
            <Link href={`/explorar?tag=${encodeURIComponent(tag)}`} className="realce block px-4 py-2.5">
              <span className="block font-bold">#{tag}</span>
              <span className="block text-[0.8125rem] text-tinta-suave tabular-nums">
                {contagem} {contagem === 1 ? "poema" : "poemas"} nas últimas 24 h
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Bloco>
  );
}

// Consagrados que o usuário ainda não segue. /usuarios não filtra por consagrado,
// então o filtro é feito aqui sobre a primeira página (até 100 contas).
function ConsagradosParaSeguir() {
  const [poetas, setPoetas] = useState<User[]>([]);

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

  if (poetas.length === 0) return null;
  return (
    <Bloco titulo="Consagrados para seguir">
      <ul className="pb-2">
        {poetas.map((poeta) => (
          <li key={poeta.id}>
            <LinhaPoeta poeta={poeta} />
          </li>
        ))}
      </ul>
    </Bloco>
  );
}

function LinhaPoeta({ poeta }: { poeta: User }) {
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
        <Link href={`/u/${poeta.username}`} className="block truncate font-bold hover:underline">
          {poeta.name}
        </Link>
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
        className={`min-h-9 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors duration-150 disabled:cursor-wait disabled:opacity-60 ${
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
