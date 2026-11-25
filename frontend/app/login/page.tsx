"use client";
// /login é a própria landing (components/LayoutDaEntrada.tsx), com o formulário de
// entrar; depois do login volta para a página de onde a pessoa veio (?proximo=)
// ou para o feed.

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { TelaDeEntrada } from "@/components/LayoutDaEntrada";
import { destinoSeguro } from "@/lib/api";

// useSearchParams precisa de Suspense no build estático do Next.
export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const destino = destinoSeguro(useSearchParams().get("proximo"));
  return (
    <>
      <title>Entrar · Verso</title>
      <TelaDeEntrada destino={destino} focarAoAbrir />
    </>
  );
}
