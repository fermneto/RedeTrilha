"use client";
// Formulário inline da antologia: nome, descrição e o switch Pública/Privada.
// O mesmo serve para criar (em /antologias/nova) e para editar (no detalhe).

import { useEffect, useId, useRef, useState } from "react";

import { AvisoDeErro } from "@/components/AvisoDeErro";
import {
  ANTOLOGIA_DESCRICAO_MAX,
  ANTOLOGIA_NOME_MAX,
  ErroDaApi,
  mensagemDeFalha,
  type Antologia,
  type NovaAntologia,
} from "@/lib/api";

type Props = {
  // Valores iniciais (na edição); sem eles, uma antologia nova e pública.
  inicial?: Pick<Antologia, "nome" | "descricao" | "publica">;
  textoDoBotao: string;
  aoEnviar: (dados: Required<NovaAntologia>) => Promise<void>;
  aoCancelar: () => void;
};

export function AntologiaFormulario({ inicial, textoDoBotao, aoEnviar, aoCancelar }: Props) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [publica, setPublica] = useState(inicial?.publica ?? true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const campoNome = useRef<HTMLInputElement>(null);
  const idSwitch = useId();
  const idErroNome = useId();
  const idContador = useId();

  // O formulário abre por um botão: o foco vai direto para o nome.
  useEffect(() => {
    campoNome.current?.focus();
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErroDoNome("a antologia precisa de um nome");
      campoNome.current?.focus();
      return;
    }
    setEnviando(true);
    setErro(null);
    setErroDoNome(null);
    try {
      // Descrição em branco vira null: a antologia fica sem descrição.
      await aoEnviar({ nome, descricao: descricao.trim() ? descricao : null, publica });
    } catch (err) {
      if (err instanceof ErroDaApi && err.campos.nome) setErroDoNome(err.campos.nome);
      else setErro(mensagemDeFalha(err, "não deu para salvar a antologia"));
      setEnviando(false);
    }
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "Escape" && !enviando) aoCancelar();
  }

  const campo =
    "w-full rounded-xl border border-borda bg-papel px-3 py-2 text-tinta transition-colors duration-150 focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none";
  return (
    <form
      onSubmit={enviar}
      onKeyDown={aoTeclar}
      noValidate
      className="space-y-4 rounded-2xl border border-borda bg-papel-alto p-4"
    >
      <label className="block text-sm font-semibold">
        Nome
        <input
          ref={campoNome}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          maxLength={ANTOLOGIA_NOME_MAX}
          placeholder="Poemas de chuva"
          aria-invalid={erroDoNome !== null}
          aria-describedby={erroDoNome ? idErroNome : undefined}
          className={`${campo} mt-1 font-normal`}
        />
        {erroDoNome && (
          <span id={idErroNome} role="alert" className="mt-1 block text-xs font-normal text-destaque">
            {erroDoNome}
          </span>
        )}
      </label>

      <label className="block text-sm font-semibold">
        Descrição <span className="font-normal text-tinta-suave">(opcional)</span>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={ANTOLOGIA_DESCRICAO_MAX}
          rows={3}
          placeholder="Para ler na marquise, esperando a chuva passar."
          aria-describedby={idContador}
          className={`${campo} mt-1 resize-y font-normal`}
        />
        <span id={idContador} className="mt-1 block text-right text-xs font-normal text-tinta-suave tabular-nums">
          {descricao.length}/{ANTOLOGIA_DESCRICAO_MAX}
        </span>
      </label>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm">
          {/* Rótulo fixo: o leitor de tela anuncia "Pública, ligado/desligado". */}
          <label htmlFor={idSwitch} className="cursor-pointer font-semibold">
            Pública
          </label>
          <p className="text-xs text-tinta-suave" aria-live="polite">
            {publica ? "Aparece no seu perfil, para todo mundo." : "Privada: só você vê."}
          </p>
        </div>
        <SwitchPublica id={idSwitch} publica={publica} aoMudar={setPublica} />
      </div>

      {erro && (
        <AvisoDeErro role="alert">
          {erro}
        </AvisoDeErro>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="min-h-11 cursor-pointer rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
        >
          {enviando ? "salvando..." : textoDoBotao}
        </button>
        <button
          type="button"
          onClick={aoCancelar}
          disabled={enviando}
          className="realce min-h-11 cursor-pointer rounded-full border border-borda px-5 text-sm disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// Switch acessível: role="switch" com aria-checked; "ligado" = pública.
export function SwitchPublica({
  id,
  publica,
  aoMudar,
}: {
  id: string;
  publica: boolean;
  aoMudar: (publica: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={publica}
      onClick={() => aoMudar(!publica)}
      className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center"
    >
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 rounded-full transition-colors duration-150 ${
          publica ? "bg-destaque" : "bg-borda"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-papel-alto shadow transition-transform duration-150 ${
            publica ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}
