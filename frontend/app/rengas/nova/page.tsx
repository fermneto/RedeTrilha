"use client";
// Nova renga: título, a primeira estrofe e as configurações (modo, limite de
// estrofes e, no modo convidados, os usernames de quem pode escrever).

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import {
  caminhoDoLogin,
  criarRenga,
  ErroDaApi,
  lerUsernames,
  mensagemDeFalha,
  RENGA_LIMITE_MAX,
  RENGA_LIMITE_MIN,
  RENGA_LIMITE_PADRAO,
  RENGA_TITULO_MAX,
  temToken,
  type ModoDaRenga,
} from "@/lib/api";

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
  const [limite, setLimite] = useState(RENGA_LIMITE_PADRAO);
  const [convidados, setConvidados] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const idModo = useId();

  useEffect(() => {
    if (!temToken()) router.replace(caminhoDoLogin());
  }, [router]);

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
      <CabecalhoPagina titulo="Nova renga" />
      <form onSubmit={enviar} noValidate className="space-y-5 px-4 py-5">
        <label className="block text-sm">
          Título
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={RENGA_TITULO_MAX}
            placeholder="Renga da chuva no CCHLA"
            aria-invalid={Boolean(campos.titulo)}
            className={`${campo} mt-1`}
          />
          {campos.titulo && <span className="mt-1 block text-xs text-destaque">{campos.titulo}</span>}
        </label>

        <label className="block text-sm">
          Primeira estrofe
          <textarea
            value={estrofe}
            onChange={(e) => setEstrofe(e.target.value)}
            rows={6}
            aria-invalid={Boolean(campos.primeira_estrofe)}
            className={`${campo} poema-corpo mt-1 resize-y`}
          />
          {campos.primeira_estrofe && (
            <span className="mt-1 block text-xs text-destaque">{campos.primeira_estrofe}</span>
          )}
        </label>

        <fieldset className="space-y-2 text-sm" aria-describedby={idModo}>
          <legend>Quem escreve</legend>
          {MODOS.map((m) => (
            <label key={m.valor} className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="modo"
                value={m.valor}
                checked={modo === m.valor}
                onChange={() => setModo(m.valor)}
                className="h-4 w-4 accent-[var(--color-destaque)]"
              />
              <span>
                <span className="font-semibold">{m.rotulo}</span>
                <span className="text-tinta-suave"> — {m.explicacao}</span>
              </span>
            </label>
          ))}
          <p id={idModo} className="text-xs text-tinta-suave">
            Em qualquer modo, ninguém escreve duas estrofes seguidas.
          </p>
        </fieldset>

        {modo === "convidados" && (
          <label className="block text-sm">
            Convidados
            <input
              value={convidados}
              onChange={(e) => setConvidados(e.target.value)}
              placeholder="@marina_letras, @caio_eng"
              className={`${campo} mt-1`}
            />
            <span className="mt-1 block text-xs text-tinta-suave">
              Usernames separados por vírgula ou espaço. Consagrados não entram (não têm login).
            </span>
          </label>
        )}

        <label className="block text-sm">
          Limite de estrofes
          <input
            type="number"
            min={RENGA_LIMITE_MIN}
            max={RENGA_LIMITE_MAX}
            value={limite}
            onChange={(e) => setLimite(Number(e.target.value))}
            aria-invalid={Boolean(campos.limite)}
            className={`${campo} mt-1 max-w-32 tabular-nums`}
          />
          <span className="mt-1 block text-xs text-tinta-suave">
            {campos.limite ??
              `De ${RENGA_LIMITE_MIN} a ${RENGA_LIMITE_MAX}, contando a sua. Ao chegar nele, a renga fecha.`}
          </span>
        </label>

        {erro && <p className="rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>}

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
