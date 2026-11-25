// Negrito, itálico, sublinhado e tachado dentro do texto do poema (#137).
//
// O poema continua texto puro; a formatação é um subconjunto de Markdown:
// **negrito**, *itálico*, ++sublinhado++ e ~~tachado~~, com \ antes de *, +, ~
// ou \ para o caractere literal. Uma marca nunca atravessa a quebra de linha
// (fecha e reabre em cada verso), então o número de linhas, e com ele a
// numeração dos versos, é o mesmo com ou sem marcas.
//
// As regras são as mesmas de backend/app/core/marcas.py (os testes dos dois
// lados leem backend/tests/casos_marcas.json):
// - um delimitador abre se o caractere seguinte existe e não é espaço, e fecha
//   se o anterior existe e não é espaço: "* * *" e "2 * 3" ficam literais;
// - 1, 2 ou 3 asteriscos alternam itálico, negrito ou os dois; 4 ou mais são
//   literais; ++ e ~~ só valem com exatamente 2;
// - quem abre e não fecha até o fim do verso é literal ("shade*,").
//
// Sem imports: o arquivo é transpilado sozinho nos testes (tests/marcas.test.mjs).

export type Marca = "negrito" | "italico" | "sublinhado" | "tachado";

export const MARCAS: readonly Marca[] = ["negrito", "italico", "sublinhado", "tachado"];

// Um pedaço do verso com as marcas dele, na ordem de MARCAS.
export type Segmento = { texto: string; marcas: Marca[] };

const ESPECIAIS = "*+~\\";
// O \s do JavaScript; o backend usa a mesma lista.
const ESPACO = /\s/;

type Token = {
  texto: string;
  marcas: Marca[]; // vazio = literal
  abre: boolean;
  fecha: boolean;
  aplicado: boolean;
};

function espaco(c: string | undefined): boolean {
  return c === undefined || ESPACO.test(c);
}

function asteriscos(corrida: number): Marca[] {
  if (corrida === 1) return ["italico"];
  if (corrida === 2) return ["negrito"];
  if (corrida === 3) return ["negrito", "italico"];
  return [];
}

function tokens(linha: string): Token[] {
  const saida: Token[] = [];
  let i = 0;
  while (i < linha.length) {
    const c = linha[i];
    if (c === "\\" && i + 1 < linha.length && ESPECIAIS.includes(linha[i + 1])) {
      saida.push({ texto: linha[i + 1], marcas: [], abre: false, fecha: false, aplicado: false });
      i += 2;
      continue;
    }
    if (c === "*" || c === "+" || c === "~") {
      let fim = i;
      while (fim < linha.length && linha[fim] === c) fim++;
      const corrida = fim - i;
      const marcas: Marca[] =
        c === "*" ? asteriscos(corrida) : corrida === 2 ? [c === "+" ? "sublinhado" : "tachado"] : [];
      saida.push({
        texto: linha.slice(i, fim),
        marcas,
        abre: !espaco(linha[fim]),
        fecha: !espaco(i > 0 ? linha[i - 1] : undefined),
        aplicado: false,
      });
      i = fim;
      continue;
    }
    saida.push({ texto: c, marcas: [], abre: false, fecha: false, aplicado: false });
    i++;
  }
  return saida;
}

// Da esquerda para a direita, alternando as marcas; o que abriu e não fechou
// vira literal e a passada recomeça (O(d²) no pior caso, d = delimitadores).
function resolver(linha: string): Token[] {
  const lista = tokens(linha);
  const forcados = new Set<number>();
  for (;;) {
    const abertas = new Map<Marca, number>();
    lista.forEach((token, i) => {
      token.aplicado = false;
      if (token.marcas.length === 0 || forcados.has(i)) return;
      if (!token.marcas.every((m) => (abertas.has(m) ? token.fecha : token.abre))) return;
      token.aplicado = true;
      for (const m of token.marcas) {
        if (abertas.has(m)) abertas.delete(m);
        else abertas.set(m, i);
      }
    });
    if (abertas.size === 0) return lista;
    for (const i of abertas.values()) forcados.add(i);
  }
}

function ordenar(marcas: Iterable<Marca>): Marca[] {
  const conjunto = new Set(marcas);
  return MARCAS.filter((m) => conjunto.has(m));
}

function mesmas(a: Marca[], b: Marca[]): boolean {
  return a.length === b.length && a.every((m, i) => m === b[i]);
}

