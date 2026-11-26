"use client";
// Perfil do poeta: cabeçalho (ou o formulário de edição, no próprio perfil) e os
// poemas, citações e reposts da pessoa, com rolagem infinita como o feed, e
// numa segunda aba as antologias públicas dela. No próprio perfil, a aba
// Antologias traz também as privadas, e uma terceira, "Rascunhos", a gaveta dos
// poemas não publicados: só o dono a vê (decisão 9), e para os outros ela nem
// existe (?aba=rascunhos no perfil alheio abre "Poemas").
// No caderno, a página da esquerda é a pessoa (o cabeçalho ou a edição) e a da
// direita, o que ela escreveu e guardou, nas abas.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { Abas } from "@/components/Abas";
import Link from "next/link";

import { AntologiaLista } from "@/components/AntologiaLista";
import { CadernoFolhas } from "@/components/CadernoFolhas";
import { MARGEM_DA_PAGINA } from "@/components/CadernoPoema";
import { EsqueletoDePerfil } from "@/components/Esqueleto";
import { ListaDePoemas } from "@/components/ListaDePoemas";
import { ListaDeRascunhos } from "@/components/ListaDeRascunhos";
import { PerfilCabecalho } from "@/components/PerfilCabecalho";
import { PerfilEdicao } from "@/components/PerfilEdicao";
import {
  buscarEu,
  buscarPerfil,
  buscarPoemasDoPerfil,
  caminhoDoLogin,
  listarAntologiasDe,
  mensagemDeFalha,
  temToken,
  type Perfil,
} from "@/lib/api";

const ABAS = [
  { valor: "poemas", rotulo: "Poemas" },
  { valor: "antologias", rotulo: "Antologias" },
] as const;

const ABAS_DO_DONO = [...ABAS, { valor: "rascunhos", rotulo: "Rascunhos" }] as const;

type Aba = (typeof ABAS_DO_DONO)[number]["valor"];

function lerAba(valor: string | null, proprio: boolean): Aba {
  if (valor === "antologias") return valor;
  return valor === "rascunhos" && proprio ? valor : "poemas";
}

// useSearchParams precisa de Suspense no build do Next.
export default function PerfilPage() {
  return (
    <Suspense>
      <PerfilDoPoeta />
    </Suspense>
  );
}

function PerfilDoPoeta() {
  const router = useRouter();
  const username = decodeURIComponent(useParams<{ username: string }>().username);
  // A aba fica na URL (?aba=antologias, ?aba=rascunhos): o link direto abre nela.
  // Sem o parâmetro (ou com um valor desconhecido), "Poemas".
  const abaDaUrl = useSearchParams().get("aba");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [meuId, setMeuId] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  // Eu bloqueei a pessoa: o perfil mostra só o cabeçalho, com o "Desbloquear".
  const [bloqueei, setBloqueei] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // replace, e não push: trocar de aba não enche o histórico do "voltar".
  function trocarAba(nova: Aba) {
    const caminho = `/u/${encodeURIComponent(username)}`;
    router.replace(nova === "poemas" ? caminho : `${caminho}?aba=${nova}`, { scroll: false });
  }

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    setPerfil(null);
    setEditando(false);
    setBloqueei(false);
    Promise.all([buscarPerfil(username), buscarEu()])
      .then(([p, eu]) => {
        setPerfil(p);
        setMeuId(eu.id);
        setErro(null);
      })
      .catch((e) => setErro(mensagemDeFalha(e, "não deu para carregar o perfil")));
  }, [username, router]);

  const buscarPoemas = useCallback(
    (cursor: string | null) => buscarPoemasDoPerfil(username, cursor),
    [username],
  );

  const buscarAntologias = useCallback(
    (offset: number) => listarAntologiasDe(username, offset),
    [username],
  );

  if (erro || !perfil)
    return (
      <CadernoFolhas
        key="carregando"
        folhas={[
          {
            chave: "carregando",
            rotulo: erro ?? "carregando o perfil",
            esquerda: erro ? (
              <div className={MARGEM_DA_PAGINA}>
                <p className="rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>
              </div>
            ) : (
              <div className="pt-4 lg:px-10 lg:pt-8">
                <EsqueletoDePerfil />
              </div>
            ),
          },
        ]}
      />
    );

  const proprio = perfil.id === meuId;
  const aba = lerAba(abaDaUrl, proprio);

  const pessoa = (
    <div className={`surgir ${MARGEM_DA_PAGINA}`}>
      {editando ? (
        <PerfilEdicao
          perfil={perfil}
          aoSalvar={(novo) => {
            setPerfil(novo);
            setEditando(false);
          }}
          aoCancelar={() => setEditando(false)}
        />
      ) : (
        <PerfilCabecalho
          perfil={perfil}
          proprio={proprio}
          aoMudar={setPerfil}
          aoEditar={() => setEditando(true)}
          aoMudarBloqueio={setBloqueei}
        />
      )}
    </div>
  );

  const conteudo = (
    <div className="pt-4 pb-6 lg:px-6 lg:pt-8">
      <Abas
        key={username}
        abas={proprio ? ABAS_DO_DONO : ABAS}
        atual={aba}
        aoMudar={trocarAba}
        rotulo="Conteúdo do perfil"
      >
        {(valor) =>
          valor === "rascunhos" ? (
            <ListaDeRascunhos />
          ) : valor === "poemas" ? (
            <ListaDePoemas
              key={username}
              buscar={buscarPoemas}
              textoDoFim="fim dos poemas"
              vazio={<p className="px-4 py-10 text-center text-tinta-suave">Nenhum poema ainda.</p>}
            />
          ) : (
            <AntologiaLista
              key={username}
              buscar={buscarAntologias}
              vazio={
                proprio ? (
                  <div className="px-4 py-10 text-center">
                    <p className="font-serifada text-lg">Nenhuma antologia ainda.</p>
                    <p className="mt-1 text-sm text-tinta-suave">
                      Reúna os poemas que você ama, como &ldquo;Poemas de chuva&rdquo; ou &ldquo;Para ler no
                      ônibus&rdquo;.
                    </p>
                    <Link
                      href="/antologias/nova"
                      className="realce mt-4 inline-flex min-h-11 items-center rounded-full border border-borda px-5 text-sm font-semibold"
                    >
                      Criar a primeira antologia
                    </Link>
                  </div>
                ) : (
                  <p className="px-4 py-10 text-center text-tinta-suave">Nenhuma antologia pública.</p>
                )
              }
            />
          )
        }
      </Abas>
    </div>
  );

  return (
    <CadernoFolhas
      key={username}
      anterior="voltar a quem escreve"
      proxima={`ver os poemas de ${perfil.name}`}
      folhas={[
        {
          chave: `perfil-${perfil.id}`,
          rotulo: perfil.name,
          rotuloDaDireita: `poemas e antologias de ${perfil.name}`,
          esquerda: pessoa,
          direita: bloqueei ? undefined : conteudo,
        },
      ]}
    />
  );
}
