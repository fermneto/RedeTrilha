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
// No 422, `campos` guarda a mensagem de cada campo do corpo (ex.: { username: "..." }),
// para o formulário mostrar o erro ao lado do campo certo.
export class ErroDaApi extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly campos: Record<string, string> = {},
  ) {
    super(message);
  }
}

type ErroDoPydantic = { msg?: unknown; loc?: unknown };

// O `msg` já vem em português (backend/app/erros.py).
function textoDoErro(e: ErroDoPydantic): string | null {
  return typeof e?.msg === "string" ? e.msg : null;
}

// Nome amigável do campo na mensagem geral; campo desconhecido fica como veio.
const ROTULOS_DOS_CAMPOS: Record<string, string> = {
  username: "username",
  name: "nome",
  password: "senha",
  bio: "bio",
  avatar_url: "avatar",
  texto: "texto",
  titulo: "título",
};

// "senha: campo obrigatório", com o último elemento do `loc` (o campo do corpo).
function textoComCampo(e: ErroDoPydantic): string | null {
  const texto = textoDoErro(e);
  if (!texto) return null;
  const loc = Array.isArray(e?.loc) ? e.loc : [];
  const campo = loc.length > 1 ? loc[loc.length - 1] : null;
  if (typeof campo !== "string") return texto;
  return `${ROTULOS_DOS_CAMPOS[campo] ?? campo}: ${texto}`;
}

// O `detail` do FastAPI: texto (HTTPException) ou, no 422, uma lista de erros
// com `msg` e `loc`.
function mensagemDoErro(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return null;
  const msgs = (detail as ErroDoPydantic[]).map(textoComCampo).filter((m): m is string => Boolean(m));
  return msgs.length > 0 ? msgs.join("; ") : null;
}

