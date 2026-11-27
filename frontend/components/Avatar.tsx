import type { User } from "@/lib/api";

// Iniciais do primeiro e do último nome ("Augusto dos Anjos" → "AA").
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

// Fundos claros para quem não tem foto; o texto é sempre escuro, nos dois temas.
const FUNDOS = ["#e6c3b3", "#c9d6bf", "#ecd9a0", "#bfd0dc", "#d6c9e0", "#ecc6cf", "#b9d9d3", "#e0d2b8"];

// A mesma pessoa tem sempre a mesma cor: um hash simples do username (ou do nome).
function fundoDoAvatar(usuario: User): string {
  const chave = usuario.username || usuario.name;
  let hash = 0;
  for (const letra of chave) hash = (hash * 31 + letra.charCodeAt(0)) >>> 0;
  return FUNDOS[hash % FUNDOS.length];
}

// Também a medida do avatar no esqueleto do carregamento (components/Esqueleto.tsx).
export const TAMANHOS_DO_AVATAR = {
  // Os rostos empilhados de quem curtiu ou repostou (components/Repercussao.tsx).
  mi: "h-6 w-6",
  p: "h-8 w-8",
  m: "h-10 w-10",
  // A faixa do autor na página do poema (components/FaixaDoAutor.tsx).
  l: "h-12 w-12",
  g: "h-20 w-20",
} as const;

const LETRAS = { mi: "text-[0.5625rem]", p: "text-xs", m: "text-sm", l: "text-base", g: "text-2xl" } as const;

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
      style={{ backgroundColor: fundoDoAvatar(usuario), color: "#2a211a" }}
      className={`${classe} flex items-center justify-center font-semibold tracking-wide select-none`}
    >
      {iniciais(usuario.name)}
    </span>
  );
}
