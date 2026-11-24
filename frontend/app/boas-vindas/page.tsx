"use client";
// Onboarding depois do cadastro, em passos, todos opcionais: (1) que poesia você
// gosta (escolas e formas), (2) de onde você é (país e, no Brasil, estado), e
// depois a grade de quem seguir (/sugestoes). "continuar" salva as preferências
// (PUT /preferencias) e segue; "pular" segue sem salvar o passo. Também serve para
// ajustar as preferências depois (link na tela de sugestões).

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import {
  alternarNaLista,
  buscarOpcoesDePreferencias,
  buscarPreferencias,
  caminhoDoLogin,
  nomeDaForma,
  nomeDoPais,
  salvarPreferencias,
  temToken,
  type OpcoesDePreferencias,
  type Preferencias,
} from "@/lib/api";

const BRASIL = "BR";
const PASSOS = ["Que poesia você gosta?", "De onde você é?"] as const;

export default function BoasVindasPage() {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [opcoes, setOpcoes] = useState<OpcoesDePreferencias | null>(null);
  const [prefs, setPrefs] = useState<Preferencias>({ escolas: [], formas: [], pais: null, uf: null });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
    if (passo < PASSOS.length - 1) setPasso(passo + 1);
    else router.push("/sugestoes");
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
      <title>Boas-vindas · Verso</title>
      <CabecalhoPagina titulo="Boas-vindas" />
      <div className="space-y-5 p-4">
        <p className="text-sm text-tinta-suave tabular-nums">
          passo {passo + 1} de {PASSOS.length + 1} · tudo é opcional
        </p>
        <h2 className="text-xl font-bold">{PASSOS[passo]}</h2>

        {!opcoes && !erro && <p className="text-sm text-tinta-suave">carregando...</p>}

        {opcoes && passo === 0 && (
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

        {opcoes && passo === 1 && <Regiao opcoes={opcoes} prefs={prefs} aoMudar={setPrefs} />}

        {erro && <p className="rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={avancar}
            className="min-h-11 cursor-pointer rounded-full border border-borda px-5 text-sm font-bold hover:border-destaque hover:text-destaque"
          >
            pular
          </button>
          <button
            type="button"
            onClick={continuar}
            disabled={!opcoes || salvando}
            className="min-h-11 cursor-pointer rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
          >
            {salvando ? "salvando..." : "continuar"}
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
