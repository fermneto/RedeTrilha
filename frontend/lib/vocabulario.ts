// O vocabulário do Verso: as formas (código e rótulo) e os limites dos campos.
// O servidor é a fonte: GET /preferencias/opcoes entrega os dois (`formas` e
// `limites`), vindos de ROTULOS_DAS_FORMAS (backend/app/schemas/post.py) e de
// backend/app/core/limites.py, e as telas que já buscam as opções usam o que veio.
// Isto é a cópia de reserva, a única do front, para o que não pode esperar a
// rede: a validação do cadastro (antes do login), os seletores do compositor e
// do Explorar, o rótulo da forma num card. tests/vocabulario.test.mjs confere
// que ela bate com o backend; mudou lá, mude aqui.

// Na ordem dos seletores; o código guardado não tem acento.
export const ROTULOS_DAS_FORMAS = {
  soneto: "soneto",
  haicai: "haicai",
  trova: "trova",
  quadra: "quadra",
  cordel: "cordel",
  verso_livre: "verso livre",
  prosa_poetica: "prosa poética",
  outro: "outro",
} as const;

export type Forma = keyof typeof ROTULOS_DAS_FORMAS;

export const FORMAS = Object.keys(ROTULOS_DAS_FORMAS) as Forma[];

// Forma fora da lista (não deveria vir do backend) fica só com "_" virando espaço.
export function nomeDaForma(forma: string): string {
  return ROTULOS_DAS_FORMAS[forma as Forma] ?? forma.replace(/_/g, " ");
}

// Os limites com os nomes da API. A senha conta bytes (UTF-8), não caracteres.
export type Limites = {
  username_min: number;
  username_max: number;
  senha_min: number;
  senha_max: number;
  nome_max: number;
  bio_max: number;
  avatar_url_max: number;
  poema_titulo_max: number;
  antologia_nome_max: number;
  antologia_descricao_max: number;
  renga_titulo_max: number;
  renga_limite_padrao: number;
  renga_limite_min: number;
  renga_limite_max: number;
  renga_convidados_max: number;
  oficina_max_caracteres: number;
  mensagem_max_caracteres: number;
};

export const LIMITES: Limites = {
  username_min: 3,
  username_max: 30,
  senha_min: 8,
  senha_max: 72,
  nome_max: 80,
  bio_max: 1000,
  avatar_url_max: 500,
  poema_titulo_max: 200,
  antologia_nome_max: 100,
  antologia_descricao_max: 1000,
  renga_titulo_max: 200,
  renga_limite_padrao: 12,
  renga_limite_min: 3,
  renga_limite_max: 40,
  renga_convidados_max: 50,
  // Acima disso a oficina não marca (o poema continua sem limite).
  oficina_max_caracteres: 10_000,
  mensagem_max_caracteres: 10_000,
};

// Os caracteres do username, como _PADRAO_USERNAME em backend/app/schemas/user.py.
export const USERNAME_FORMATO = /^[a-z0-9_]+$/;

// Línguas do seletor do compositor, português primeiro (o padrão). "outra" manda
// null. É escolha da tela, não espelho: o backend aceita toda a ISO 639-1.
export const IDIOMAS_DO_COMPOSITOR = ["pt", "es", "en", "fr", "it", "de", "la"] as const;