// Sem segmentos vazios e sem dois seguidos com as mesmas marcas.
function juntar(segmentos: Segmento[]): Segmento[] {
  const juntos: Segmento[] = [];
  for (const { texto, marcas } of segmentos) {
    if (!texto) continue;
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && mesmas(ultimo.marcas, marcas)) ultimo.texto += texto;
    else juntos.push({ texto, marcas: ordenar(marcas) });
  }
  return juntos;
}

export function analisarLinha(linha: string): Segmento[] {
  const segmentos: Segmento[] = [];
  let atuais = new Set<Marca>();
  for (const token of resolver(linha)) {
    if (token.aplicado) {
      atuais = new Set(atuais);
      for (const m of token.marcas) {
        if (atuais.has(m)) atuais.delete(m);
        else atuais.add(m);
      }
    } else {
      segmentos.push({ texto: token.texto, marcas: ordenar(atuais) });
    }
  }
  return juntar(segmentos);
}

// Um item por linha de texto.split("\n").
export function analisarTexto(texto: string): Segmento[][] {
  return texto.split("\n").map(analisarLinha);
}

// O texto como o leitor o vê: sem delimitadores nem escapes, com o mesmo número
// de linhas. É o que se copia, se numera e se testa para "verso em branco".
export function textoSemMarcas(texto: string): string {
  return analisarTexto(texto)
    .map((linha) => linha.map((s) => s.texto).join(""))
    .join("\n");
}

// Espaço no começo ou no fim de uma marca sai dela (senão o delimitador não abre).
function semMarcaNasPontas(segmentos: Segmento[]): Segmento[] {
  const letras: { c: string; marcas: Set<Marca> }[] = [];
  for (const s of segmentos) for (const c of Array.from(s.texto)) letras.push({ c, marcas: new Set(s.marcas) });
  for (const marca of MARCAS) {
    let i = 0;
    while (i < letras.length) {
      if (!letras[i].marcas.has(marca)) {
        i++;
        continue;
      }
      let fim = i;
      while (fim < letras.length && letras[fim].marcas.has(marca)) fim++;
      let a = i;
      let b = fim;
      while (a < b && espaco(letras[a].c)) letras[a++].marcas.delete(marca);
      while (b > a && espaco(letras[b - 1].c)) letras[--b].marcas.delete(marca);
      i = fim;
    }
  }
  return juntar(letras.map(({ c, marcas }) => ({ texto: c, marcas: ordenar(marcas) })));
}

function estrelas(marcas: Set<Marca>): string {
  return "*".repeat((marcas.has("negrito") ? 2 : 0) + (marcas.has("italico") ? 1 : 0));
}

// Fecha na ordem inversa da que abre: ~~++**tudo**++~~.
function delimitadores(fecham: Set<Marca>, abrem: Set<Marca>): string {
  return (
    estrelas(fecham) +
    (fecham.has("sublinhado") ? "++" : "") +
    (fecham.has("tachado") ? "~~" : "") +
    (abrem.has("tachado") ? "~~" : "") +
    (abrem.has("sublinhado") ? "++" : "") +
    estrelas(abrem)
  );
}

function escrever(segmentos: Segmento[], escapar: boolean): string {
  let saida = "";
  let anteriores = new Set<Marca>();
  for (const { texto, marcas } of segmentos) {
    const atuais = new Set(marcas);
    saida += delimitadores(
      new Set([...anteriores].filter((m) => !atuais.has(m))),
      new Set([...atuais].filter((m) => !anteriores.has(m))),
    );
    saida += escapar ? Array.from(texto, (c) => (ESPECIAIS.includes(c) ? `\\${c}` : c)).join("") : texto;
    anteriores = atuais;
  }
  return saida + delimitadores(anteriores, new Set());
}

function iguais(a: Segmento[], b: Segmento[]): boolean {
  return a.length === b.length && a.every((s, i) => s.texto === b[i].texto && mesmas(s.marcas, b[i].marcas));
}

// O verso no formato salvo. Só escapa quando precisa: um poema antigo, sem marcas,
// volta exatamente como estava. Se algum literal do verso precisa de escape,
// escapa todos os *, +, ~ e \ dele.
export function escreverLinha(segmentos: Segmento[]): string {
  const normais = semMarcaNasPontas(segmentos);
  const simples = escrever(normais, false);
  return iguais(analisarLinha(simples), normais) ? simples : escrever(normais, true);
}

export function escreverTexto(linhas: Segmento[][]): string {
  return linhas.map(escreverLinha).join("\n");
}
