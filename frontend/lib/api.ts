// Fetch tipado, único ponto de contato com o backend.
// Envia o token da auth em Authorization: Bearer (guia 01, Parte 2).

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const CHAVE_TOKEN = "token";

export function salvarToken(token: string): void {
  localStorage.setItem(CHAVE_TOKEN, token);
}

function esquecerToken(): void {
  localStorage.removeItem(CHAVE_TOKEN);
}

// Logout: apaga a sessão no backend e depois o token local. Usa fetch direto,
// e não request(), para um 401 aqui não reentrar no tratamento de 401 abaixo.
// Se o backend falhar (fora do ar, token já inválido), limpa mesmo assim.
export async function limparToken(): Promise<void> {
  try {
    await fetch(`${BASE}/auth/logout`, { method: "POST", headers: headers(), cache: "no-store" });
  } catch {
    // sem rede: a sessão fica no backend, mas o navegador esquece o token
  } finally {
    esquecerToken();
  }
}

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = typeof window !== "undefined" ? localStorage.getItem(CHAVE_TOKEN) : null;
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// Erro de resposta não-ok: a mensagem é o `detail` do backend, e o status fica
// disponível para quem precisa distinguir (ex.: 404 = não existe mais).
export class ErroDaApi extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  // 401 com token salvo = token que não vale mais (ex.: o banco foi apagado ou o
  // servidor do deploy reiniciou). Joga o token fora e volta para o login.
  if (res.status === 401 && typeof window !== "undefined" && localStorage.getItem(CHAVE_TOKEN)) {
    esquecerToken();
    if (window.location.pathname !== "/login") window.location.href = "/login";
  }

  if (!res.ok) {
    // 422 = corpo inválido; 409 = conflito (ex.: username repetido). Ver guia 04.
    const erro = await res.json().catch(() => null);
    const detail = typeof erro?.detail === "string" ? erro.detail : null;
    throw new ErroDaApi(detail ?? `${method} ${path} → ${res.status}`, res.status);
  }

  // 204 No Content (seguir, curtir, apagar...) não tem corpo: não há JSON para ler.
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function apiDelete<T = void>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}

// ---- tipos do slice de exemplo (espelham backend/app/schemas/user.py) ----

export type User = {
  id: number;
  username: string;
  name: string;
  bio: string;
  avatar_url: string;
  consagrado: boolean;
  nascimento: number | null;
  morte: number | null;
  created_at: string;
};

export type Page<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};

// ---- Poemas (H6): espelham backend/app/schemas/{post,feed}.py e os comentários ----

// Mesma ordem de FORMAS em backend/app/schemas/post.py.
export const FORMAS = [
  "soneto",
  "haicai",
  "trova",
  "quadra",
  "cordel",
  "verso_livre",
  "prosa_poetica",
  "outro",
] as const;

export type Forma = (typeof FORMAS)[number];

// Rótulo legível da forma: só troca o "_" por espaço (verso_livre → verso livre).
export function nomeDaForma(forma: string): string {
  return forma.replace(/_/g, " ");
}

// O backend grava em UTC, mas o SQLite devolve a data sem fuso ("2026-11-24T02:29:21").
// Sem o "Z", o navegador leria como horário local e a data poderia mudar de dia.
export function formatarData(iso: string): string {
  const comFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  return new Date(comFuso).toLocaleDateString("pt-BR");
}

export type Post = {
  id: number;
  autor_id: number;
  titulo: string | null;
  texto: string;
  forma: string | null;
  obra: string | null;
  ano: number | null;
  fonte: string | null;
  repost_de_id: number | null;
  created_at: string;
  updated_at: string;
  autor: User;
  curtidas: number;
  comentarios: number;
  reposts: number;
  curti: boolean;
  repostei: boolean;
  repost_de: Post | null;
  repost_removido: boolean;
  tags: string[];
  // Só no feed: quem repostou (repost puro), quem repostou por último primeiro.
  repostado_por: User[];
};

// Com cursor, o total vem null (como na timeline do X).
export type FeedPage = Omit<Page<Post>, "total"> & {
  total: number | null;
  proximo_cursor: string | null;
};

// Espelha ComentarioOut (backend/app/schemas/comentario.py). `respostas` é só a
// prévia (até 3); `total_respostas` conta todas as respostas diretas.
// Removido: texto vazio e autor null.
export type Comentario = {
  id: number;
  post_id: number;
  texto: string;
  autor: User | null;
  parent_id: number | null;
  created_at: string;
  removido: boolean;
  total_respostas: number;
  respostas: Comentario[];
};

// Espelha ComentarioPage: respostas diretas em ordem cronológica, por cursor.
export type ComentarioPage = {
  items: Comentario[];
  total: number;
  limit: number;
  proximo_cursor: string | null;
};

export type NovoPoema = {
  titulo: string | null;
  texto: string;
  forma: string | null;
  repost_de_id?: number;
};

// Há sessão no navegador? Sem token, as rotas protegidas devolvem 401.
export function temToken(): boolean {
  return typeof window !== "undefined" && Boolean(localStorage.getItem(CHAVE_TOKEN));
}

export function buscarFeed(cursor: string | null, limit = 20): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<FeedPage>(`/feed?${params}`);
}

export function buscarPoema(id: number): Promise<Post> {
  return apiGet<Post>(`/posts/${id}`);
}

export function publicarPoema(dados: NovoPoema): Promise<Post> {
  return apiPost<Post>("/posts", dados);
}

export function curtir(id: number, curtido: boolean): Promise<void> {
  return curtido ? apiPost<void>(`/posts/${id}/curtir`) : apiDelete(`/posts/${id}/curtir`);
}

export function repostar(id: number, repostado: boolean): Promise<void> {
  return repostado ? apiPost<void>(`/posts/${id}/repostar`) : apiDelete(`/posts/${id}/repostar`);
}

function paginaDeComentarios(caminho: string, cursor: string | null, limit: number) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<ComentarioPage>(`${caminho}?${params}`);
}

// Comentários na raiz do poema, cada um com a prévia das respostas.
export function buscarComentarios(postId: number, cursor: string | null, limit = 20) {
  return paginaDeComentarios(`/posts/${postId}/comentarios`, cursor, limit);
}

// Respostas diretas de um comentário ("ver mais respostas").
export function buscarRespostas(comentarioId: number, cursor: string | null, limit = 20) {
  return paginaDeComentarios(`/comentarios/${comentarioId}/respostas`, cursor, limit);
}

export function comentar(postId: number, texto: string, parentId: number | null): Promise<Comentario> {
  return apiPost<Comentario>(`/posts/${postId}/comentarios`, { texto, parent_id: parentId });
}

export function apagarComentario(id: number): Promise<void> {
  return apiDelete(`/comentarios/${id}`);
}

// Usuário da sessão (o botão "apagar" só aparece para o autor do comentário).
export function buscarEu(): Promise<User> {
  return apiGet<User>("/auth/eu");
}
