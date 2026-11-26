"use client";
// Onboarding depois do cadastro, em passos, todos opcionais: (1) que poesia você
// gosta (escolas e formas), (2) de onde você é (país e, no Brasil, estado), e
// depois a grade de quem seguir (/boas-vindas/quem-seguir). O onboarding é em
// tela cheia (components/TelaDeBoasVindas.tsx), sem a navegação do site.
// "continuar" salva as preferências (PUT /preferencias) e segue; "pular" segue sem
// salvar o passo; "voltar" volta ao passo anterior sem perder o que foi marcado
// (?passo=regiao abre direto na região, pelo "voltar" da grade). Também serve para
// ajustar as preferências depois, com ?voltar=<página>: em /preferencias (a mesma
// página, dentro do layout do site), por "Preferências" no menu da conta (os dois
// passos) ou pelo link da /sugestoes (só os gostos, com ?so=gostos); e em
// /boas-vindas?so=gostos, em tela cheia, pelo link da grade do onboarding. Nesse modo nada é salvo até o "salvar" do último passo ("continuar"
// só avança), "pular" vira "cancelar" (descarta tudo e usa o voltar do navegador,
// ou vai ao perfil se a página foi aberta direto) e o fim volta para ?voltar=.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { EsqueletoDasOpcoes } from "@/components/Esqueleto";
import {
  AberturaDoPasso,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  PassosNoSite,
  TelaDeBoasVindas,
} from "@/components/TelaDeBoasVindas";
import {
  abertaDireto,
  alternarNaLista,
  buscarEu,
  buscarOpcoesDePreferencias,
  buscarPreferencias,
  caminhoDoLogin,
  destinoSeguro,
  ehTelaDeBoasVindas,
  mensagemDeFalha,
  nomeDaForma,
  nomeDoPais,
  passoInicial,
  passosDasPreferencias,
  QUEM_SEGUIR_NO_ONBOARDING,
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
  // /boas-vindas em tela cheia; /preferencias dentro do layout do site.
  const telaCheia = ehTelaDeBoasVindas(usePathname());
  const voltar = params.get("voltar");
  const passos = passosDasPreferencias(params.get("so"));
  // Ajuste depois do cadastro: sem o passo de quem seguir, e o fim volta à página de antes.
  const ajuste = voltar !== null;
  const destino = ajuste ? destinoSeguro(voltar) : QUEM_SEGUIR_NO_ONBOARDING;
  const totalDePassos = ajuste ? passos.length : passos.length + 1;
  const [indice, setIndice] = useState(() => passoInicial(passos, params.get("passo")));
  const passo = passos[indice];
  const [opcoes, setOpcoes] = useState<OpcoesDePreferencias | null>(null);
  const [prefs, setPrefs] = useState<Preferencias>({
    escolas: [],
    formas: [],
    pais: null,
    uf: null,
    mostrar_lugar: true,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ultimo = indice === passos.length - 1;
  const [nome, setNome] = useState<string | null>(null);
  const refTitulo = useRef<HTMLHeadingElement>(null);
  const primeiraVez = useRef(true);

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
      .catch((e) => setErro(mensagemDeFalha(e, "não deu para carregar as opções")));
    // Só para a saudação do primeiro passo; sem o nome, ela fica sem ele.
    buscarEu()
      .then((eu) => setNome(eu.name))
      .catch(() => setNome(null));
  }, [router]);

  // O passo muda na mesma página: leva o foco à nova pergunta (não no primeiro).
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    refTitulo.current?.focus();
    window.scrollTo({ top: 0 });
  }, [indice]);

  function avancar() {
    if (!ultimo) setIndice(indice + 1);
    else router.push(destino);
  }

  function cancelar() {
    const [carregamento] = performance.getEntriesByType("navigation");
    if (!abertaDireto(carregamento?.name)) {
      router.back();
      return;
    }
    buscarEu()
      .then((eu) => router.push(`/u/${encodeURIComponent(eu.username)}`))
      .catch(() => router.push("/"));
  }

  async function continuar() {
    // No ajuste, os passos do meio só guardam o estado na tela; o último salva tudo.
    if (ajuste && !ultimo) {
      avancar();
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      setPrefs(await salvarPreferencias(prefs));
      avancar();
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para salvar"));
    } finally {
      setSalvando(false);
    }
  }

  const textoDoBotao = salvando ? "salvando..." : ajuste && ultimo ? "salvar" : "continuar";

  const Moldura = telaCheia ? TelaDeBoasVindas : PassosNoSite;

  return (
    <Moldura
      passo={indice + 1}
      total={totalDePassos}
      acoes={
        <>
          {indice > 0 ? (
            <button type="button" onClick={() => setIndice(indice - 1)} className={`${BOTAO_SECUNDARIO} -ml-4`}>
              voltar
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1 sm:gap-3">
            <button type="button" onClick={ajuste ? cancelar : avancar} className={BOTAO_SECUNDARIO}>
              {ajuste ? "cancelar" : "pular"}
            </button>
            <button type="button" onClick={continuar} disabled={!opcoes || salvando} className={BOTAO_PRIMARIO}>
              {textoDoBotao}
            </button>
          </div>
        </>
      }
    >
      <title>{`${ajuste ? "Preferências" : "Boas-vindas"} · Verso`}</title>
      <AberturaDoPasso titulo={TITULOS[passo]} refTitulo={refTitulo} compacta={!telaCheia}>
        {abertura(passo, ajuste, nome)}
      </AberturaDoPasso>

      {!opcoes && !erro && <EsqueletoDasOpcoes passo={passo} />}

      {opcoes && passo === "gostos" && (
        <div className="space-y-10">
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
        </div>
      )}

      {opcoes && passo === "regiao" && <Regiao opcoes={opcoes} prefs={prefs} aoMudar={setPrefs} />}

      {erro && (
        <p role="alert" className="mt-8 rounded-xl border border-destaque p-3 text-sm text-destaque">
          {erro}
        </p>
      )}
    </Moldura>
  );
}

// O texto sob a pergunta: no cadastro, a saudação (no primeiro passo) e o porquê;
// nas preferências, o aviso de que nada muda até salvar.
function abertura(passo: PassoDasPreferencias, ajuste: boolean, nome: string | null): string {
  if (ajuste) return "Nada muda até você salvar. As sugestões de quem seguir se reajustam ao que você marcar.";
  if (passo === "regiao") return "O país e, no Brasil, o estado aproximam você de quem escreve perto. Tudo é opcional.";
  const saudacao = nome ? `Boas-vindas ao Verso, ${nome}.` : "Boas-vindas ao Verso.";
  return `${saudacao} Marque as escolas e as formas que você lê com gosto: as sugestões de quem seguir partem daqui. Tudo é opcional.`;
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
      <legend className="mb-3 flex w-full items-baseline gap-1.5 border-b border-borda pb-2 text-sm font-semibold">
        {titulo}
        {marcadas.length > 0 && (
          <span className="font-normal text-tinta-suave tabular-nums">
            · {marcadas.length} {marcadas.length === 1 ? "marcada" : "marcadas"}
          </span>
        )}
      </legend>
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
    <div className="space-y-6">
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
      {/* Os gostos são públicos no perfil; o lugar pode ficar só para a pessoa. */}
      {prefs.pais && (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={prefs.mostrar_lugar}
            onChange={(e) => aoMudar({ ...prefs, mostrar_lugar: e.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-destaque)]"
          />
          <span>
            <span className="font-semibold">mostrar meu lugar no perfil</span>
            <span className="block text-tinta-suave">
              Desligado, o país e o estado não aparecem nos seus gostos para quem visita o perfil.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
