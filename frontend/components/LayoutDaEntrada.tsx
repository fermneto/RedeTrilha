"use client";
// A landing do Verso, a porta de entrada sem login: em "/" (quando não há token) e
// em /login. Como a entrada do Instagram: a marca pequena no canto de cima e, no
// meio da tela, a frase centralizada com a vitrine em leque embaixo
// (LayoutDaEntradaVitrine.tsx) e, à direita, o cartão de entrar com o "Criar
// conta", alinhado na vertical com o leque. Os dois blocos ficam juntos no centro
// da largura, sem vão entre eles. Embaixo, o rodapé de largura total.
// Abaixo de 1024 px empilha: marca, frase, formulário e vitrine (pelo `order`; a
// única parte interativa é o formulário, então o foco segue a mesma ordem).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Vitrine } from "@/components/LayoutDaEntradaVitrine";
import { buscarEu, entrar, ErroDaApi, mensagemDeFalha, salvarToken, temToken } from "@/lib/api";

type Props = {
  // Para onde ir depois de entrar (já passado pelo destinoSeguro).
  destino?: string;
  // Só no /login: lá a pessoa veio para entrar, então o cursor já fica no campo.
  focarAoAbrir?: boolean;
};

export function TelaDeEntrada({ destino = "/", focarAoAbrir = false }: Props) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <Link
        href="/"
        aria-label="Verso, início"
        className="mx-6 mt-6 self-start rounded-lg px-1 font-serifada text-[2rem] leading-none font-semibold italic tracking-tight lg:mx-10 lg:mt-10"
      >
        <span aria-hidden="true">Verso</span>
      </Link>

      <main className="flex flex-1 flex-col items-center px-6 pt-10 pb-16 lg:grid lg:grid-cols-[auto_20rem] lg:content-center lg:justify-center lg:gap-x-10 lg:gap-y-10 lg:px-10 lg:pt-4 lg:[grid-template-areas:'frase_.''leque_entrar'] xl:grid-cols-[auto_22rem] xl:gap-x-20 2xl:gap-x-28">
        <h1 className="order-1 text-center text-[2.25rem] leading-[1.1] font-semibold text-balance lg:text-[2.75rem] lg:[grid-area:frase] xl:text-[3.25rem]">
          Onde a <em className="font-serifada font-medium text-destaque">poesia</em> acontece.
        </h1>

        <section aria-labelledby="titulo-entrar" className="order-2 mt-10 w-full max-w-sm lg:mt-0 lg:max-w-none lg:self-center lg:[grid-area:entrar]">
          <FormularioDeEntrada destino={destino} focarAoAbrir={focarAoAbrir} />
        </section>

        <div className="order-3 mt-14 flex justify-center lg:mt-0 lg:self-center lg:[grid-area:leque]">
          <Vitrine />
        </div>
      </main>

      <footer className="border-t border-borda px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs text-tinta-suave">
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
