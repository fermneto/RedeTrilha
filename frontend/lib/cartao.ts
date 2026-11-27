// O resumo de um poema para o cartão de compartilhamento (Open Graph): o título,
// os primeiros versos e a descrição, sem as marcas de formatação (**, *, ++, ~~).
// Funções puras, testadas em tests/cartao.test.mjs; quem busca os dados e desenha
// a imagem é lib/cartaoServidor.tsx.
//
// Só importa ./marcas: o teste transpila os dois arquivos e liga um ao outro.
import { textoSemMarcas } from "./marcas";

// O endereço público do site (metadataBase) e o texto que apresenta o Verso nos
// metadados, no manifest e nos cartões.
export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://verso.net.br";
export const NOME = "Verso";
export const DESCRICAO =
  "Rede social de poemas para quem lê e escreve poesia: publique o poema inteiro, converse sobre cada verso e leia os clássicos no mesmo feed.";

// Quantos versos cabem na imagem de 1200 × 630 e até onde vai um verso antes do "…".
const VERSOS_NO_CARTAO = 8;
const LARGURA_DO_VERSO = 64;
// A description do Open Graph: o WhatsApp e o X mostram umas duas linhas.
const LARGURA_DA_DESCRICAO = 160;

const RETICENCIAS = "…";

// Corta no último espaço antes do limite, quando houver um perto, e põe "…".
export function encurtar(texto: string, limite: number): string {
  const limpo = texto.trimEnd();
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite - 1);
  const espaco = corte.lastIndexOf(" ");
  const base = espaco > limite * 0.6 ? corte.slice(0, espaco) : corte;
  return base.trimEnd().replace(/[\s,;:./—–-]+$/, "") + RETICENCIAS;
}

type Versos = { versos: string[]; cortado: boolean };

// Os primeiros versos, com as quebras e os recuos do poema. Pula as linhas em
// branco do começo, junta duas ou mais linhas em branco seguidas numa só (a
// separação de estrofe) e não termina numa linha em branco. Verso longo demais
// para a imagem leva "…" no fim. `cortado` diz se o poema continua.
// `tirarMarcas` falso para o texto que já vem sem elas (os versos de /cartoes).
export function primeirosVersos(
  texto: string,
  maximo = VERSOS_NO_CARTAO,
  largura = LARGURA_DO_VERSO,
  tirarMarcas = true,
): Versos {
  const linhas = (tirarMarcas ? textoSemMarcas(texto) : texto).replace(/\r\n?/g, "\n").split("\n");
  const versos: string[] = [];
  let i = 0;
  while (i < linhas.length && linhas[i].trim() === "") i++;
  for (; i < linhas.length && versos.length < maximo; i++) {
    const vazia = linhas[i].trim() === "";
    if (vazia && (versos.length === 0 || versos[versos.length - 1] === "")) continue;
    versos.push(vazia ? "" : encurtar(linhas[i].replace(/\t/g, "    "), largura));
  }
  while (versos.length > 0 && versos[versos.length - 1] === "") versos.pop();
  const resto = linhas.slice(i).some((l) => l.trim() !== "");
  return { versos, cortado: resto };
}

// O título do poema; sem título, o primeiro verso (como se cita um poema sem nome).
export function tituloDoPoema(
  poema: { titulo: string | null; texto: string },
  largura = 80,
  tirarMarcas = true,
): string {
  const titulo = poema.titulo ? (tirarMarcas ? textoSemMarcas(poema.titulo) : poema.titulo).trim() : "";
  if (titulo) return encurtar(titulo, largura);
  const [primeiro] = primeirosVersos(poema.texto, 1, largura, tirarMarcas).versos;
  // O verso vira título: sem a vírgula ou o travessão que o ligava ao seguinte.
  return primeiro ? primeiro.trim().replace(/(\S)[\s,;:—–-]+$/, "$1") : "Poema sem título";
}

// A description: o começo do poema numa linha só, com " / " entre os versos, como
// se cita poesia em prosa, e " // " entre as estrofes.
export function descricaoDoPoema(texto: string, largura = LARGURA_DA_DESCRICAO, tirarMarcas = true): string {
  const { versos } = primeirosVersos(texto, 12, largura, tirarMarcas);
  const corrido = versos
    .map((v) => v.trim())
    .join(" / ")
    .replace(/ \/  \/ /g, " // ");
  return encurtar(corrido, largura);
}

// Árabe, persa, urdu e hebraico: o desenho do cartão (next/og) não junta as letras
// nem inverte a direção dessas escritas, e o verso sairia ilegível. Nesses poemas
// o cartão mostra o autor e a língua, sem os versos.
const ESCRITA_DA_DIREITA = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;

export function temEscritaDaDireita(texto: string): boolean {
  return ESCRITA_DA_DIREITA.test(texto);
}

// O que sobra de um título misto ("Shahnameh — Abertura (به نام خداوند)") sem a
// parte da escrita da direita; vazio se não sobrar nada legível.
export function semEscritaDaDireita(texto: string): string {
  return texto
    .replace(new RegExp(`${ESCRITA_DA_DIREITA.source}+(\\s+${ESCRITA_DA_DIREITA.source}+)*`, "g"), "")
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s,;:—–-]+$/, "");
}
