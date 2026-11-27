"use client";
// Um campo de escolha com busca (combobox do WAI-ARIA com listbox), no lugar do
// <select> de todo o site (país e estado das Preferências, filtros do Acervo, forma
// e língua do Compositor): o campo mostra a opção escolhida; tocar nele (ou na
// seta) abre a lista, e o que se digita filtra, sem acento nem caixa ("sao" acha
// "São Paulo"), também pela sigla ("PB", "PT"); o "prefiro não dizer" fica sempre
// no topo. Com `comBusca={false}` (listas curtas) o campo é só de leitura: não se
// digita, e a lista abre ao clicar, e também com Enter, Espaço ou seta para baixo.
// Teclado: setas sobem e descem, Home e End vão às
// pontas, Enter e Tab escolhem a opção ativa (o Tab segue adiante), Esc fecha sem
// mudar nada. Fechar (também ao
// tocar fora) volta o campo ao valor escolhido. A lista abre para baixo ou, sem
// espaço, para cima, com a altura do espaço que sobra entre o campo, o teclado do
// celular e o recorte da página do livro. A parte pura (filtro e lado da lista)
// fica em lib/escolhaComBusca.ts.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { IconeAbrirLista } from "@/components/icones/IconeAbrirLista";
import { IconeMarcado } from "@/components/icones/IconeMarcado";
import { opcaoVizinha } from "@/lib/api";
import {
  achadas,
  ALTURA_MAXIMA_DA_LISTA,
  filtrarOpcoes,
  lugarDaLista,
  type OpcaoDeEscolha,
} from "@/lib/escolhaComBusca";

type Props = {
  rotulo: string;
  opcoes: OpcaoDeEscolha[];
  valor: string | null;
  aoEscolher: (valor: string | null) => void;
  // Como chamar uma e várias opções, no aviso do leitor de tela e na busca vazia.
  singular: string;
  plural: string;
  // false: sem digitar nem filtrar, só abre e escolhe (listas curtas).
  comBusca?: boolean;
};

// Folga entre a lista e a borda da tela (ou do teclado).
const FOLGA = 12;

