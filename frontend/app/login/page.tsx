"use client";
// Login: troca username e senha por um token (POST /auth/login), guarda o token
// e volta para a página de onde a pessoa veio (?proximo=) ou para o feed.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { buscarEu, destinoSeguro, entrar, ErroDaApi, salvarToken, temToken } from "@/lib/api";

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
      else setErro(err instanceof Error ? err.message : "não deu para entrar");
      setEnviando(false);
    }
  }

  if (conferindo) return <p className="text-sm text-tinta-suave">carregando...</p>;

  const campo = "w-full rounded border border-borda bg-papel px-3 py-2 text-tinta";
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <title>Entrar · Verso</title>
      <h1 className="text-center text-3xl">Entrar</h1>

      <form
        onSubmit={aoEntrar}
        className="space-y-4 rounded-lg border border-borda bg-papel-alto p-6"
      >
        <label className="block text-sm">
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
            className={`${campo} mt-1`}
          />
        </label>

        <label className="block text-sm">
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
            className={`${campo} mt-1`}
          />
        </label>

        <div id="erro-login" aria-live="polite">
          {erro && <p className="rounded border border-destaque p-3 text-sm text-destaque">{erro}</p>}
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full cursor-pointer rounded bg-tinta px-4 py-2 text-sm text-papel disabled:opacity-50"
        >
          {enviando ? "entrando..." : "Entrar"}
        </button>
      </form>

      <p className="text-center text-sm text-tinta-suave">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-tinta underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
