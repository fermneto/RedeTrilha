"use client";
// A landing do Verso, a porta de entrada sem login: em "/" (quando não há token) e
// em /login. Duas colunas no desktop: à esquerda a marca, a frase e um poema; à
// direita o formulário de entrar e o "Criar conta". No celular empilha na ordem do
// DOM (marca, formulário, poema), para o formulário aparecer logo na primeira tela.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buscarEu, entrar, ErroDaApi, mensagemDeFalha, salvarToken, temToken } from "@/lib/api";

// Primeira estrofe de "Autopsicografia" (1932), de Fernando Pessoa, domínio
// público. Fica fixa no front, sem depender do backend.
const POEMA = {
  titulo: "Autopsicografia",
  autor: "Fernando Pessoa",
  texto: "O poeta é um fingidor.\nFinge tão completamente\nQue chega a fingir que é dor\nA dor que deveras sente.",
  fonte: "https://pt.wikisource.org/wiki/Autopsicografia",
};

type Props = {
  // Para onde ir depois de entrar (já passado pelo destinoSeguro).
  destino?: string;
  // Só no /login: lá a pessoa veio para entrar, então o cursor já fica no campo.
  focarAoAbrir?: boolean;
};

export function TelaDeEntrada({ destino = "/", focarAoAbrir = false }: Props) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto grid w-full max-w-[60rem] flex-1 content-center gap-x-16 gap-y-10 px-4 pt-12 pb-10 sm:px-6 md:grid-cols-[minmax(0,1fr)_22rem] md:[grid-template-areas:'marca_entrar''poema_entrar'] md:py-16">
        <div className="md:self-end md:[grid-area:marca]">
          <Link
            href="/"
            aria-label="Verso, início"
            className="-mx-1 inline-block rounded-lg px-1 font-serifada text-6xl leading-none font-semibold italic tracking-tight md:text-7xl"
          >
            <span aria-hidden="true">Verso</span>
          </Link>
          <h1 className="mt-4 text-2xl leading-snug font-semibold text-tinta-suave md:mt-5 md:text-[1.75rem]">
            Onde a poesia acontece.
          </h1>
        </div>

        <section aria-labelledby="titulo-entrar" className="md:self-center md:[grid-area:entrar]">
          <FormularioDeEntrada destino={destino} focarAoAbrir={focarAoAbrir} />
        </section>

        <figure className="max-w-md rounded-2xl border border-borda bg-papel-alto px-6 py-7 shadow-[0_1px_2px_rgb(31_27_22/0.04),0_12px_32px_-12px_rgb(31_27_22/0.12)] sm:px-8 sm:py-8 dark:shadow-none md:self-start md:[grid-area:poema]">
          <h2 className="poema-titulo">{POEMA.titulo}</h2>
          <blockquote cite={POEMA.fonte} className="poema-corpo mt-4">
            {POEMA.texto}
          </blockquote>
          <figcaption className="mt-5 text-sm text-tinta-suave">{POEMA.autor}</figcaption>
        </figure>
      </main>

      <footer className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center text-xs text-tinta-suave">
        © 2026 Verso
      </footer>
    </div>
  );
}

// Mesmos estilos do Compositor (input arredondado, foco na cor de destaque).
const CAMPO =
  "mt-1 w-full rounded-xl border border-borda bg-papel-alto px-3 py-2 font-normal text-tinta transition-colors duration-150 focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none";

// Login: troca username e senha por um token (POST /auth/login), guarda o token
// e vai para o destino. Com token já salvo, confere se ele ainda vale antes de
// mostrar o formulário (em /login; em "/" o Layout só mostra a landing sem token).
function FormularioDeEntrada({ destino, focarAoAbrir }: Required<Props>) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [conferindo, setConferindo] = useState(true);

  useEffect(() => {
    if (!temToken()) {
      setConferindo(false);
      return;
    }
    // Token inválido: o api.ts já o apaga no 401; aí o formulário aparece.
    buscarEu()
      .then(() => router.replace(destino))
      .catch(() => setConferindo(false));
  }, [router, destino]);

  async function aoEntrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const { token } = await entrar(username, senha);
      salvarToken(token);
      router.replace(destino);
    } catch (err) {
      if (err instanceof ErroDaApi && err.status === 401) setErro("username ou senha incorretos");
      else setErro(mensagemDeFalha(err, "não deu para entrar"));
      setEnviando(false);
    }
  }

  // Enquanto confere o token, o formulário ocupa o lugar dele, invisível: a
  // página não pula quando ele aparece.
  return (
    <div aria-busy={conferindo} className={conferindo ? "invisible" : undefined}>
      <form onSubmit={aoEntrar} className="space-y-4 rounded-2xl border border-borda bg-painel p-6">
        <h2 id="titulo-entrar" className="text-xl">
          Entrar no Verso
        </h2>

        <label className="block text-sm font-semibold">
          username
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus={focarAoAbrir && !conferindo}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={erro !== null}
            aria-describedby={erro ? "erro-login" : undefined}
            className={CAMPO}
          />
        </label>

        <label className="block text-sm font-semibold">
          senha
          <input
            name="password"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            autoComplete="current-password"
            aria-invalid={erro !== null}
            aria-describedby={erro ? "erro-login" : undefined}
            className={CAMPO}
          />
        </label>

        <div id="erro-login" aria-live="polite">
          {erro && <p className="rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>}
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="min-h-11 w-full cursor-pointer rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
        >
          {enviando ? "entrando..." : "Entrar"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-tinta-suave" role="separator" aria-label="ou">
        <span aria-hidden="true" className="h-px flex-1 bg-borda" />
        <span aria-hidden="true">ou</span>
        <span aria-hidden="true" className="h-px flex-1 bg-borda" />
      </div>

      <Link
        href="/cadastro"
        className="realce flex min-h-11 w-full items-center justify-center rounded-full border border-borda px-5 text-sm font-bold text-tinta"
      >
        Criar conta
      </Link>
    </div>
  );
}
