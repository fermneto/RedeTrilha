import type { User } from "@/lib/api";

// Iniciais do primeiro e do último nome ("Augusto dos Anjos" → "AA").
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

// Também a medida do avatar no esqueleto do carregamento (components/Esqueleto.tsx).
export const TAMANHOS_DO_AVATAR = {
  p: "h-8 w-8",
  m: "h-10 w-10",
  g: "h-20 w-20",
} as const;

const LETRAS = { p: "text-xs", m: "text-sm", g: "text-2xl" } as const;

// Decorativo: o nome do usuário sempre aparece ao lado, então o avatar não tem alt.
export function Avatar({ usuario, tamanho = "m" }: { usuario: User; tamanho?: keyof typeof TAMANHOS_DO_AVATAR }) {
  const classe = `${TAMANHOS_DO_AVATAR[tamanho]} ${LETRAS[tamanho]} shrink-0 rounded-full`;
  if (usuario.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={usuario.avatar_url} alt="" className={`${classe} object-cover`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${classe} flex items-center justify-center bg-borda font-semibold tracking-wide text-tinta select-none`}
    >
      {iniciais(usuario.name)}
    </span>
  );
}