// loc do pydantic: ["body", "username"]. Fica a primeira mensagem de cada campo.
function camposDoErro(detail: unknown): Record<string, string> {
  const campos: Record<string, string> = {};
  if (!Array.isArray(detail)) return campos;
  for (const e of detail as ErroDoPydantic[]) {
    const loc = Array.isArray(e?.loc) ? e.loc : [];
    const campo = loc[0] === "body" && typeof loc[1] === "string" ? loc[1] : null;
    const texto = textoDoErro(e);
    if (campo && texto && !(campo in campos)) campos[campo] = texto;
  }
  return campos;
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
    // Login e cadastro conferem o token salvo e tratam o 401 na própria tela.
    if (!["/login", "/cadastro"].includes(window.location.pathname)) {
      window.location.href = caminhoDoLogin();
    }
  }

  if (!res.ok) {
    // 422 = corpo inválido; 409 = conflito (ex.: username repetido). Ver guia 04.
    const erro = await res.json().catch(() => null);
    throw new ErroDaApi(
      mensagemDoErro(erro?.detail) ?? `${method} ${path} → ${res.status}`,
      res.status,
      camposDoErro(erro?.detail),
    );
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

// ---- Login e cadastro (P3): espelham backend/app/schemas/auth.py ----

// Mesmas regras do Username e do RegistroIn no backend.
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_FORMATO = /^[a-z0-9_]+$/;
export const SENHA_MIN = 8;
export const SENHA_MAX = 72;

export type NovoCadastro = { username: string; name: string; password: string };

export function entrar(username: string, password: string): Promise<{ token: string }> {
  return apiPost<{ token: string }>("/auth/login", { username, password });
}

export function cadastrar(dados: NovoCadastro): Promise<User> {
  return apiPost<User>("/auth/registro", dados);
}

// Caracteres de controle (TAB, quebra de linha...): o navegador os apaga da URL,
// e "/\t/site.com" viraria "//site.com".
const CONTROLE = /[\u0000-\u001F\u007F]/;

// Para onde ir depois do login. Só caminhos do próprio Verso ("/feed", "/poema/3"):
// em vez de adivinhar os truques ("//site.com", "/\site.com"), resolve a URL como
// o navegador faria e confere a origem (open redirect).
export function destinoSeguro(proximo: unknown): string {
  if (typeof window === "undefined") return "/";
  if (typeof proximo !== "string" || !proximo.startsWith("/") || CONTROLE.test(proximo)) return "/";
  try {
    const url = new URL(proximo, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

// "/login?proximo=<página atual>", para voltar a ela depois de entrar.
export function caminhoDoLogin(): string {
  if (typeof window === "undefined") return "/login";
  const atual = window.location.pathname + window.location.search;
  return atual === "/" ? "/login" : `/login?proximo=${encodeURIComponent(atual)}`;
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

// ---- Perfil (P4): espelha PerfilOut e PerfilUpdate de backend/app/schemas/user.py ----

export type Perfil = User & {
  seguidores: number;
  seguindo: number;
  // Poemas e citações; reposts puros não contam.
  poemas: number;
  // Se o usuário atual segue a pessoa.
  sigo: boolean;
};

// Anos de vida de um consagrado: "1861–1898", "m. 1898" ou null (sem a morte, ou não consagrado).
export function anosDeVida(user: User): string | null {
  if (!user.consagrado || user.morte === null) return null;
  return user.nascimento !== null ? `${user.nascimento}–${user.morte}` : `m. ${user.morte}`;
}

// Só os campos enviados mudam.
export type EdicaoDoPerfil = Partial<Pick<User, "name" | "bio" | "avatar_url">>;

export function buscarPerfil(username: string): Promise<Perfil> {
  return apiGet<Perfil>(`/usuarios/${encodeURIComponent(username)}`);
}

export function editarPerfil(dados: EdicaoDoPerfil): Promise<Perfil> {
  return apiPatch<Perfil>("/usuarios/eu", dados);
}

// Poemas, citações e reposts puros da pessoa, como no X; pagina como o feed.
export function buscarPoemasDoPerfil(
  username: string,
  cursor: string | null,
  limit = 20,
): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<FeedPage>(`/usuarios/${encodeURIComponent(username)}/posts?${params}`);
}

// ---- Coluna direita do layout: poema do dia, tags em alta e quem seguir ----

// GET /poemas/do-dia: um poema de consagrado, o mesmo para todos no mesmo dia (UTC).
// 404 quando ainda não há consagrados no banco.
export function buscarPoemaDoDia(): Promise<Post> {
  return apiGet<Post>("/poemas/do-dia");
}

// Espelha Trending (backend/app/schemas/tags.py): as 5 tags com mais poemas nas últimas 24 h.
export type TagContagem = { tag: string; contagem: number };

export function buscarTrending(): Promise<{ items: TagContagem[] }> {
  return apiGet<{ items: TagContagem[] }>("/tags/trending");
}

export type FiltrosDoExplorar = { tag: string | null; forma: string | null };

// GET /explorar: poemas de todos, mais novo primeiro; tag e forma juntas fazem
// interseção. A rota pagina por offset e a ListaDePoemas por cursor, então o
// cursor aqui é o próximo offset em texto, e vira null quando chega ao total.
export async function buscarExplorar(
  { tag, forma }: FiltrosDoExplorar,
  cursor: string | null,
  limit = 20,
): Promise<FeedPage> {
  const offset = cursor === null ? 0 : Number(cursor);
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (tag) params.set("tag", tag);
  if (forma) params.set("forma", forma);
  const pagina = await apiGet<Page<Post>>(`/explorar?${params}`);
  const proximo = offset + pagina.limit;
  return { ...pagina, proximo_cursor: proximo < pagina.total ? String(proximo) : null };
}

// Equivale a core/indice_tags.normalizar: casefold e sem acento ("#Solidão" → "solidao").
// O JS não tem casefold; toLowerCase mais "ß" → "ss" cobre a diferença que importa
// aqui. Depois fica só o que cabe numa tag ([a-z0-9_]), sem o "#".
export function normalizarTag(termo: string): string {
  return termo
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9_]/g, "");
}

export function listarUsuarios(offset = 0, limit = 100): Promise<Page<User>> {
  return apiGet<Page<User>>(`/usuarios?offset=${offset}&limit=${limit}`);
}

export function listarSeguindo(username: string, limit = 100): Promise<Page<User>> {
  return apiGet<Page<User>>(
    `/usuarios/${encodeURIComponent(username)}/seguindo?offset=0&limit=${limit}`,
  );
}

export function seguir(username: string, seguindo: boolean): Promise<void> {
  const caminho = `/usuarios/${encodeURIComponent(username)}/follow`;
  return seguindo ? apiPost<void>(caminho) : apiDelete(caminho);
}