export function EscolhaComBusca({ rotulo, opcoes, valor, aoEscolher, singular, plural, comBusca = true }: Props) {
  const idCampo = useId();
  const idLista = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [aberta, setAberta] = useState(false);
  // null: nada digitado desde que a lista abriu (mostra todas as opções).
  const [busca, setBusca] = useState<string | null>(null);
  const [ativa, setAtiva] = useState(-1);
  const [lugar, setLugar] = useState<ReturnType<typeof lugarDaLista>>({ lado: "abaixo", altura: ALTURA_MAXIMA_DA_LISTA });

  const indiceEscolhido = opcoes.findIndex((o) => o.valor === valor);
  const rotuloAtual = indiceEscolhido >= 0 ? opcoes[indiceEscolhido].rotulo : (valor ?? "");
  const visiveis = busca === null ? opcoes : filtrarOpcoes(opcoes, busca);
  const idDaOpcao = (i: number) => `${idLista}-${i}`;

  const fechar = useCallback(() => {
    setAberta(false);
    setBusca(null);
    setAtiva(-1);
  }, []);

  function abrir() {
    setAberta(true);
    setBusca(null);
    setAtiva(Math.max(indiceEscolhido, 0));
  }

  function escolher(opcao: OpcaoDeEscolha) {
    if (opcao.valor !== valor) aoEscolher(opcao.valor);
    fechar();
  }

  // O espaço livre acima e abaixo do campo: a tela visível (sem o teclado do
  // celular) recortada por cada ancestral que rola ou esconde o que transborda.
  const medir = useCallback(() => {
    const el = raiz.current;
    if (!el) return;
    const tela = window.visualViewport;
    let topo = tela ? tela.offsetTop : 0;
    let base = tela ? tela.offsetTop + tela.height : window.innerHeight;
    for (let pai = el.parentElement; pai; pai = pai.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(pai).overflowY)) {
        const r = pai.getBoundingClientRect();
        topo = Math.max(topo, r.top);
        base = Math.min(base, r.bottom);
      }
    }
    const r = el.getBoundingClientRect();
    setLugar(lugarDaLista(base - r.bottom - FOLGA, r.top - topo - FOLGA));
  }, []);

  useLayoutEffect(() => {
    if (!aberta) return;
    medir();
    const tela = window.visualViewport;
    window.addEventListener("resize", medir);
    document.addEventListener("scroll", medir, true);
    tela?.addEventListener("resize", medir);
    tela?.addEventListener("scroll", medir);
    return () => {
      window.removeEventListener("resize", medir);
      document.removeEventListener("scroll", medir, true);
      tela?.removeEventListener("resize", medir);
      tela?.removeEventListener("scroll", medir);
    };
  }, [aberta, medir]);

  // Tocar fora fecha (o blur do campo já cobre o clique fora no computador).
  useEffect(() => {
    if (!aberta) return;
    const tocar = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) fechar();
    };
    document.addEventListener("pointerdown", tocar);
    return () => document.removeEventListener("pointerdown", tocar);
  }, [aberta, fechar]);

  // A opção ativa fica à vista dentro da lista, sem rolar a página.
  useEffect(() => {
    const lista = caixa.current;
    const opcao = aberta && ativa >= 0 ? document.getElementById(`${idLista}-${ativa}`) : null;
    if (!lista || !opcao) return;
    if (opcao.offsetTop < lista.scrollTop) lista.scrollTop = opcao.offsetTop;
    else if (opcao.offsetTop + opcao.offsetHeight > lista.scrollTop + lista.clientHeight)
      lista.scrollTop = opcao.offsetTop + opcao.offsetHeight - lista.clientHeight;
  }, [aberta, ativa, lugar, idLista]);

  function teclar(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = visiveis.length;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (!aberta) abrir();
        else if (!e.altKey) setAtiva((i) => opcaoVizinha(i, total, e.key === "ArrowDown" ? 1 : -1));
        break;
      case "Home":
      case "End":
        if (!aberta || total === 0) return;
        e.preventDefault();
        setAtiva(e.key === "Home" ? 0 : total - 1);
        break;
      case " ":
        // Sem busca o campo não recebe texto: o Espaço abre a lista, como o Enter.
        if (comBusca) return;
        e.preventDefault();
        if (!aberta) abrir();
        else if (ativa >= 0 && visiveis[ativa]) escolher(visiveis[ativa]);
        break;
      case "Enter":
        if (!aberta) {
          if (comBusca) return;
          e.preventDefault();
          abrir();
          return;
        }
        e.preventDefault();
        if (ativa >= 0 && visiveis[ativa]) escolher(visiveis[ativa]);
        break;
      case "Escape":
        if (!aberta) return;
        e.preventDefault();
        fechar();
        break;
      case "Tab":
        // Com uma opção ativa, o Tab a escolhe e o foco segue adiante.
        if (aberta && ativa >= 0 && visiveis[ativa]) escolher(visiveis[ativa]);
        else fechar();
        break;
    }
  }

  const termo = busca?.trim() ?? "";
  const quantas = achadas(visiveis);
  const nenhuma = termo !== "" && quantas === 0;
  const aviso =
    !aberta || busca === null
      ? ""
      : nenhuma
        ? `nenhum ${singular}`
        : `${quantas} ${quantas === 1 ? singular : plural}`;

  return (
    <div ref={raiz} className="relative">
      <label htmlFor={idCampo} className="block text-sm">
        {rotulo}
      </label>
      <div className="relative mt-1">
        <input
          ref={campo}
          id={idCampo}
          type="text"
          role="combobox"
          aria-expanded={aberta}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={aberta && ativa >= 0 ? idDaOpcao(ativa) : undefined}
          value={busca ?? rotuloAtual}
          onChange={(e) => {
            const texto = e.target.value;
            setBusca(texto);
            setAberta(true);
            // A primeira opção achada fica ativa ("prefiro não dizer", no topo, não conta).
            const novas = filtrarOpcoes(opcoes, texto);
            setAtiva(texto.trim() ? novas.findIndex((o) => o.valor !== null) : -1);
          }}
          readOnly={!comBusca}
          onFocus={(e) => comBusca && e.target.select()}
          onClick={() => !aberta && abrir()}
          onBlur={fechar}
          onKeyDown={teclar}
          placeholder={comBusca ? `procurar ${singular}` : undefined}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className={`min-h-11 w-full rounded-xl border border-borda bg-papel-alto pr-11 pl-3 text-base font-normal text-tinta transition-colors duration-150 placeholder:text-tinta-suave focus:border-destaque focus:outline-none sm:text-[0.9375rem] ${
            comBusca ? "" : "cursor-pointer"
          }`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`lista de ${plural}`}
          aria-expanded={aberta}
          aria-controls={idLista}
          // Não tira o foco do campo (senão o blur fecharia a lista antes do clique).
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (aberta) return fechar();
            abrir();
            campo.current?.focus();
          }}
          className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-xl text-tinta-suave transition-colors duration-150 hover:text-destaque"
        >
          <IconeAbrirLista
            className={`h-5 w-5 transition-transform duration-200 ease-out motion-reduce:transition-none ${aberta ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <p role="status" className="sr-only">
        {aviso}
      </p>

      <div
        ref={caixa}
        hidden={!aberta}
        onMouseDown={(e) => e.preventDefault()}
        style={{ maxHeight: lugar.altura }}
        className={`absolute inset-x-0 z-30 overflow-y-auto overscroll-contain rounded-xl border border-borda bg-papel-alto py-1 shadow-[0_4px_24px_-6px_rgb(0_0_0/0.2)] [scrollbar-width:thin] ${
          lugar.lado === "abaixo" ? "top-full mt-1" : "bottom-full mb-1"
        }`}
      >
        <ul id={idLista} role="listbox" aria-label={rotulo}>
          {visiveis.map((opcao, i) => {
            const escolhida = opcao.valor === valor;
            return (
              <li
                key={opcao.valor ?? ""}
                id={idDaOpcao(i)}
                role="option"
                aria-selected={escolhida}
                onClick={() => escolher(opcao)}
                className={`realce flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[0.9375rem] ${
                  i === ativa ? "bg-tinta/[0.07]" : ""
                } ${opcao.valor === null ? "text-tinta-suave" : "text-tinta"} ${escolhida ? "font-semibold" : ""}`}
              >
                <span className="min-w-0 break-words">{opcao.rotulo}</span>
                {escolhida && <IconeMarcado className="h-[1.125rem] w-[1.125rem] shrink-0 text-destaque" />}
              </li>
            );
          })}
        </ul>
        {nenhuma && (
          <p className="px-3 py-3 text-sm text-tinta-suave">
            Nenhum {singular} com “{termo}”.
          </p>
        )}
      </div>
    </div>
  );
}
