"use client";
// Compositor de poema: título opcional, corpo e forma. Com `citarId`, vira
// citação (POST /posts com repost_de_id) e mostra o original embaixo; com
// `citarRengaId`, cita a renga (renga_citada_id, #171), sem rascunho (o rascunho
// só guarda a citação de um poema). Com
// `rascunhoId`, abre o rascunho (de poema ou de citação); "salvar rascunho"
// guarda sem publicar. O corpo é o editor de poemas (negrito, itálico,
// sublinhado e tachado, #137); o texto guardado é o de lib/marcas.ts.
// `aoMudar` conta à página o poema em andamento, para o seletor de formato
// (FormatoDeEscrita) levá-lo à renga ou guardá-lo antes da antologia.
// `dispor` reparte o compositor entre as páginas do caderno: a escrita (título e
// corpo, dentro do <form>) e a ficha (oficina, forma, língua, o original citado
// e os botões, ligados ao form pelo atributo `form`).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { AvisoDeErro } from "@/components/AvisoDeErro";
import { EditorDePoema } from "@/components/EditorDePoema";
import { OficinaMarcas, OficinaPainel, useOficina } from "@/components/OficinaMarcas";
import { IconePena } from "@/components/icones/IconePena";
import { PoemaCard } from "@/components/PoemaCard";
import { RengaCard } from "@/components/RengaCard";
import {
  buscarPoema,
  buscarRascunho,
  buscarRenga,
  criarRascunho,
  editarRascunho,
  mensagemDeFalha,
  nomeDoIdioma,
  publicarPoema,
  publicarRascunho,
  type NovoRascunho,
  type Post,
  type RengaDetalhe,
} from "@/lib/api";
import { FORMAS, IDIOMAS_DO_COMPOSITOR, nomeDaForma } from "@/lib/vocabulario";

// As fases do botão "publicar" (data-fase, globals.css) e quanto cada uma dura
// no mínimo: o círculo, a pena que entra, a escrita e a pena que se desfaz em partículas.
type FaseDaPena = "morph" | "entrada" | "escrevendo" | "explodindo";
const FASES_DA_PENA: [FaseDaPena, number][] = [
  ["morph", 350],
  ["entrada", 300],
  ["escrevendo", 750],
  ["explodindo", 1010],
];

// Para onde cada partícula vai (px, a partir do fim do voo): um leque irregular.
// e o atraso (ms) de cada uma, para não saírem como um bloco só.
const PARTICULAS: [number, number, number][] = [
  [36, 0, 0], [39, -21, 40], [14, -26, 20], [0, -40, 60], [-18, -29, 10], [-38, -22, 50],
  [-30, 0, 30], [-35, 19, 0], [-16, 30, 45], [0, 44, 15], [14, 24, 55], [34, 18, 25],
];

function esperar(ms: number) {
  return new Promise<void>((ok) => setTimeout(ok, ms));
}

// Valor do <select> para "outra" língua: vai como null (desconhecida).
const OUTRA = "";

// O poema em andamento: os dados de um rascunho e o rascunho já salvo, se houver.
export type PoemaEmAndamento = { dados: NovoRascunho; rascunhoId: number | null };

type Props = {
  citarId: number | null;
  citarRengaId?: number | null;
  // Na citação de versos (#71), o corpo já começa com eles.
  textoInicial?: string;
  rascunhoId?: number | null;
  // Chamado quando o rascunho aberto é de citação (a página troca o título).
  aoAbrirCitacao?: () => void;
  aoMudar?: (poema: PoemaEmAndamento) => void;
  dispor?: (partes: { escrita: ReactNode; ficha: ReactNode }) => ReactNode;
};

