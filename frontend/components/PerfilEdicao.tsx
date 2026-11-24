"use client";
// Formulário inline do "Editar perfil": nome, bio e avatar_url (PATCH /usuarios/eu).

import { useState } from "react";

import { editarPerfil, mensagemDeFalha, type Perfil } from "@/lib/api";

type Props = {
  perfil: Perfil;
  aoSalvar: (perfil: Perfil) => void;
  aoCancelar: () => void;
};

export function PerfilEdicao({ perfil, aoSalvar, aoCancelar }: Props) {
  const [name, setName] = useState(perfil.name);
  const [bio, setBio] = useState(perfil.bio);
  const [avatarUrl, setAvatarUrl] = useState(perfil.avatar_url);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      // A bio vai como foi digitada: as quebras de linha ficam.
      aoSalvar(await editarPerfil({ name, bio, avatar_url: avatarUrl.trim() }));
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para salvar o perfil"));
      setSalvando(false);
    }
  }

  const campo = "w-full rounded border border-borda bg-papel px-3 py-2 text-tinta";
  return (
    <form onSubmit={salvar} className="space-y-4 rounded-lg border border-borda bg-papel-alto p-6">
      <label className="block text-sm">
        Nome
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          className={`${campo} mt-1`}
        />
      </label>
      <label className="block text-sm">
        Bio
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={1000}
          rows={4}
          className={`${campo} mt-1 resize-y`}
        />
        <span className="mt-1 block text-xs text-tinta-suave">{bio.length}/1000</span>
      </label>
      <label className="block text-sm">
        Endereço da foto (avatar_url)
        <input
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          maxLength={500}
          placeholder="https://..."
          className={`${campo} mt-1`}
        />
      </label>

      {erro && <p className="rounded border border-destaque p-3 text-sm text-destaque">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="cursor-pointer rounded bg-tinta px-4 py-2 text-sm text-papel disabled:opacity-50"
        >
          {salvando ? "salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={aoCancelar}
          disabled={salvando}
          className="cursor-pointer rounded border border-borda px-4 py-2 text-sm disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
