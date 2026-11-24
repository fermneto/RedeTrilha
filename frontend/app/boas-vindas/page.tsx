"use client";
// Onboarding depois do cadastro, em passos, todos opcionais: (1) que poesia você
// gosta (escolas e formas), (2) de onde você é (país e, no Brasil, estado), e
// depois a grade de quem seguir (/sugestoes). "continuar" salva as preferências
// (PUT /preferencias) e segue; "pular" segue sem salvar o passo. Também serve para
// ajustar as preferências depois, com ?voltar=<página>: por "Preferências" no menu
// da conta (os dois passos) ou pelo link na tela de sugestões (só os gostos, com
// ?so=gostos). Nesse modo "pular" vira "cancelar" (volta sem salvar o passo) e o
// fim volta para a página de onde a pessoa veio.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import {
  alternarNaLista,
  buscarOpcoesDePreferencias,
  buscarPreferencias,
  caminhoDoLogin,
  destinoSeguro,
  passosDasPreferencias,
  nomeDaForma,
  nomeDoPais,
  salvarPreferencias,
  temToken,
  type OpcoesDePreferencias,
  type PassoDasPreferencias,
  type Preferencias,
} from "@/lib/api";

const BRASIL = "BR";
const TITULOS: Record<PassoDasPreferencias, string> = {
  gostos: "Que poesia você gosta?",
  regiao: "De onde você é?",
};

// useSearchParams precisa de Suspense no build estático do Next.
export default function BoasVindasPage() {
  return (
    <Suspense>
      <BoasVindas />
    </Suspense>
  );
}

function BoasVindas() {
  const router = useRouter();
  const params = useSearchParams();
  const voltar = params.get("voltar");
  const passos = passosDasPreferencias(params.get("so"));
  // Ajuste depois do cadastro: sem o passo de quem seguir, e o fim volta à página de antes.
  const ajuste = voltar !== null;
  const destino = ajuste ? destinoSeguro(voltar) : "/sugestoes";
  const totalDePassos = ajuste ? passos.length : passos.length + 1;
  const [indice, setIndice] = useState(0);
  const passo = passos[indice];
  const [opcoes, setOpcoes] = useState<OpcoesDePreferencias | null>(null);
  const [prefs, setPrefs] = useState<Preferencias>({ escolas: [], formas: [], pais: null, uf: null });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ultimo = indice === passos.length - 1;

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    Promise.all([buscarOpcoesDePreferencias(), buscarPreferencias()])
      .then(([o, p]) => {
        setOpcoes(o);
        setPrefs(p);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "não deu para carregar as opções"));
  }, [router]);

  function avancar() {
    if (!ultimo) setIndice(indice + 1);
    else router.push(destino);
  }

  async function continuar() {
    setSalvando(true);
    setErro(null);
    try {
      setPrefs(await salvarPreferencias(prefs));
      avancar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu para salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <title>{`${ajuste ? "Preferências" : "Boas-vindas"} · Verso`}</title>
      <CabecalhoPagina titulo={ajuste ? "Preferências" : "Boas-vindas"} />
      <div className="space-y-5 p-4">
        <p className="text-sm text-tinta-suave tabular-nums">
          {totalDePassos > 1 && `passo ${indice + 1} de ${totalDePassos} · `}tudo é opcional
        </p>
        <h2 className="text-xl font-bold">{TITULOS[passo]}</h2>

        {!opcoes && !erro && <p className="text-sm text-tinta-suave">carregando...</p>}

        {opcoes && passo === "gostos" && (
          <>
            <Chips
              titulo="Escolas e períodos"
              opcoes={opcoes.escolas}
              marcadas={prefs.escolas}
              aoAlternar={(c) => setPrefs({ ...prefs, escolas: alternarNaLista(prefs.escolas, c) })}
            />
            <Chips
              titulo="Formas"
              opcoes={opcoes.formas.map((f) => ({ codigo: f, rotulo: nomeDaForma(f) }))}
              marcadas={prefs.formas}
              aoAlternar={(c) => setPrefs({ ...prefs, formas: alternarNaLista(prefs.formas, c) })}
            />
          </>
        )}

        {opcoes && passo === "regiao" && <Regiao opcoes={opcoes} prefs={prefs} aoMudar={setPrefs} />}

        {erro && <p className="rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={ajuste ? () => router.push(destino) : avancar}
            className="min-h-11 cursor-pointer rounded-full border border-borda px-5 text-sm font-bold hover:border-destaque hover:text-destaque"
          >
            {ajuste ? "cancelar" : "pular"}
          </button>
          <button
            type="button"
            onClick={continuar}
            disabled={!opcoes || salvando}
            className="min-h-11 cursor-pointer rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
          >
            {salvando ? "salvando..." : ajuste && ultimo ? "salvar" : "continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Chips({
  titulo,
  opcoes,
  marcadas,
  aoAlternar,
}: {
  titulo: string;
  opcoes: { codigo: string; rotulo: string }[];
  marcadas: string[];
  aoAlternar: (codigo: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{titulo}</legend>
      <ul className="flex flex-wrap gap-2">
        {opcoes.map(({ codigo, rotulo }) => {
          const marcada = marcadas.includes(codigo);
          return (
            <li key={codigo}>
              <button
                type="button"
                aria-pressed={marcada}
                onClick={() => aoAlternar(codigo)}
                className={`min-h-11 cursor-pointer rounded-full border px-4 text-sm transition-colors duration-150 ${
                  marcada
                    ? "border-destaque bg-destaque/10 font-semibold text-destaque"
                    : "border-borda text-tinta hover:border-destaque"
                }`}
              >
                {rotulo}
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function Regiao({
  opcoes,
  prefs,
  aoMudar,
}: {
  opcoes: OpcoesDePreferencias;
  prefs: Preferencias;
  aoMudar: (p: Preferencias) => void;
}) {
  // Brasil primeiro; o resto em ordem alfabética do nome em português.
  const paises = opcoes.paises
    .filter((c) => c !== BRASIL)
    .map((codigo) => ({ codigo, nome: nomeDoPais(codigo) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const campo =
    "mt-1 min-h-11 w-full rounded-xl border border-borda bg-papel-alto px-3 font-normal text-tinta focus:border-destaque focus:outline-none";

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold">
        país
        <select
          value={prefs.pais ?? ""}
          onChange={(e) => {
            const pais = e.target.value || null;
            aoMudar({ ...prefs, pais, uf: pais === BRASIL ? prefs.uf : null });
          }}
          className={campo}
        >
          <option value="">prefiro não dizer</option>
          <option value={BRASIL}>{nomeDoPais(BRASIL)}</option>
          {paises.map(({ codigo, nome }) => (
            <option key={codigo} value={codigo}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      {prefs.pais === BRASIL && (
        <label className="block text-sm font-semibold">
          estado
          <select
            value={prefs.uf ?? ""}
            onChange={(e) => aoMudar({ ...prefs, uf: e.target.value || null })}
            className={campo}
          >
            <option value="">prefiro não dizer</option>
            {opcoes.ufs.map(({ codigo, rotulo }) => (
              <option key={codigo} value={codigo}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
