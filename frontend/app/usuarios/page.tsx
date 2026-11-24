"use client";
// ↑ este arquivo usa useState/useEffect → precisa ser client component.

// Tela Poetas: a lista de quem está no Verso. Conta nova nasce só no /cadastro.

import { useEffect, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { UserCard } from "@/components/UserCard";
import { listarUsuarios, type Page, type User } from "@/lib/api";

export default function UsuariosPage() {
  const [pagina, setPagina] = useState<Page<User> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarUsuarios(0, 20)
      .then((resposta) => {
        setPagina(resposta);
        setErro(null);
      })
      .catch(() =>
        setErro(
          "não consegui falar com o backend — ele está rodando? (make dev-back; ver guia 04)"
        )
      );
  }, []);

  return (
    <div>
      <CabecalhoPagina titulo="Poetas" />
      <div className="space-y-6 px-4 py-5">
        {erro && <p className="rounded border border-destaque p-3 text-sm text-destaque">{erro}</p>}

        {pagina && (
          <>
            <ul className="space-y-2">
              {pagina.items.map((u) => (
                <li key={u.id}>
                  <UserCard user={u} />
                </li>
              ))}
            </ul>
            <p className="text-sm text-tinta-suave">
              mostrando {pagina.items.length} de {pagina.total}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
