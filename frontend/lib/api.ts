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

// O que a tela mostra quando uma chamada falha: a mensagem do erro (no ErroDaApi,
// o `detail` do backend) ou, se não veio um Error, o texto `padrao`.
export function mensagemDeFalha(e: unknown, padrao: string): string {
  return e instanceof Error ? e.message : padrao;
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

// GETs que o backend manda com Cache-Control (backend/app/cache_http.py): respostas
// iguais para todo mundo, sem curti/sigo. Só nelas o navegador usa o próprio cache;
// o resto continua "no-store", para um clique nunca mostrar o estado antigo.
const ROTAS_COM_CACHE = new Set([
  "/tags/trending",
  "/tags/busca",
  "/acervo/filtros",
  "/preferencias/opcoes",
  "/usuarios",
]);

export function modoDeCache(method: string, path: string): RequestCache {
  const rota = path.split("?")[0];
  return method === "GET" && ROTAS_COM_CACHE.has(rota) ? "default" : "no-store";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: modoDeCache(method, path),
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

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PUT", path, body);
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
function lerData(iso: string): Date {
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
}

export function formatarData(iso: string): string {
  return lerData(iso).toLocaleDateString("pt-BR");
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
  // Citação de um poema de quem bloqueou quem vê: repost_de vem null ("poema indisponível").
  repost_indisponivel?: boolean;
  tags: string[];
  // Só no feed: quem repostou (repost puro), quem repostou por último primeiro.
  repostado_por: User[];
  // Só no "Para você": o poema subiu por um comentário ou por uma crítica nos
  // versos, e quem comentou, por último primeiro (PoemaNoFeed em schemas/feed.py).
  subiu_por?: "comentario" | "critica" | null;
  comentado_por?: User[];
};

// Com cursor, o total vem null (como na timeline do X).
// O feed e o perfil misturam poemas e rengas (ItemDoFeed, na seção das Rengas).
export type FeedPage = Omit<Page<ItemDoFeed>, "total"> & {
  total: number | null;
  proximo_cursor: string | null;
};

// Espelha ComentarioOut e ComentarioRengaOut (backend/app/schemas/comentario.py),
// que só diferem no alvo (`post_id` ou `renga_id`). `respostas` é só a prévia
// (até 3); `total_respostas` conta todas as respostas diretas.
// Removido: texto vazio e autor null.
export type ComentarioNaArvore = {
  id: number;
  texto: string;
  autor: User | null;
  parent_id: number | null;
  created_at: string;
  removido: boolean;
  total_respostas: number;
  respostas: ComentarioNaArvore[];
  // Crítica ancorada em versos (só no 1º nível); ver a seção no fim do arquivo.
  ancora: Ancora | null;
};

export type Comentario = ComentarioNaArvore & { post_id: number; respostas: Comentario[] };
export type ComentarioDaRenga = ComentarioNaArvore & { renga_id: number; respostas: ComentarioDaRenga[] };

// Espelha ComentarioPage e ComentarioRengaPage: respostas diretas em ordem cronológica, por cursor.
export type ComentarioPage = {
  items: ComentarioNaArvore[];
  total: number;
  limit: number;
  proximo_cursor: string | null;
};

// O que recebe os comentários: um poema (/posts/{id}/comentarios) ou uma renga
// (/rengas/{id}/comentarios). As regras e o formato são os mesmos.
export type AlvoDosComentarios = { tipo: "poema" | "renga"; id: number };

export function caminhoDosComentarios({ tipo, id }: AlvoDosComentarios): string {
  return tipo === "poema" ? `/posts/${id}/comentarios` : `/rengas/${id}/comentarios`;
}

// Um comentário já criado: no poema, pelo id só (/comentarios/{id}); na renga,
// dentro dela (/rengas/{renga}/comentarios/{id}).
export function caminhoDoComentario(alvo: AlvoDosComentarios, comentarioId: number): string {
  return alvo.tipo === "poema" ? `/comentarios/${comentarioId}` : `${caminhoDosComentarios(alvo)}/${comentarioId}`;
}

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

// A grade de quem seguir como último passo do onboarding, em tela cheia.
export const QUEM_SEGUIR_NO_ONBOARDING = "/boas-vindas/quem-seguir";

// As preferências fora do onboarding: a mesma página de /boas-vindas, mas dentro do
// layout do site (com a navegação e a coluna Descobrir).
export const PREFERENCIAS = "/preferencias";

// As telas do onboarding ocupam a tela toda, sem a navegação nem a coluna
// Descobrir: o Layout confere com isto. As /preferencias ficam com o layout do site.
export function ehTelaDeBoasVindas(caminho: string): boolean {
  return caminho === "/boas-vindas" || caminho.startsWith("/boas-vindas/");
}

// "/preferencias?voltar=<página atual>": as preferências pelo menu da conta, que
// voltam para onde a pessoa estava. Vindo do próprio onboarding, volta ao perfil.
export function caminhoDasPreferencias(atual: string, username: string): string {
  const noOnboarding = /^\/(boas-vindas|sugestoes|preferencias)(?=[/?#]|$)/.test(atual);
  const voltar = noOnboarding ? `/u/${username}` : atual;
  return `${PREFERENCIAS}?voltar=${encodeURIComponent(voltar)}`;
}

// Só o passo dos gostos (escolas e formas), pelo link da grade de quem seguir: ao
// salvar volta para a grade, que recalcula as sugestões. Da grade do onboarding
// continua em tela cheia; da /sugestoes, dentro do layout do site.
export function caminhoDosGostos(grade: string): string {
  const base = ehTelaDeBoasVindas(grade) ? "/boas-vindas" : PREFERENCIAS;
  return `${base}?voltar=${encodeURIComponent(grade)}&so=gostos`;
}

// O documento foi carregado já nas preferências (link direto ou recarga)? Então não
// há página do Verso antes no histórico, e o "cancelar" vai ao perfil em vez de usar
// o voltar do navegador. Recebe a URL do carregamento
// (performance.getEntriesByType("navigation")[0].name).
export function abertaDireto(urlDoCarregamento: string | undefined): boolean {
  if (!urlDoCarregamento) return true;
  try {
    const { pathname } = new URL(urlDoCarregamento);
    return pathname === "/boas-vindas" || pathname === PREFERENCIAS;
  } catch {
    return true;
  }
}

export type PassoDasPreferencias = "gostos" | "regiao";

// Os passos de /boas-vindas: os dois, ou só os gostos com ?so=gostos.
export function passosDasPreferencias(so: string | null): PassoDasPreferencias[] {
  return so === "gostos" ? ["gostos"] : ["gostos", "regiao"];
}

// Em que passo abrir: o de ?passo= (o "voltar" da grade de quem seguir abre na
// região), ou o primeiro.
export function passoInicial(passos: PassoDasPreferencias[], passo: string | null): number {
  return Math.max(0, passos.indexOf(passo as PassoDasPreferencias));
}

export function buscarFeed(cursor: string | null, limit = 20): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<FeedPage>(`/feed?${params}`);
}

// Aba "Para você": a rede inteira (seguidos ou não), cronológica pela atividade.
// `lingua` (a do navegador) escolhe o consagrado de cada janela de 3 h.
export function buscarParaVoce(cursor: string | null, limit = 20): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  comLinguaDoNavegador(params);
  return apiGet<FeedPage>(`/feed/para-voce?${params}`);
}

// O rótulo do poema que subiu por comentário: o card mostra os 2 primeiros nomes,
// "e mais N" (`resto`) e o verbo: "ana comentou", "ana e bia comentaram", "ana, bia e
// mais 2 criticaram os versos". null = sem rótulo.
export function rotuloDoComentario(
  post: Pick<Post, "subiu_por" | "comentado_por">,
): { resto: number; verbo: string } | null {
  const por = post.comentado_por ?? [];
  if (!post.subiu_por || por.length === 0) return null;
  const plural = por.length > 1;
  const verbo =
    post.subiu_por === "critica"
      ? plural ? "criticaram os versos" : "criticou os versos"
      : plural ? "comentaram" : "comentou";
  return { resto: Math.max(0, por.length - 2), verbo };
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

// Comentários na raiz do poema ou da renga, cada um com a prévia das respostas.
export function buscarComentarios(alvo: AlvoDosComentarios, cursor: string | null, limit = 20) {
  return paginaDeComentarios(caminhoDosComentarios(alvo), cursor, limit);
}

// Respostas diretas de um comentário ("ver mais respostas").
export function buscarRespostas(alvo: AlvoDosComentarios, comentarioId: number, cursor: string | null, limit = 20) {
  return paginaDeComentarios(`${caminhoDoComentario(alvo, comentarioId)}/respostas`, cursor, limit);
}

export function comentar(alvo: AlvoDosComentarios, texto: string, parentId: number | null): Promise<ComentarioNaArvore> {
  return apiPost<ComentarioNaArvore>(caminhoDosComentarios(alvo), { texto, parent_id: parentId });
}

// Espelha ComentarioApagadoOut: "apagado" saiu do banco (não tinha respostas);
// "removido" virou o marcador. `total_respostas` é a contagem atual do backend.
export type ComentarioApagado = {
  resultado: "apagado" | "removido";
  total_respostas: number;
};

export function apagarComentario(alvo: AlvoDosComentarios, id: number): Promise<ComentarioApagado> {
  return apiDelete<ComentarioApagado>(caminhoDoComentario(alvo, id));
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
// `trecho` é o primeiro verso do poema mais novo com a tag, com o recuo de quem
// escreveu; null quando não há verso com texto (e ausente num backend antigo).
export type TagContagem = { tag: string; contagem: number; trecho?: string | null };

// `limit` de 1 a 10 (padrão 5, o da coluna direita; o Explorar pede 10).
export function buscarTrending(limit = 5): Promise<{ items: TagContagem[] }> {
  return apiGet<{ items: TagContagem[] }>(`/tags/trending?limit=${limit}`);
}

// Espelha BuscaDeTags: GET /tags/busca?q= devolve até 5 tags que começam pelo
// termo (normalizado no backend), com quantos poemas cada uma tem.
export type TagEncontrada = { tag: string; poemas: number };

export function buscarTags(q: string): Promise<{ items: TagEncontrada[] }> {
  return apiGet<{ items: TagEncontrada[] }>(`/tags/busca?${new URLSearchParams({ q })}`);
}

// Poetas da busca do Explorar: a mesma busca do Acervo (GET /acervo?q=, nome ou
// @username, sem acento), como na tela Quem seguir, só com menos resultados e
// quem eu sigo primeiro (sigo_primeiro), depois em ordem alfabética.
export const POETAS_NA_BUSCA = 5;

export function buscarPoetas(q: string): Promise<Page<PoetaDoAcervo>> {
  const params = new URLSearchParams({ q, offset: "0", limit: String(POETAS_NA_BUSCA), sigo_primeiro: "true" });
  return apiGet<Page<PoetaDoAcervo>>(`/acervo?${params}`);
}

// "ver todos no Acervo": a tela do Acervo já abre com a busca pelo ?q=.
export function caminhoDoAcervoComBusca(q: string): string {
  return `/acervo?${new URLSearchParams({ q: q.trim() })}`;
}

// O que o campo do Explorar procura: a tag (normalizada, sem o "#") e o nome ou
// @username do poeta. "#saudade" procura só tags; "@ana", só poetas.
export function termosDaBusca(texto: string): { tag: string; poeta: string } {
  const limpo = texto.trim();
  if (limpo.startsWith("#")) return { tag: normalizarTag(limpo), poeta: "" };
  if (limpo.startsWith("@")) return { tag: "", poeta: limpo.slice(1).trim() };
  return { tag: normalizarTag(limpo), poeta: limpo };
}

// Seta para cima e para baixo na lista de resultados: dá a volta nas pontas, e
// -1 (nenhuma opção ativa) vai para a primeira ou para a última.
export function opcaoVizinha(atual: number, total: number, passo: 1 | -1): number {
  if (total === 0) return -1;
  if (atual < 0) return passo === 1 ? 0 : total - 1;
  return (atual + passo + total) % total;
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

// Espelha SugestaoOut (backend/app/schemas/sugestao.py): o cartão do Acervo mais
// as escolas da conta (códigos de ESCOLAS; os rótulos vêm de buscarOpcoesDePreferencias).
export type Sugestao = PoetaDoAcervo & { escolas: string[] };

// Ordem pela nota do backend (core/pontuacao_sugestoes.py); `lingua` é a do navegador.
export function buscarSugestoes(offset = 0, limit = 20): Promise<Page<Sugestao>> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  comLinguaDoNavegador(params);
  return apiGet<Page<Sugestao>>(`/sugestoes?${params}`);
}

// ---- Preferências do onboarding: espelham backend/app/schemas/preferencia.py ----

export type Preferencias = {
  escolas: string[];
  formas: string[];
  // ISO 3166-1 alfa-2; a UF só com "BR".
  pais: string | null;
  uf: string | null;
};

export type Opcao = { codigo: string; rotulo: string };

// O vocabulário vem do backend: escolas com rótulo, formas, códigos de país e UFs.
export type OpcoesDePreferencias = { escolas: Opcao[]; formas: string[]; paises: string[]; ufs: Opcao[] };

export function buscarPreferencias(): Promise<Preferencias> {
  return apiGet<Preferencias>("/preferencias");
}

// PUT: troca tudo; o que não vier volta ao vazio.
export function salvarPreferencias(dados: Preferencias): Promise<Preferencias> {
  return apiPut<Preferencias>("/preferencias", dados);
}

export function buscarOpcoesDePreferencias(): Promise<OpcoesDePreferencias> {
  return apiGet<OpcoesDePreferencias>("/preferencias/opcoes");
}

// Nome do país em português ("PT" → "Portugal"); o próprio código se o navegador não souber.
export function nomeDoPais(codigo: string): string {
  try {
    return new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

// Alterna um código numa multisseleção (chips das escolas e das formas).
export function alternarNaLista(lista: string[], codigo: string): string[] {
  return lista.includes(codigo) ? lista.filter((c) => c !== codigo) : [...lista, codigo];
}

// Evento de window disparado depois de seguir ou deixar de seguir alguém: o feed
// Seguindo, que fica montado na home, recarrega a lista quando o recebe.
export const EVENTO_SEGUIR_MUDOU = "verso:seguir-mudou";

export async function seguir(username: string, seguindo: boolean): Promise<void> {
  const caminho = `/usuarios/${encodeURIComponent(username)}/follow`;
  await (seguindo ? apiPost<void>(caminho) : apiDelete(caminho));
  window.dispatchEvent(new Event(EVENTO_SEGUIR_MUDOU));
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

// `?lingua=` com a língua do navegador, se for um código ISO 639-1; sem ela, o
// backend usa a língua dos poemas da própria pessoa.
function comLinguaDoNavegador(params: URLSearchParams): void {
  const lingua = idiomaDoNavegador();
  if (lingua && /^[a-z]{2}$/.test(lingua)) params.set("lingua", lingua);
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

// As públicas de todo mundo com ao menos um poema, a mais nova primeiro (aba do Explorar).
export function listarAntologiasPublicas(offset = 0, limit = 20): Promise<Page<Antologia>> {
  return apiGet<Page<Antologia>>(`/antologias/publicas?offset=${offset}&limit=${limit}`);
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

export const TIPOS_DO_ACERVO = ["todos", "consagrados", "do_verso"] as const;
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
  // Comentários e respostas na renga, como o `comentarios` do poema.
  comentarios: number;
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

// A mais nova primeiro; sem `situacao`, abertas e fechadas juntas. Com `minhas`, só
// as que criei, em que escrevi ou para as quais fui convidado.
export function listarRengas(
  situacao: SituacaoDaRenga | null,
  offset = 0,
  limit = 20,
  minhas = false,
): Promise<Page<Renga>> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (situacao) params.set("situacao", situacao);
  if (minhas) params.set("minhas", "true");
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

// Se a crítica ancorada cobre o verso do filtro. Sem filtro (null), tudo entra;
// com filtro, comentário sem âncora não entra.
export function ancoraCobreOVerso(ancora: Ancora | null, verso: number | null): boolean {
  if (verso === null) return true;
  return ancora !== null && ancora.verso_inicio <= verso && verso <= ancora.verso_fim;
}

// Seleção de texto com o mouse ou o toque: vira os versos inteiros, do primeiro
// ao último que ela toca, sem as linhas em branco das pontas. null: nada a comentar.
export function versosDaSelecao(texto: string, tocados: number[]): SelecaoDeVersos | null {
  const versos = versosDoPoema(texto);
  const comTexto = tocados.filter((n) => n >= 1 && n <= versos.length && versos[n - 1].trim() !== "");
  if (comTexto.length === 0) return null;
  return { inicio: Math.min(...comTexto), fim: Math.max(...comTexto) };
}

// Os versos (o data-verso de cada linha) que a seleção do navegador toca, mesmo em
// parte. Serve à página do poema e ao corpo do poema nos cards.
export function versosTocados(
  selecao: { isCollapsed: boolean; containsNode(no: Node, parcial: boolean): boolean },
  linhas: Iterable<HTMLElement>,
): number[] {
  if (selecao.isCollapsed) return [];
  return Array.from(linhas)
    .filter((linha) => selecao.containsNode(linha, true))
    .map((linha) => Number(linha.dataset.verso));
}

// "comentar estes versos" num card: a página do poema abre com eles selecionados
// e o campo de comentário pronto (/poema/7?versos=2-4, ou ?versos=3 para um só).
export function caminhoDaCriticaDeVersos(postId: number, selecao: SelecaoDeVersos): string {
  return `/poema/${postId}?${parametroDosVersos(selecao)}`;
}

// Lê o ?versos= da página do poema (ou da renga) contra o texto dele (sem as marcas). Só vale um
// intervalo dentro do poema que comece e termine em verso com texto, como os que a
// seleção produz; qualquer outra coisa é null (a página ignora em silêncio).
export function lerVersosDaUrl(valor: string | null, texto: string): SelecaoDeVersos | null {
  const partes = /^(\d{1,6})(?:-(\d{1,6}))?$/.exec(valor ?? "");
  if (!partes) return null;
  const inicio = Number(partes[1]);
  const fim = Number(partes[2] ?? partes[1]);
  const versos = versosDoPoema(texto);
  if (inicio < 1 || inicio > fim || fim > versos.length) return null;
  if (versos[inicio - 1].trim() === "" || versos[fim - 1].trim() === "") return null;
  return { inicio, fim };
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

export function criticarVersos(
  alvo: AlvoDosComentarios,
  texto: string,
  selecao: SelecaoDeVersos,
): Promise<ComentarioNaArvore> {
  return apiPost<ComentarioNaArvore>(caminhoDosComentarios(alvo), {
    texto,
    parent_id: null,
    ancora: { verso_inicio: selecao.inicio, verso_fim: selecao.fim },
  });
}

// As críticas cuja âncora cobre o verso, paginadas como as raízes.
export function buscarComentariosDoVerso(alvo: AlvoDosComentarios, verso: number, cursor: string | null, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit), verso: String(verso) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<ComentarioPage>(`${caminhoDosComentarios(alvo)}?${params}`);
}

export function buscarVersosComentados(alvo: AlvoDosComentarios): Promise<{ items: VersoComentado[] }> {
  return apiGet<{ items: VersoComentado[] }>(`${caminhoDosComentarios(alvo)}/versos`);
}

// ---- Crítica ancorada na renga: os versos contam as estrofes juntas, em ordem,
// com uma linha em branco entre elas (texto_de em backend/app/services/rengas.py).
// Estrofe só se acrescenta no fim: os números já comentados não mudam.

export function textoDaRenga(estrofes: { texto: string }[]): string {
  return estrofes.map((e) => e.texto).join("\n\n");
}

// O número do último verso de cada estrofe, na ordem, no texto da renga: é onde
// a página põe o autor da estrofe.
export function fimDasEstrofes(estrofes: { texto: string }[]): number[] {
  const fins: number[] = [];
  let inicio = 1;
  for (const { texto } of estrofes) {
    const fim = inicio + versosDoPoema(texto).length - 1;
    fins.push(fim);
    inicio = fim + 2;
  }
  return fins;
}

// "comentar estes versos" no card da renga: /rengas/3?versos=2-4, como no poema.
export function caminhoDaCriticaNaRenga(rengaId: number, selecao: SelecaoDeVersos): string {
  return `/rengas/${rengaId}?${parametroDosVersos(selecao)}`;
}

function parametroDosVersos({ inicio, fim }: SelecaoDeVersos): string {
  return `versos=${inicio === fim ? inicio : `${inicio}-${fim}`}`;
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

// Quando o rascunho foi mexido pela última vez: "hoje, 14:32", "ontem, 09:05" ou
// "12/11/2026", no fuso de quem lê.
export function quandoEditado(iso: string, agora: Date = new Date()): string {
  const data = lerData(iso);
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((dia(agora) - dia(data)) / 86_400_000);
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (dias === 0) return `hoje, ${hora}`;
  if (dias === 1) return `ontem, ${hora}`;
  return data.toLocaleDateString("pt-BR");
}

// O começo do rascunho na lista: os primeiros `quantos` versos, sem as linhas em
// branco do começo e do fim (as do meio, entre estrofes, ficam). `versos` conta as
// linhas com texto do rascunho inteiro; `cortado` diz se ficou verso de fora.
export function previaDoRascunho(texto: string, quantos: number): { previa: string; versos: number; cortado: boolean } {
  const linhas = texto.split("\n");
  while (linhas.length > 0 && !linhas[0].trim()) linhas.shift();
  while (linhas.length > 0 && !linhas[linhas.length - 1].trim()) linhas.pop();
  const versos = linhas.filter((l) => l.trim()).length;
  const mostradas = linhas.slice(0, quantos);
  while (mostradas.length > 0 && !mostradas[mostradas.length - 1].trim()) mostradas.pop();
  return { previa: mostradas.join("\n"), versos, cortado: mostradas.length < linhas.length };
}

// ---- Mensagens diretas: espelham backend/app/schemas/mensagem.py ----

// LIMITE_TEXTO_MENSAGEM do backend.
export const MENSAGEM_MAX_CARACTERES = 10_000;

export type SituacaoDaConversa = "caixa" | "pedido" | "recusada";
export type AbaDaCaixa = "conversas" | "pedidos";

// O texto vem como foi escrito, com as quebras de linha. `post` é o poema
// compartilhado; apagado pelo autor, vem null com `post_removido`.
export type Mensagem = {
  id: number;
  conversa_id: number;
  autor_id: number;
  texto: string;
  post: Post | null;
  post_removido: boolean;
  created_at: string;
};

// Da mais antiga para a mais nova. Sem `depois`, `proximo_cursor` é o `antes` das
// mais antigas; com `depois`, é o próximo `depois`.
export type MensagemPage = { items: Mensagem[]; limit: number; proximo_cursor: string | null };

export type ConversaNaCaixa = {
  id: number;
  outro: User;
  situacao: SituacaoDaConversa;
  silenciada: boolean;
  ultima_mensagem: Mensagem | null;
  nao_lidas: number;
};

export type CaixaPage = { items: ConversaNaCaixa[]; limit: number; proximo_cursor: string | null };

export type Conversa = {
  id: number;
  outro: User;
  situacao: SituacaoDaConversa;
  silenciada: boolean;
  bloqueei: boolean;
  pode_responder: boolean;
  motivo: string | null;
  ultima_lida_id: number;
  // Até onde o outro leu; null enquanto a conversa é um pedido para ele.
  visto_ate: number | null;
};

export type ResumoDeMensagens = { nao_lidas: number; pedidos: number };

export function listarConversas(aba: AbaDaCaixa, cursor: string | null, limit = 20): Promise<CaixaPage> {
  const params = new URLSearchParams({ aba, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<CaixaPage>(`/mensagens/conversas?${params}`);
}

export function buscarResumoDeMensagens(): Promise<ResumoDeMensagens> {
  return apiGet<ResumoDeMensagens>("/mensagens/resumo");
}

export function abrirConversa(username: string): Promise<Conversa> {
  return apiPost<Conversa>("/mensagens/conversas", { username });
}

export function buscarConversa(id: number): Promise<Conversa> {
  return apiGet<Conversa>(`/mensagens/conversas/${id}`);
}

export function buscarMensagens(
  id: number,
  posicao: { antes?: number; depois?: number } = {},
  limit = 30,
): Promise<MensagemPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (posicao.antes !== undefined) params.set("antes", String(posicao.antes));
  if (posicao.depois !== undefined) params.set("depois", String(posicao.depois));
  return apiGet<MensagemPage>(`/mensagens/conversas/${id}/mensagens?${params}`);
}

export function enviarMensagem(id: number, texto: string, postId: number | null = null): Promise<Mensagem> {
  return apiPost<Mensagem>(`/mensagens/conversas/${id}/mensagens`, { texto, post_id: postId });
}

export function marcarLida(id: number, ate?: number): Promise<void> {
  return apiPost(`/mensagens/conversas/${id}/lida`, ate === undefined ? {} : { ate });
}

export function aceitarPedido(id: number): Promise<void> {
  return apiPost(`/mensagens/conversas/${id}/aceitar`);
}

export function recusarPedido(id: number): Promise<void> {
  return apiPost(`/mensagens/conversas/${id}/recusar`);
}

export function silenciarConversa(id: number, silenciar: boolean): Promise<void> {
  const caminho = `/mensagens/conversas/${id}/silenciar`;
  return silenciar ? apiPost(caminho) : apiDelete(caminho);
}

// Se eu bloqueei a pessoa (o perfil mostra "Desbloquear"). Quem me bloqueou dá 404.
export function buscarBloqueio(username: string): Promise<{ bloqueei: boolean }> {
  return apiGet<{ bloqueei: boolean }>(`/usuarios/${encodeURIComponent(username)}/bloqueio`);
}

// Bloquear vale para a rede inteira, como no X (DECISIONS.md, decisão 13).
export function bloquear(username: string, bloqueado: boolean): Promise<void> {
  const caminho = `/usuarios/${encodeURIComponent(username)}/bloqueio`;
  return bloqueado ? apiPost(caminho) : apiDelete(caminho);
}

// A linha da caixa: o começo da mensagem (primeira linha com texto) ou o poema
// que ela leva, com "Você: " quando fui eu que mandei.
export function previaDaMensagem(mensagem: Mensagem | null, euId: number | null): string {
  if (!mensagem) return "";
  const linha = mensagem.texto.split("\n").find((l) => l.trim()) ?? "";
  const poema = mensagem.post
    ? `poema${mensagem.post.titulo ? `: ${mensagem.post.titulo}` : ` de @${mensagem.post.autor.username}`}`
    : mensagem.post_removido
      ? "poema removido pelo autor"
      : "";
  const corpo = linha.trim() || poema;
  return mensagem.autor_id === euId ? `Você: ${corpo}` : corpo;
}

// "Visto" ou "Enviada" embaixo da minha última mensagem, como no X: visto quando
// o outro leu até ela. null quando a última mensagem da conversa não é minha.
export function situacaoDaMinhaUltima(
  mensagens: Mensagem[],
  euId: number,
  vistoAte: number | null,
): { id: number; rotulo: "Visto" | "Enviada" } | null {
  const ultima = mensagens[mensagens.length - 1];
  if (!ultima || ultima.autor_id !== euId) return null;
  return { id: ultima.id, rotulo: vistoAte !== null && vistoAte >= ultima.id ? "Visto" : "Enviada" };
}

// ---- Tempo real das mensagens (GET /mensagens/stream, Server-Sent Events) ----
// O EventSource não manda o header Authorization, e o token nunca vai na URL (ficaria
// nos logs do proxy e no histórico). Por isso o stream é um fetch com o token no
// header, lido aos pedaços pelo ReadableStream, com a reconexão feita aqui.

export type EventoDeMensagem =
  // "conectou": o stream (re)abriu ou pediu para ressincronizar. Quem ouve busca o
  // que pode ter perdido pelas rotas normais (`depois=`), como depois de uma queda.
  | { tipo: "conectou" }
  | { tipo: "mensagem" | "pedido"; conversa_id: number; mensagem_id: number }
  | { tipo: "lida"; conversa_id: number; leitor_id: number; ultima_lida_id: number }
  | { tipo: "conversa"; conversa_id: number }
  // Os avisos (curtidas, seguidores, comentários...) vêm pelo mesmo stream: só o
  // sinal, e quem ouve busca o contador e a lista pelas rotas de /avisos.
  | { tipo: "aviso" };

// Separa os eventos completos (terminados em linha em branco) do pedaço que ainda
// não chegou inteiro. Linhas de comentário (": batida") não viram evento.
export function lerEventosDoStream(buffer: string): { eventos: { tipo: string; dados: string }[]; resto: string } {
  const blocos = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const resto = blocos.pop() ?? "";
  const eventos = [];
  for (const bloco of blocos) {
    let tipo = "message";
    const dados: string[] = [];
    for (const linha of bloco.split("\n")) {
      if (linha.startsWith("event:")) tipo = linha.slice(6).trim();
      else if (linha.startsWith("data:")) dados.push(linha.slice(5).trimStart());
    }
    if (dados.length > 0) eventos.push({ tipo, dados: dados.join("\n") });
  }
  return { eventos, resto };
}

// Espera antes da tentativa `n` de reconectar: 1 s, 2 s, 4 s... até 30 s.
export function esperaDaReconexao(tentativa: number): number {
  return Math.min(30_000, 1000 * 2 ** tentativa);
}

const ouvintesDoStream = new Set<(evento: EventoDeMensagem) => void>();
let streamAberto: AbortController | null = null;

function avisarOuvintes(evento: EventoDeMensagem) {
  for (const ouvinte of ouvintesDoStream) ouvinte(evento);
}

// Um stream por aba, dividido entre quem ouve (a navegação e a página aberta).
async function manterStream(controle: AbortController): Promise<void> {
  let tentativa = 0;
  while (!controle.signal.aborted) {
    try {
      const res = await fetch(`${BASE}/mensagens/stream`, {
        headers: headers(),
        signal: controle.signal,
        cache: "no-store",
      });
      // Sem sessão: não adianta tentar de novo (o request() comum leva ao login).
      if (res.status === 401) return;
      if (res.ok && res.body) {
        const leitor = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await leitor.read();
          if (done) break;
          const lido = lerEventosDoStream(buffer + value);
          buffer = lido.resto;
          for (const { tipo, dados } of lido.eventos) {
            if (tipo === "pronto" || tipo === "ressincronizar") {
              tentativa = 0;
              avisarOuvintes({ tipo: "conectou" });
            } else {
              avisarOuvintes({ tipo, ...JSON.parse(dados) } as EventoDeMensagem);
            }
          }
        }
      }
    } catch {
      // rede caiu, servidor reiniciou ou o stream foi fechado de propósito
    }
    if (controle.signal.aborted) return;
    // Um pouco de sorteio: depois de um restart, as abas não voltam todas juntas.
    const espera = esperaDaReconexao(tentativa++) * (0.75 + Math.random() * 0.5);
    await new Promise((pronto) => setTimeout(pronto, espera));
  }
}

// Assina os eventos de mensagem; devolve a função que cancela (para o useEffect).
// O stream abre com o primeiro ouvinte e fecha quando o último sai.
export function ouvirMensagens(aoEvento: (evento: EventoDeMensagem) => void): () => void {
  ouvintesDoStream.add(aoEvento);
  if (!streamAberto && temToken()) {
    const controle = new AbortController();
    streamAberto = controle;
    void manterStream(controle).finally(() => {
      if (streamAberto === controle) streamAberto = null;
    });
  }
  return () => {
    ouvintesDoStream.delete(aoEvento);
    if (ouvintesDoStream.size === 0 && streamAberto) {
      streamAberto.abort();
      streamAberto = null;
    }
  };
}

// Para quem mandar um poema: poetas do Verso (consagrados não recebem mensagens),
// quem eu sigo primeiro.
export function buscarQuemRecebeMensagem(q: string): Promise<Page<PoetaDoAcervo>> {
  const params = new URLSearchParams({ q, tipo: "do_verso", offset: "0", limit: "6", sigo_primeiro: "true" });
  return apiGet<Page<PoetaDoAcervo>>(`/acervo?${params}`);
}

// ---- Avisos (DECISIONS.md, decisão 16) ----
// Curtidas, seguidores, reposts, citações, comentários, críticas, respostas e
// rengas. Chegam pelo stream das mensagens (evento "aviso"); as curtidas e os
// reposts de um mesmo poema vêm numa linha só.

export type TipoDeAviso =
  | "curtida"
  | "seguidor"
  | "repost"
  | "citacao"
  | "comentario"
  | "critica"
  | "resposta"
  | "estrofe"
  | "convite";

export type Aviso = {
  id: number;
  tipo: TipoDeAviso;
  created_at: string;
  lido: boolean;
  atores: User[];
  total_atores: number;
  post_id: number | null;
  renga_id: number | null;
  comentario_id: number | null;
  titulo: string | null;
  trecho: string;
  verso_inicio: number | null;
  verso_fim: number | null;
};

export type AvisoPage = { items: Aviso[]; limit: number; proximo_cursor: string | null };

export function listarAvisos(cursor: string | null, limit = 20): Promise<AvisoPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiGet<AvisoPage>(`/avisos?${params}`);
}

export function buscarResumoDeAvisos(): Promise<{ nao_lidos: number }> {
  return apiGet<{ nao_lidos: number }>("/avisos/resumo");
}

// Marca como lidos até o aviso mais recente que a tela mostrou (o que chegou
// depois continua aceso).
export function marcarAvisosLidos(ate?: number): Promise<void> {
  return apiPost("/avisos/lidos", ate === undefined ? {} : { ate });
}

// "Ana", "Ana e Bia", "Ana e mais 3": quem fez, na frase do aviso.
export function quemNoAviso(aviso: Aviso): string {
  const [primeiro, segundo] = aviso.atores.map((u) => u.name);
  if (!primeiro) return "Alguém";
  const resto = aviso.total_atores - 1;
  if (resto <= 0) return primeiro;
  if (resto === 1 && segundo) return `${primeiro} e ${segundo}`;
  return `${primeiro} e mais ${resto}`;
}

// O que aconteceu, depois de quem: "curtiu seu poema", "criticou os versos 5–8 da renga".
export function acaoDoAviso(aviso: Aviso): string {
  const varios = aviso.total_atores > 1;
  const versos =
    aviso.verso_inicio === null
      ? ""
      : aviso.verso_inicio === aviso.verso_fim
        ? `o verso ${aviso.verso_inicio}`
        : `os versos ${aviso.verso_inicio}–${aviso.verso_fim}`;
  const naRenga = aviso.renga_id !== null;
  switch (aviso.tipo) {
    case "curtida":
      return varios ? "curtiram seu poema" : "curtiu seu poema";
    case "repost":
      return varios ? "repostaram seu poema" : "repostou seu poema";
    case "seguidor":
      return "começou a seguir você";
    case "citacao":
      return "citou seu poema";
    case "comentario":
      return naRenga ? "comentou na renga" : "comentou seu poema";
    case "critica":
      return naRenga ? `criticou ${versos} da renga` : `criticou ${versos} do seu poema`;
    case "resposta":
      return "respondeu ao seu comentário";
    case "estrofe":
      return "escreveu uma estrofe na renga";
    case "convite":
      return "convidou você para uma renga";
  }
}

// Para onde a linha leva: o poema (com ?versos= na crítica), a renga ou o perfil.
export function linkDoAviso(aviso: Aviso): string {
  if (aviso.tipo === "seguidor") return `/u/${encodeURIComponent(aviso.atores[0]?.username ?? "")}`;
  const base = aviso.renga_id !== null ? `/rengas/${aviso.renga_id}` : `/poema/${aviso.post_id}`;
  if (aviso.tipo === "critica" && aviso.verso_inicio !== null) {
    return `${base}?versos=${aviso.verso_inicio}-${aviso.verso_fim}`;
  }
  return base;
}

// "agora", "5 min", "3 h", "2 d" e, passada uma semana, a data.
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const segundos = Math.max(0, (agora.getTime() - lerData(iso).getTime()) / 1000);
  if (segundos < 60) return "agora";
  if (segundos < 3600) return `${Math.floor(segundos / 60)} min`;
  if (segundos < 86_400) return `${Math.floor(segundos / 3600)} h`;
  if (segundos < 7 * 86_400) return `${Math.floor(segundos / 86_400)} d`;
  return formatarData(iso);
}
