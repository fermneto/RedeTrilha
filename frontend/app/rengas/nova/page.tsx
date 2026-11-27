"use client";
// Nova renga: título, a primeira estrofe e as configurações (modo, limite de
// estrofes e, no modo convidados, os usernames de quem pode escrever). Chega-se
// pelo seletor de formato do compositor (FormatoDeEscrita), no "Escrever"; se a
// pessoa já tinha começado um poema, ele chega como a 1ª estrofe e o título dele
// como o da renga, os dois editáveis (lib/trocaDeFormato.ts).

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { AvisoDeErro } from "@/components/AvisoDeErro";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EditorDePoema } from "@/components/EditorDePoema";
import { FormatoDeEscrita } from "@/components/FormatoDeEscrita";
import {
  caminhoDoLogin,
  criarRenga,
  ErroDaApi,
  lerUsernames,
  mensagemDeFalha,
  temToken,
  type ModoDaRenga,
} from "@/lib/api";
import { LIMITES } from "@/lib/vocabulario";
import { lerPoemaParaRenga } from "@/lib/trocaDeFormato";

const MODOS: { valor: ModoDaRenga; rotulo: string; explicacao: string }[] = [
  { valor: "aberta", rotulo: "Aberta", explicacao: "qualquer pessoa logada escreve a próxima estrofe" },
  { valor: "convidados", rotulo: "Só convidados", explicacao: "só você e quem você convidar" },
];

const campo =
  "w-full rounded-xl border border-borda bg-papel px-3 py-2 text-tinta transition-colors duration-150 focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none";

export default function NovaRengaPage() {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [estrofe, setEstrofe] = useState("");
  const [modo, setModo] = useState<ModoDaRenga>("aberta");
  const [limite, setLimite] = useState(LIMITES.renga_limite_padrao);
  const [convidados, setConvidados] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const id = useId();

  useEffect(() => {
    if (!temToken()) router.replace(caminhoDoLogin());
  }, [router]);

  // O poema trazido do compositor, lido uma vez (e apagado) ao abrir a página.
  useEffect(() => {
    const poema = lerPoemaParaRenga();
    if (!poema) return;
    setEstrofe(poema.estrofe);
    if (poema.titulo) setTitulo(poema.titulo);
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const faltando: Record<string, string> = {};
    if (!titulo.trim()) faltando.titulo = "a renga precisa de um título";
    if (!estrofe.trim()) faltando.primeira_estrofe = "a estrofe não pode ficar vazia";
    if (Object.keys(faltando).length > 0) {
      setCampos(faltando);
      return;
    }
    setEnviando(true);
    setErro(null);
    setCampos({});
    try {
      // A estrofe vai como foi escrita: quebras e recuos fazem parte do poema.
      const renga = await criarRenga({
        titulo,
        primeira_estrofe: estrofe,
        modo,
        limite,
        convidados: modo === "convidados" ? lerUsernames(convidados) : [],
      });
      router.push(`/rengas/${renga.id}`);
    } catch (err) {
      if (err instanceof ErroDaApi && Object.keys(err.campos).length > 0) setCampos(err.campos);
      else setErro(mensagemDeFalha(err, "não deu para criar a renga"));
      setEnviando(false);
    }
  }

  return (
    <div>
      <CabecalhoPagina titulo="Escrever" />
      <FormatoDeEscrita atual="renga" />
      <form onSubmit={enviar} noValidate className="space-y-6 px-4 py-5">
        <div>
          <label htmlFor={`${id}-titulo`} className="block text-sm font-semibold">
            Título
          </label>
          <input
            id={`${id}-titulo`}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={LIMITES.renga_titulo_max}
            placeholder="Renga da chuva no CCHLA"
            aria-invalid={Boolean(campos.titulo)}
            aria-describedby={campos.titulo ? `${id}-titulo-erro` : undefined}
            className={`${campo} poema-titulo mt-1.5`}
          />
          {campos.titulo && (
            <span id={`${id}-titulo-erro`} className="mt-1 block text-xs text-destaque">
              {campos.titulo}
            </span>
          )}
        </div>

        <div>
          <EditorDePoema
            valor={estrofe}
            aoMudar={setEstrofe}
            rotulo={<span className="font-semibold">Primeira estrofe</span>}
            idRotulo={`${id}-estrofe`}
            idAjuda={campos.primeira_estrofe ? `${id}-estrofe-ajuda ${id}-estrofe-erro` : `${id}-estrofe-ajuda`}
            invalido={Boolean(campos.primeira_estrofe)}
            linhas={6}
            classe={campo}
          />
          <span id={`${id}-estrofe-ajuda`} className="mt-1 block text-xs text-tinta-suave">
            Quebras de linha e recuos ficam como você escrever. Para formatar, selecione o trecho.
          </span>
          {campos.primeira_estrofe && (
            <span id={`${id}-estrofe-erro`} className="mt-1 block text-xs text-destaque">
              {campos.primeira_estrofe}
            </span>
          )}
        </div>

        <fieldset className="text-sm" aria-describedby={`${id}-modo`}>
          <legend className="font-semibold">Quem escreve</legend>
          <div className="mt-1">
            {MODOS.map((m) => (
              <label key={m.valor} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
                <input
                  type="radio"
                  name="modo"
                  value={m.valor}
                  checked={modo === m.valor}
                  onChange={() => setModo(m.valor)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-destaque)]"
                />
                <span>
                  <span className="block">{m.rotulo}</span>
                  <span className="block text-tinta-suave">{m.explicacao}</span>
                </span>
              </label>
            ))}
          </div>
          <p id={`${id}-modo`} className="mt-1 text-xs text-tinta-suave">
            Em qualquer modo, ninguém escreve duas estrofes seguidas.
          </p>
        </fieldset>

        {modo === "convidados" && (
          <div>
            <label htmlFor={`${id}-convidados`} className="block text-sm font-semibold">
              Convidados
            </label>
            <input
              id={`${id}-convidados`}
              value={convidados}
              onChange={(e) => setConvidados(e.target.value)}
              placeholder="@marina_letras, @caio_eng"
              aria-describedby={`${id}-convidados-ajuda`}
              className={`${campo} mt-1.5`}
            />
            <span id={`${id}-convidados-ajuda`} className="mt-1 block text-xs text-tinta-suave">
              Usernames separados por vírgula ou espaço. Consagrados não entram (não têm login).
            </span>
          </div>
        )}

        <div>
          <label htmlFor={`${id}-limite`} className="block text-sm font-semibold">
            Limite de estrofes
          </label>
          <input
            id={`${id}-limite`}
            type="number"
            inputMode="numeric"
            min={LIMITES.renga_limite_min}
            max={LIMITES.renga_limite_max}
            value={limite}
            onChange={(e) => setLimite(Number(e.target.value))}
            aria-invalid={Boolean(campos.limite)}
            aria-describedby={`${id}-limite-ajuda`}
            className={`${campo} mt-1.5 block max-w-28 tabular-nums`}
          />
          <span
            id={`${id}-limite-ajuda`}
            className={`mt-1 block text-xs ${campos.limite ? "text-destaque" : "text-tinta-suave"}`}
          >
            {campos.limite ??
              `De ${LIMITES.renga_limite_min} a ${LIMITES.renga_limite_max}, contando a sua. Ao chegar nele, a renga fecha.`}
          </span>
        </div>

        {erro && (
          <AvisoDeErro role="alert">
            {erro}
          </AvisoDeErro>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="min-h-11 cursor-pointer rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
        >
          {enviando ? "criando..." : "Começar a renga"}
        </button>
      </form>
    </div>
  );
}
