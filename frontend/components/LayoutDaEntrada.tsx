"use client";
// A porta de entrada do Verso, sem login: em "/" (quando não há token), em /login e
// em /cadastro. À esquerda, a frase e o formulário; à direita, a capa do livro
// fechado (components/CapaDoLivro.tsx), o mesmo pano do Caderno. No desktop (de
// 1024 px) a moldura repete as medidas do livro aberto, e a capa fica exatamente
// sobre a metade direita dele: ao entrar, ela gira na dobra e revela o livro já
// aberto, sem nada mudar de lugar. No celular, a capa é uma faixa no alto e o
// formulário vem embaixo; ao entrar, ela desce sobre a tela e abre.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CapaDaEntrada, useAbrirCapa } from "@/components/CapaDoLivro";
import { buscarEu, entrar, ErroDaApi, mensagemDeFalha, salvarToken, temToken } from "@/lib/api";

// A moldura da entrada: a mesma caixa da capa do Caderno no desktop (h-dvh com
// px-6 py-5, até 1400 px), com a dobra (--dobra) no meio do miolo, depois da
// lombada (5.25rem) e antes da sobra da capa (7 px).
export function MolduraDaEntrada({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:items-center lg:justify-center lg:px-6 lg:py-5">
      <div className="relative flex flex-1 flex-col lg:h-full lg:w-full lg:max-w-[1400px] lg:flex-none lg:[--dobra:calc(5.25rem+(100%-5.25rem-7px)/2)]">
        <CapaDaEntrada />
        <div className="flex flex-1 flex-col lg:absolute lg:inset-y-0 lg:left-0 lg:w-[var(--dobra)] lg:overflow-y-auto">
          <main className="flex flex-1 flex-col items-center justify-center px-6 pt-10 pb-10 lg:px-10 lg:py-12">
            {children}
          </main>
          <footer className="px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs text-tinta-suave lg:pb-3">
            © 2026 Verso
          </footer>
        </div>
      </div>
    </div>
  );
}

type Props = {
  // Para onde ir depois de entrar (já passado pelo destinoSeguro).
  destino?: string;
  // Só no /login: lá a pessoa veio para entrar, então o cursor já fica no campo.
  focarAoAbrir?: boolean;
};

export function TelaDeEntrada({ destino = "/", focarAoAbrir = false }: Props) {
  return (
    <MolduraDaEntrada>
      <div className="w-full max-w-sm lg:max-w-[24rem] 2xl:max-w-[26rem]">
        <h1 className="text-center text-[2.25rem] leading-[1.1] font-semibold text-balance lg:text-[2.75rem] xl:text-[3.25rem]">
          Onde a <em className="font-serifada font-medium text-destaque">poesia</em> acontece.
        </h1>
        <section aria-labelledby="titulo-entrar" className="mt-10 lg:mt-12">
          <FormularioDeEntrada destino={destino} focarAoAbrir={focarAoAbrir} />
        </section>
      </div>
    </MolduraDaEntrada>
  );
}

// Mesmos estilos do Compositor (input arredondado, foco na cor de destaque).
const CAMPO =
  "mt-1 w-full rounded-xl border border-borda bg-papel-alto px-3 py-2 font-normal lg:mt-1.5 lg:min-h-12 text-tinta transition-colors duration-150 focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none";

// Login: troca username e senha por um token (POST /auth/login), guarda o token
// e vai para o destino. Com token já salvo, confere se ele ainda vale antes de
// mostrar o formulário (em /login; em "/" o Layout só mostra a landing sem token).
function FormularioDeEntrada({ destino, focarAoAbrir }: Required<Props>) {
  const router = useRouter();
  const abrirCapa = useAbrirCapa();
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
      // Só com o login certo: a capa fecha sobre a tela, o token é gravado, a
      // navegação acontece por baixo dela e ela abre já no destino.
      abrirCapa({
        destino,
        navegar: () => {
          salvarToken(token);
          router.replace(destino);
        },
      });
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
      <form onSubmit={aoEntrar} className="space-y-4 rounded-2xl border border-borda bg-painel p-6 lg:space-y-5 lg:p-8">
        <h2 id="titulo-entrar" className="text-xl lg:pb-2 lg:text-2xl">
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
          className="min-h-11 w-full cursor-pointer rounded-full bg-destaque lg:min-h-12 px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
        >
          {enviando ? "entrando..." : "Entrar"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs lg:my-8 text-tinta-suave" role="separator" aria-label="ou">
        <span aria-hidden="true" className="h-px flex-1 bg-borda" />
        <span aria-hidden="true">ou</span>
        <span aria-hidden="true" className="h-px flex-1 bg-borda" />
      </div>

      <Link
        href="/cadastro"
        className="realce flex min-h-11 w-full items-center lg:min-h-12 justify-center rounded-full border border-borda px-5 text-sm font-bold text-tinta"
      >
        Criar conta
      </Link>
    </div>
  );
}
