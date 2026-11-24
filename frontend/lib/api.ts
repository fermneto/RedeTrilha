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
  descricao: "descrição",
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

// Rótulo legível de cada forma, com acento (o valor guardado não tem).
const NOMES_DAS_FORMAS: Record<Forma, string> = {
  soneto: "soneto",
  haicai: "haicai",
  trova: "trova",
  quadra: "quadra",
  cordel: "cordel",
  verso_livre: "verso livre",
  prosa_poetica: "prosa poética",
  outro: "outro",
};

// Forma fora da lista (não deveria vir do backend) fica só com "_" virando espaço.
export function nomeDaForma(forma: string): string {
  return NOMES_DAS_FORMAS[forma as Forma] ?? forma.replace(/_/g, " ");
}

// A forma também vira tag (#soneto).
function ehForma(tag: string): boolean {
  return (FORMAS as readonly string[]).includes(tag);
}

// Link de uma #tag (card, "Em alta"): a de forma liga o chip da forma no Explorar.
export function caminhoDaTag(tag: string): string {
  return ehForma(tag) ? `/explorar?forma=${tag}` : `/explorar?tag=${encodeURIComponent(tag)}`;
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
  // Código ISO 639-1 da língua do poema ("pt", "en", "zh"); null = desconhecida.
  idioma: string | null;
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
// O feed e o perfil misturam poemas e rengas (ItemDoFeed, na seção das Rengas).
export type FeedPage = Omit<Page<ItemDoFeed>, "total"> & {
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
  // Crítica ancorada em versos (só no 1º nível); ver a seção no fim do arquivo.
  ancora: Ancora | null;
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
  // ISO 639-1; null = outra língua (desconhecida). Sem o campo, o backend usa "pt".
  idioma?: string | null;
  repost_de_id?: number;
};

// Línguas do seletor do compositor, português primeiro (o padrão). "outra" manda null.
export const IDIOMAS_DO_COMPOSITOR = ["pt", "es", "en", "fr", "it", "de", "la"] as const;

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

// O poema publicado não se edita (decisão 9 do DECISIONS.md): para corrigir, o autor
// apaga e publica de novo.
export function apagarPoema(id: number): Promise<void> {
  return apiDelete(`/posts/${id}`);
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

// Espelha ComentarioApagadoOut: "apagado" saiu do banco (não tinha respostas);
// "removido" virou o marcador. `total_respostas` é a contagem atual do backend.
export type ComentarioApagado = {
  resultado: "apagado" | "removido";
  total_respostas: number;
};

export function apagarComentario(id: number): Promise<ComentarioApagado> {
  return apiDelete<ComentarioApagado>(`/comentarios/${id}`);
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

// Anos de vida de um consagrado: "1861–1898", "m. 1898" ou null (sem a morte, ou
// não consagrado). Ano negativo é antes de Cristo: "800–700 a.C." quando os dois
// são, "70 a.C.–19" quando só o nascimento é, "m. 55 a.C." só com a morte.
export function anosDeVida(user: User): string | null {
  const { nascimento, morte } = user;
  if (!user.consagrado || morte === null) return null;
  if (nascimento === null) return `m. ${ano(morte)}`;
  if (nascimento < 0 && morte < 0) return `${-nascimento}–${-morte} a.C.`;
  return `${ano(nascimento)}–${ano(morte)}`;
}

function ano(valor: number): string {
  return valor < 0 ? `${-valor} a.C.` : String(valor);
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

// ---- Tradução: espelha TraducaoOut (backend/app/schemas/traducao.py) ----

export type Traducao = {
  titulo: string | null;
  texto: string;
  idioma_origem: string | null;
  idioma_destino: string;
  modelo: string;
  // Veio da tabela de traduções, sem chamar a IA de novo.
  em_cache: boolean;
};

// `para` é um código ISO 639-1 ("pt"). 422 se o poema já está nessa língua; 503 sem IA.
export function traduzirPoema(id: number, para: string): Promise<Traducao> {
  return apiPost<Traducao>(`/posts/${id}/traduzir`, { para });
}

// Língua do navegador, só o subtag primário ("pt" de "pt-BR"). null no servidor.
export function idiomaDoNavegador(): string | null {
  if (typeof navigator === "undefined" || !navigator.language) return null;
  return navigator.language.split("-")[0].toLowerCase();
}

// Nome da língua em português ("en" → "inglês"); o próprio código se o navegador não souber.
export function nomeDoIdioma(codigo: string): string {
  try {
    return new Intl.DisplayNames(["pt-BR"], { type: "language" }).of(codigo)?.toLowerCase() ?? codigo;
  } catch {
    return codigo;
  }
}

// ---- Antologias (P5): espelham backend/app/schemas/antologia.py ----

// Mesmos limites de AntologiaCreate.
export const ANTOLOGIA_NOME_MAX = 100;
export const ANTOLOGIA_DESCRICAO_MAX = 1000;

export type Antologia = {
  id: number;
  dono_id: number;
  dono: User;
  nome: string;
  descricao: string | null;
  // Privada só existe para o dono: para os outros, o backend devolve 404.
  publica: boolean;
  created_at: string;
  // Quantos poemas a antologia tem.
  qtd: number;
};

// Os poemas vêm na ordem em que foram adicionados.
export type AntologiaDetalhe = Antologia & { poemas: Post[] };

export type NovaAntologia = { nome: string; descricao?: string | null; publica?: boolean };

// PATCH parcial: só os campos enviados mudam; descricao null apaga a descrição.
export type EdicaoDaAntologia = Partial<Pick<Antologia, "nome" | "descricao" | "publica">>;

// Todas as minhas, privadas inclusive, a mais nova primeiro.
export function listarMinhasAntologias(offset = 0, limit = 100): Promise<Page<Antologia>> {
  return apiGet<Page<Antologia>>(`/antologias?offset=${offset}&limit=${limit}`);
}

// As minhas, cada uma dizendo se o poema está nela (repost puro conta como o original).
export type AntologiaMarcada = Antologia & { contem: boolean };

export function listarMinhasAntologiasMarcando(
  postId: number,
  offset = 0,
  limit = 100,
): Promise<Page<AntologiaMarcada>> {
  return apiGet<Page<AntologiaMarcada>>(
    `/antologias?post_id=${postId}&offset=${offset}&limit=${limit}`,
  );
}

// As públicas de alguém (as minhas privadas também, se o perfil for o meu).
export function listarAntologiasDe(
  username: string,
  offset = 0,
  limit = 100,
): Promise<Page<Antologia>> {
  return apiGet<Page<Antologia>>(
    `/usuarios/${encodeURIComponent(username)}/antologias?offset=${offset}&limit=${limit}`,
  );
}

// 404 quando não existe ou é privada de outra pessoa.
export function buscarAntologia(id: number): Promise<AntologiaDetalhe> {
  return apiGet<AntologiaDetalhe>(`/antologias/${id}`);
}

export function criarAntologia(dados: NovaAntologia): Promise<Antologia> {
  return apiPost<Antologia>("/antologias", dados);
}

export function editarAntologia(id: number, dados: EdicaoDaAntologia): Promise<Antologia> {
  return apiPatch<Antologia>(`/antologias/${id}`, dados);
}

export function apagarAntologia(id: number): Promise<void> {
  return apiDelete(`/antologias/${id}`);
}

// Idempotente nos dois sentidos: adicionar de novo não duplica, tirar o que não está não falha.
export function marcarNaAntologia(antologiaId: number, postId: number, dentro: boolean): Promise<void> {
  return dentro
    ? apiPost<void>(`/antologias/${antologiaId}/poemas`, { post_id: postId })
    : apiDelete(`/antologias/${antologiaId}/poemas/${postId}`);
}

// ---- Acervo: espelha backend/app/schemas/acervo.py ----

export const TIPOS_DO_ACERVO = ["todos", "consagrados", "contemporaneos"] as const;
export type TipoDoAcervo = (typeof TIPOS_DO_ACERVO)[number];

export const ORDENS_DO_ACERVO = ["alfabetica", "seguidos", "poemas"] as const;
export type OrdemDoAcervo = (typeof ORDENS_DO_ACERVO)[number];

// O mesmo POR_PAGINA de backend/app/routers/acervo.py.
export const POR_PAGINA_DO_ACERVO = 24;

// Um cartão: o User mais as contagens do perfil e se eu sigo.
export type PoetaDoAcervo = User & {
  seguidores: number;
  // Poemas e citações; reposts puros não contam.
  poemas: number;
  sigo: boolean;
};

// `lingua` e `epoca` só valem para consagrados; null = sem esse filtro.
export type FiltrosDoAcervo = {
  tipo: TipoDoAcervo;
  q: string;
  lingua: string | null;
  epoca: string | null;
  ordem: OrdemDoAcervo;
};

// As faixas de época vêm do backend (FAIXAS_DE_EPOCA em services/acervo.py), não
// são repetidas aqui.
export type EpocaDoAcervo = {
  chave: string;
  rotulo: string;
  // Anos de morte, inclusive; null = sem início (a Antiguidade).
  inicio: number | null;
  fim: number;
  poetas: number;
};

export type OpcoesDoAcervo = {
  // Código ISO 639-1 e quantos consagrados escrevem nessa língua.
  linguas: { codigo: string; poetas: number }[];
  epocas: EpocaDoAcervo[];
};

// `pagina` começa em 1, como na URL da tela.
export function buscarAcervo(filtros: FiltrosDoAcervo, pagina: number): Promise<Page<PoetaDoAcervo>> {
  const params = new URLSearchParams({
    offset: String((pagina - 1) * POR_PAGINA_DO_ACERVO),
    limit: String(POR_PAGINA_DO_ACERVO),
    tipo: filtros.tipo,
    ordem: filtros.ordem,
  });
  if (filtros.q.trim()) params.set("q", filtros.q.trim());
  if (filtros.lingua) params.set("lingua", filtros.lingua);
  if (filtros.epoca) params.set("epoca", filtros.epoca);
  return apiGet<Page<PoetaDoAcervo>>(`/acervo?${params}`);
}

export function buscarOpcoesDoAcervo(): Promise<OpcoesDoAcervo> {
  return apiGet<OpcoesDoAcervo>("/acervo/filtros");
}

// ---- Rengas (poema colaborativo): espelham backend/app/schemas/renga.py ----

// Os mesmos limites de RengaCreate (LIMITE_PADRAO, LIMITE_MIN, LIMITE_MAX).
export const RENGA_LIMITE_PADRAO = 12;
export const RENGA_LIMITE_MIN = 3;
export const RENGA_LIMITE_MAX = 40;
export const RENGA_TITULO_MAX = 200;

export type ModoDaRenga = "aberta" | "convidados";
export type SituacaoDaRenga = "aberta" | "fechada";

export type Renga = {
  id: number;
  titulo: string;
  modo: ModoDaRenga;
  limite: number;
  criador: User;
  fechada: boolean;
  fechada_em: string | null;
  created_at: string;
  qtd_estrofes: number;
  // Cada autor uma vez, na ordem da primeira estrofe dele.
  autores: User[];
};

export type Estrofe = {
  id: number;
  posicao: number;
  texto: string;
  autor: User;
  created_at: string;
};

export type RengaDetalhe = Renga & {
  estrofes: Estrofe[];
  convidados: User[];
  posso_escrever: boolean;
  // Por que o usuário atual não pode escrever a próxima estrofe (null quando pode).
  motivo: string | null;
};

export type NovaRenga = {
  titulo: string;
  primeira_estrofe: string;
  modo: ModoDaRenga;
  limite: number;
  // Usernames; só no modo "convidados".
  convidados: string[];
};

// A mais nova primeiro; sem `situacao`, abertas e fechadas juntas.
export function listarRengas(
  situacao: SituacaoDaRenga | null,
  offset = 0,
  limit = 20,
): Promise<Page<Renga>> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (situacao) params.set("situacao", situacao);
  return apiGet<Page<Renga>>(`/rengas?${params}`);
}

export function buscarRenga(id: number): Promise<RengaDetalhe> {
  return apiGet<RengaDetalhe>(`/rengas/${id}`);
}

export function criarRenga(dados: NovaRenga): Promise<RengaDetalhe> {
  return apiPost<RengaDetalhe>("/rengas", dados);
}

// 403 para quem não foi convidado; 409 para renga fechada ou "não é a sua vez".
export function acrescentarEstrofe(id: number, texto: string): Promise<RengaDetalhe> {
  return apiPost<RengaDetalhe>(`/rengas/${id}/estrofes`, { texto });
}

export function encerrarRenga(id: number): Promise<RengaDetalhe> {
  return apiPost<RengaDetalhe>(`/rengas/${id}/encerrar`);
}

export function convidarParaRenga(id: number, usernames: string[]): Promise<RengaDetalhe> {
  return apiPost<RengaDetalhe>(`/rengas/${id}/convites`, { usernames });
}

// Renga no feed e no perfil (RengaNoFeed em backend/app/schemas/feed.py), como um
// repost no X: o rótulo é "fulano abriu uma renga" (o criador, sempre), "fulano
// escreveu uma estrofe" ou "fulano encerrou a renga".
export type RengaNoFeed = {
  tipo: "renga";
  renga: RengaDetalhe;
  atividade: "abriu" | "escreveu" | "encerrou";
  // Os seguidos (ou você) do rótulo, quem fez por último primeiro.
  por: User[];
};

// No feed e no perfil o poema vem com tipo "poema"; no Explorar, sem o campo.
export type ItemDoFeed = (Post & { tipo?: "poema" }) | RengaNoFeed;

export function ehRenga(item: ItemDoFeed): item is RengaNoFeed {
  return item.tipo === "renga";
}

// Chave única entre os dois tipos (um poema e uma renga podem ter o mesmo id).
export function chaveDoItem(item: ItemDoFeed): string {
  return ehRenga(item) ? `renga-${item.renga.id}` : `poema-${item.id}`;
}

// "@ana, bia  @caio" → ["ana", "bia", "caio"]: separa por vírgula ou espaço, tira o "@" e repetidos.
export function lerUsernames(texto: string): string[] {
  const nomes = texto
    .split(/[\s,]+/)
    .map((n) => n.replace(/^@/, "").toLowerCase())
    .filter(Boolean);
  return [...new Set(nomes)];
}

// ---- Oficina do compositor: espelha backend/app/schemas/oficina.py ----

// O mesmo MAX_CARACTERES do backend: acima disso a oficina não marca (o poema
// continua sem limite).
export const OFICINA_MAX_CARACTERES = 10_000;

export type VersoAnalisado = {
  // null em linha em branco ou sem palavras.
  silabas: number | null;
  rima: string | null;
  tipo_rima: "consoante" | "toante" | null;
};

// `versos` tem um item por linha de texto.split("\n"), na ordem do textarea.
export type AnaliseDoRascunho = {
  versos: VersoAnalisado[];
  esquema: string;
  aviso: string | null;
};

// Sem login e sem banco: nada do que se manda aqui é gravado.
export function analisarRascunho(texto: string, forma: string | null): Promise<AnaliseDoRascunho> {
  return apiPost<AnaliseDoRascunho>("/oficina/analise", { texto, forma });
}

// Texto da marca ao lado do verso ("10 · A"); vazio se não há nada a mostrar.
export function marcaDoVerso(
  verso: VersoAnalisado | undefined,
  opcoes: { silabas: boolean; rimas: boolean },
): string {
  if (!verso) return "";
  const partes = [
    opcoes.silabas && verso.silabas !== null ? String(verso.silabas) : null,
    opcoes.rimas && verso.rima ? verso.rima : null,
  ];
  return partes.filter(Boolean).join(" · ");
}

// ---- Crítica ancorada no verso (#71): espelha AncoraOut e VersosComentadosOut
// de backend/app/schemas/comentario.py ----
// Os versos são as linhas de texto.split("\n"), contadas a partir de 1, com as
// linhas em branco entre estrofes incluídas (igual ao backend).

export type Ancora = {
  verso_inicio: number;
  verso_fim: number;
  // As linhas verso_inicio a verso_fim do poema (poema publicado não se edita).
  trecho: string;
};

export type SelecaoDeVersos = { inicio: number; fim: number };

export type VersoComentado = { verso: number; comentarios: number };

export function versosDoPoema(texto: string): string[] {
  return texto.split("\n");
}

export function trechoDosVersos(texto: string, { inicio, fim }: SelecaoDeVersos): string {
  return versosDoPoema(texto).slice(inicio - 1, fim).join("\n");
}

// "verso 5" ou "versos 5–8".
export function referenciaDosVersos({ inicio, fim }: SelecaoDeVersos): string {
  return inicio === fim ? `verso ${inicio}` : `versos ${inicio}–${fim}`;
}

// Seleção de texto com o mouse ou o toque: vira os versos inteiros, do primeiro
// ao último que ela toca, sem as linhas em branco das pontas. null: nada a comentar.
export function versosDaSelecao(texto: string, tocados: number[]): SelecaoDeVersos | null {
  const versos = versosDoPoema(texto);
  const comTexto = tocados.filter((n) => n >= 1 && n <= versos.length && versos[n - 1].trim() !== "");
  if (comTexto.length === 0) return null;
  return { inicio: Math.min(...comTexto), fim: Math.max(...comTexto) };
}

// Pelo teclado, o número de cada verso é um botão: sem seleção, seleciona aquele
// verso; com um verso só, ativá-lo de novo desfaz e ativar outro estende até ele;
// com um intervalo, recomeça no verso ativado.
export function selecionarVerso(atual: SelecaoDeVersos | null, verso: number): SelecaoDeVersos | null {
  if (atual === null || atual.inicio !== atual.fim) return { inicio: verso, fim: verso };
  if (atual.inicio === verso) return null;
  return { inicio: Math.min(atual.inicio, verso), fim: Math.max(atual.inicio, verso) };
}

// A citação começa com os versos e uma linha em branco para o comentário do leitor.
export function textoDaCitacaoDeVersos(trecho: string): string {
  return `${trecho}\n\n`;
}

// O compositor de citação existente, com os versos já no texto.
export function caminhoDaCitacaoDeVersos(postId: number, trecho: string): string {
  return `/escrever?${new URLSearchParams({ citar: String(postId), versos: trecho })}`;
}

export function criticarVersos(postId: number, texto: string, selecao: SelecaoDeVersos): Promise<Comentario> {
  return apiPost<Comentario>(`/posts/${postId}/comentarios`, {
    texto,
    parent_id: null,
    ancora: { verso_inicio: selecao.inicio, verso_fim: selecao.fim },
  });
}

// As críticas cuja âncora cobre o verso, paginadas como as raízes.
export function buscarComentariosDoVerso(postId: number, verso: number, cursor: string | null, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit), verso: String(verso) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<ComentarioPage>(`/posts/${postId}/comentarios?${params}`);
}

export function buscarVersosComentados(postId: number): Promise<{ items: VersoComentado[] }> {
  return apiGet<{ items: VersoComentado[] }>(`/posts/${postId}/comentarios/versos`);
}

// ---- Rascunhos: espelham backend/app/schemas/rascunho.py ----

// Rascunho é privado: só o autor lê; de outra pessoa, o backend responde 404.
// Só o rascunho se edita: o poema publicado é imutável.
export type Rascunho = {
  id: number;
  autor_id: number;
  titulo: string | null;
  texto: string;
  forma: string | null;
  idioma: string | null;
  // Rascunho de citação: o poema citado. Null com repost_removido = o original foi apagado.
  repost_de_id: number | null;
  repost_removido: boolean;
  created_at: string;
  updated_at: string;
};

// Os campos de um poema novo; com repost_de_id, rascunho de citação.
export type NovoRascunho = NovoPoema;

// Só os enviados mudam; o poema citado não muda.
export type EdicaoDoRascunho = Partial<Omit<NovoPoema, "repost_de_id">>;

// O editado por último primeiro.
export function listarRascunhos(offset = 0, limit = 100): Promise<Page<Rascunho>> {
  return apiGet<Page<Rascunho>>(`/rascunhos?offset=${offset}&limit=${limit}`);
}

export function buscarRascunho(id: number): Promise<Rascunho> {
  return apiGet<Rascunho>(`/rascunhos/${id}`);
}

export function criarRascunho(dados: NovoRascunho): Promise<Rascunho> {
  return apiPost<Rascunho>("/rascunhos", dados);
}

export function editarRascunho(id: number, dados: EdicaoDoRascunho): Promise<Rascunho> {
  return apiPatch<Rascunho>(`/rascunhos/${id}`, dados);
}

export function apagarRascunho(id: number): Promise<void> {
  return apiDelete(`/rascunhos/${id}`);
}

// Vira poema (ou citação) publicado agora, e o rascunho deixa de existir.
export function publicarRascunho(id: number): Promise<Post> {
  return apiPost<Post>(`/rascunhos/${id}/publicar`);
}
