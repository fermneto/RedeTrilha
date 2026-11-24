"use client";
// Login: troca username e senha por um token (POST /auth/login), guarda o token
// e volta para a página de onde a pessoa veio (?proximo=) ou para o feed.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { buscarEu, destinoSeguro, entrar, ErroDaApi, mensagemDeFalha, salvarToken, temToken } from "@/lib/api";

// useSearchParams precisa de Suspense no build estático do Next.
export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const destino = destinoSeguro(useSearchParams().get("proximo"));
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Com token salvo, confere se ele ainda vale antes de mostrar o formulário.
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

  if (conferindo) return <p className="text-center text-sm text-tinta-suave">carregando...</p>;

  // Mesmos estilos do Compositor (input arredondado, foco na cor de destaque).
  const campo =
    "w-full rounded-xl border border-borda bg-papel-alto px-3 py-2 text-tinta transition-colors duration-150 focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none";
  return (
    <div className="space-y-6">
      <title>Entrar · Verso</title>
      <h1 className="text-center text-2xl">Entrar</h1>

      <form
        onSubmit={aoEntrar}
        className="space-y-4 rounded-2xl border border-borda bg-painel p-6"
      >
        <label className="block text-sm font-semibold">
          username
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={erro !== null}
            aria-describedby={erro ? "erro-login" : undefined}
            className={`${campo} mt-1 font-normal`}
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
            className={`${campo} mt-1 font-normal`}
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

      <p className="text-center text-sm text-tinta-suave">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-destaque hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