export function Compositor({ citarId, citarRengaId = null, textoInicial = "", rascunhoId = null, aoAbrirCitacao, aoMudar, dispor }: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState(textoInicial);
  const [forma, setForma] = useState("");
  const [idioma, setIdioma] = useState<string>(IDIOMAS_DO_COMPOSITOR[0]);
  const [original, setOriginal] = useState<Post | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [fase, setFase] = useState<FaseDaPena | null>(null);
  // O rascunho aberto ou o criado no primeiro "salvar rascunho" (null: nenhum).
  const [rascunho, setRascunho] = useState<number | null>(rascunhoId);
  const [salvo, setSalvo] = useState(false);
  // O poema citado: o da URL ou o do rascunho aberto. `citadoRemovido`: o
  // original foi apagado enquanto a citação era rascunho.
  const [citado, setCitado] = useState<number | null>(citarId);
  const [citadoRemovido, setCitadoRemovido] = useState(false);
  const [rengaCitada, setRengaCitada] = useState<RengaDetalhe | null>(null);
  const citaRenga = citarRengaId !== null;
  const citacao = citado !== null || citadoRemovido || citaRenga;
  const corpo = useRef<HTMLElement | null>(null);
  const id = useId();
  const oficina = useOficina(texto, forma);

  useEffect(() => {
    if (citado === null) return;
    buscarPoema(citado)
      .then(setOriginal)
      .catch((e) => setErro(mensagemDeFalha(e, "não achei o poema citado")));
  }, [citado]);

  useEffect(() => {
    if (citarRengaId === null) return;
    buscarRenga(citarRengaId)
      .then(setRengaCitada)
      .catch((e) => setErro(mensagemDeFalha(e, "não achei a renga citada")));
  }, [citarRengaId]);

  useEffect(() => {
    if (rascunhoId === null) return;
    buscarRascunho(rascunhoId)
      .then((r) => {
        setTitulo(r.titulo ?? "");
        setTexto(r.texto);
        setForma(r.forma ?? "");
        setIdioma(r.idioma ?? OUTRA);
        setCitado(r.repost_de_id);
        setCitadoRemovido(r.repost_removido);
        if (r.repost_de_id !== null || r.repost_removido) aoAbrirCitacao?.();
      })
      .catch((e) => setErro(mensagemDeFalha(e, "não achei o rascunho")));
  }, [rascunhoId]);

  useEffect(() => {
    aoMudar?.({ dados: dadosDoRascunho(), rascunhoId: rascunho });
  }, [titulo, texto, forma, idioma, rascunho]);

  function dadosDoRascunho() {
    return {
      titulo: titulo.trim() ? titulo : null,
      texto,
      forma: forma || null,
      idioma: idioma === OUTRA ? null : idioma,
    };
  }

  // Guarda sem publicar; o rascunho fica só para o autor (aba Rascunhos do perfil).
  async function salvarRascunho() {
    if (!texto.trim()) {
      setErro("o poema não pode ficar vazio");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const salvoAgora =
        rascunho === null
          ? await criarRascunho({ ...dadosDoRascunho(), ...(citado !== null && { repost_de_id: citado }) })
          : await editarRascunho(rascunho, dadosDoRascunho());
      setRascunho(salvoAgora.id);
      setSalvo(true);
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para salvar o rascunho"));
    } finally {
      setEnviando(false);
    }
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) {
      setErro("o poema não pode ficar vazio");
      return;
    }
    setEnviando(true);
    setErro(null);
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let falhou = false;
    // A coreografia da pena roda junto com a requisição; se a resposta demora, a
    // pena segue escrevendo (CSS) até ela chegar: a decolagem espera a resposta.
    // Só se navega quando as duas acabam.
    const envio = enviarPoema();
    envio.catch(() => {
      falhou = true;
    });
    const coreografia = (async () => {
      if (reduzido) return;
      for (const [proxima, ms] of FASES_DA_PENA) {
        if (proxima === "explodindo") await envio.catch(() => undefined);
        if (falhou) return;
        setFase(proxima);
        await esperar(ms);
      }
    })();
    try {
      const { id: idNovo } = await envio;
      await coreografia;
      router.push(`/poema/${idNovo}`);
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para publicar"));
      setFase(null);
      setEnviando(false);
    }
  }

  // Publica o rascunho aberto ou cria o poema; devolve o que a tela precisa.
  async function enviarPoema(): Promise<{ id: number }> {
    if (rascunho !== null) {
      await editarRascunho(rascunho, dadosDoRascunho());
      return publicarRascunho(rascunho);
    }
    return publicarPoema({
      titulo: titulo.trim() ? titulo : null,
      texto,
      forma: forma || null,
      idioma: idioma === OUTRA ? null : idioma,
      ...(citado !== null && { repost_de_id: citado }),
      ...(citarRengaId !== null && { renga_citada_id: citarRengaId }),
    });
  }

  const campo =
    "w-full rounded-xl border border-borda bg-papel-alto px-3 py-2 text-tinta transition-colors duration-150 focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none";
  const escrita = (
    <form id={`${id}-form`} onSubmit={publicar} className="space-y-4">
      <label className="block text-sm">
        título (opcional)
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={200}
          className={`${campo} poema-titulo mt-1`}
        />
      </label>

      <div>
        <EditorDePoema
          valor={texto}
          aoMudar={(novo) => {
            setTexto(novo);
            setSalvo(false);
          }}
          rotulo={citaRenga ? "seu comentário sobre a renga" : citacao ? "seu comentário sobre o poema" : "poema"}
          idRotulo={`${id}-rotulo`}
          idAjuda={`${id}-ajuda`}
          classe={campo}
          refEditavel={corpo}
          aoLado={<OficinaMarcas oficina={oficina} texto={texto} campo={corpo} />}
        />
        <span id={`${id}-ajuda`} className="mt-1 block text-xs text-tinta-suave">
          Quebras de linha e recuos ficam como você escreveu. Tab insere um recuo; Esc e depois
          Tab sai do campo. Para formatar, selecione o trecho.
        </span>
      </div>
    </form>
  );
  const ficha = (
    <div className="space-y-4">
      <OficinaPainel oficina={oficina} />

      <label className="block text-sm">
        forma (opcional)
        <select value={forma} onChange={(e) => setForma(e.target.value)} className={`${campo} mt-1`}>
          <option value="">sem forma</option>
          {FORMAS.map((f) => (
            <option key={f} value={f}>
              {nomeDaForma(f)}
            </option>
          ))}
        </select>
      </label>

      {/* Discreto: quase todo poema é em português, o padrão. */}
      <label className="flex items-center gap-2 text-xs text-tinta-suave">
        língua do poema
        <select
          value={idioma}
          onChange={(e) => setIdioma(e.target.value)}
          className="min-h-11 cursor-pointer rounded-lg border border-borda bg-papel-alto px-2 text-xs text-tinta focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none"
        >
          {IDIOMAS_DO_COMPOSITOR.map((codigo) => (
            <option key={codigo} value={codigo}>
              {nomeDoIdioma(codigo)}
            </option>
          ))}
          <option value={OUTRA}>outra</option>
        </select>
      </label>

      {original && <PoemaCard post={original} aninhado semCritica />}
      {rengaCitada && <RengaCard renga={rengaCitada} aninhado />}
      {citadoRemovido && (
        <p className="rounded-2xl border border-dashed border-borda p-4 text-sm text-tinta-suave italic">
          poema removido pelo autor
        </p>
      )}

      {erro && <AvisoDeErro cantos="pequenos">{erro}</AvisoDeErro>}

      <button
        type="submit"
        form={`${id}-form`}
        disabled={enviando}
        data-fase={fase ?? undefined}
        className={`publicar-pena relative min-h-11 cursor-pointer rounded-full px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait ${fase ? "" : "disabled:opacity-50"}`}
      >
        <span aria-hidden="true" className="publicar-fundo absolute inset-0 rounded-full bg-destaque" />
        <span className="publicar-rotulo relative">
          {enviando ? "publicando..." : citacao ? "publicar citação" : "publicar"}
        </span>
        <span aria-hidden="true" className="publicar-palco text-destaque">
          <svg viewBox="-40 -12 80 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="publicar-tinta">
            <path className="publicar-traco" pathLength={1} d="M-35 8C-30 0 -26 0 -26 7S-20 15 -16 8S-9 1 -5 8S2 15 7 8S14 2 19 8S27 13 35 6" />
          </svg>
          {PARTICULAS.map(([dx, dy, atraso]) => (
            <span
              key={`${dx},${dy}`}
              className="publicar-particula"
              style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--atraso": `${atraso}ms` } as React.CSSProperties}
            />
          ))}
          <span className="publicar-pena-andar">
            <span className="publicar-pena-balanca">
              <span className="publicar-pena-inclina">
                <IconePena className="h-7 w-7" />
              </span>
            </span>
          </span>
        </span>
      </button>
      {!citaRenga && (
        <button
          type="button"
          onClick={salvarRascunho}
          disabled={enviando}
          className="ml-3 min-h-11 cursor-pointer rounded-full border border-borda px-5 text-sm font-bold transition-colors duration-150 hover:border-destaque disabled:cursor-wait disabled:opacity-50"
        >
          salvar rascunho
        </button>
      )}
      {salvo && (
        <p role="status" className="text-sm text-tinta-suave">
          rascunho salvo. Só você vê; ele fica nos <Link href="/rascunhos" className="underline">Rascunhos</Link> do seu perfil.
        </p>
      )}
    </div>
  );
  if (dispor) return dispor({ escrita, ficha });
  return (
    <div className="space-y-4">
      {escrita}
      {ficha}
    </div>
  );
}
