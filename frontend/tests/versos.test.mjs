// Testa as funções da crítica ancorada no verso (#71) de lib/api.ts, transpilando
// o arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  ancoraCobreOVerso,
  caminhoDaCitacaoDeVersos,
  caminhoDaCriticaDeVersos,
  caminhoDaCriticaNaRenga,
  caminhoDoComentario,
  caminhoDosComentarios,
  fimDasEstrofes,
  textoDaRenga,
  lerVersosDaUrl,
  numeroDoVerso,
  numerosDosVersos,
  referenciaDosVersos,
  selecionarVerso,
  trechoDosVersos,
  versosDaSelecao,
  versosDoPoema,
  versosExibidos,
  versosTocados,
} =
  await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

const POEMA = "  Minha terra tem palmeiras,\nOnde canta o Sabiá;\n\nAs aves, que aqui gorjeiam,\n  Não gorjeiam como lá.";

test("a seleção conta as linhas, com a linha em branco entre estrofes, como a âncora no backend", () => {
  assert.equal(versosDoPoema(POEMA).length, 5);
  assert.equal(trechoDosVersos(POEMA, { inicio: 4, fim: 5 }), "As aves, que aqui gorjeiam,\n  Não gorjeiam como lá.");
});

test("o trecho guarda recuos e quebras", () => {
  assert.equal(trechoDosVersos(POEMA, { inicio: 1, fim: 3 }), "  Minha terra tem palmeiras,\nOnde canta o Sabiá;\n");
});

test("referência no singular e no plural, nos números que o leitor vê", () => {
  assert.equal(referenciaDosVersos(POEMA, { inicio: 1, fim: 1 }), "verso 1");
  assert.equal(referenciaDosVersos(POEMA, { inicio: 5, fim: 5 }), "verso 4");
  assert.equal(referenciaDosVersos(POEMA, { inicio: 2, fim: 4 }), "versos 2–3");
  assert.equal(referenciaDosVersos(POEMA, { inicio: 4, fim: 5 }), "versos 3–4");
});

// "A gaveta": seis versos em duas estrofes.
const GAVETA = "abro a gaveta\ne o cheiro\nde papel\nvolta\n\nnada mudou\nsó eu";

test("a numeração é contínua, só dos versos: a linha em branco não conta", () => {
  assert.deepEqual(numerosDosVersos(GAVETA), [1, 2, 3, 4, null, 5, 6]);
  assert.equal(referenciaDosVersos(GAVETA, { inicio: 4, fim: 6 }), "versos 4–5");
  assert.equal(numeroDoVerso(GAVETA, 7), 6);
});

// Gregório de Matos separa as estrofes com linhas só de espaços.
const SO_ESPACOS = "Triste Bahia!\nEstás, e estou\n  \nA ti tocou-te\nQue em tua barra";

test("linha só com espaços é linha em branco: não se numera nem se seleciona", () => {
  assert.deepEqual(numerosDosVersos(SO_ESPACOS), [1, 2, null, 3, 4]);
  assert.equal(versosDaSelecao(SO_ESPACOS, [3]), null);
  assert.deepEqual(versosDaSelecao(SO_ESPACOS, [3, 4]), { inicio: 4, fim: 4 });
  assert.equal(lerVersosDaUrl("5", SO_ESPACOS), null);
  assert.deepEqual(lerVersosDaUrl("2-3", SO_ESPACOS), { inicio: 2, fim: 4 });
  assert.equal(caminhoDaCriticaDeVersos(5, SO_ESPACOS, { inicio: 4, fim: 5 }), "/poema/5?versos=3-4");
});

test("várias linhas em branco seguidas valem uma separação só na numeração", () => {
  const texto = "um\n\n  \n\t\ndois\n";
  assert.deepEqual(numerosDosVersos(texto), [1, null, null, null, 2, null]);
  assert.deepEqual(versosExibidos(texto, { inicio: 1, fim: 5 }), { inicio: 1, fim: 2 });
  assert.equal(versosExibidos(texto, { inicio: 2, fim: 4 }), null);
  assert.deepEqual(versosDaSelecao(texto, [2, 3, 4]), null);
  assert.deepEqual(lerVersosDaUrl("1-2", texto), { inicio: 1, fim: 5 });
  assert.equal(lerVersosDaUrl("3", texto), null);
  // O filtro mostra o número do verso; numa linha em branco, o do verso anterior.
  assert.equal(numeroDoVerso(texto, 5), 2);
  assert.equal(numeroDoVerso(texto, 3), 1);
});

test("poema sem linhas em branco: a linha e o número do verso coincidem", () => {
  const texto = "um\ndois\ntrês";
  assert.deepEqual(numerosDosVersos(texto), [1, 2, 3]);
  assert.equal(referenciaDosVersos(texto, { inicio: 2, fim: 3 }), "versos 2–3");
  assert.equal(caminhoDaCriticaDeVersos(1, texto, { inicio: 2, fim: 3 }), "/poema/1?versos=2-3");
  assert.deepEqual(lerVersosDaUrl("2-3", texto), { inicio: 2, fim: 3 });
});

test("a seleção de texto vira os versos inteiros que ela toca", () => {
  assert.deepEqual(versosDaSelecao(POEMA, [2]), { inicio: 2, fim: 2 });
  assert.deepEqual(versosDaSelecao(POEMA, [1, 2, 3, 4]), { inicio: 1, fim: 4 });
});

test("as linhas em branco das pontas saem da seleção; só elas não selecionam nada", () => {
  assert.deepEqual(versosDaSelecao(POEMA, [2, 3]), { inicio: 2, fim: 2 });
  assert.deepEqual(versosDaSelecao(POEMA, [3, 4]), { inicio: 4, fim: 4 });
  assert.equal(versosDaSelecao(POEMA, [3]), null);
  assert.equal(versosDaSelecao(POEMA, []), null);
});

test("pelo teclado: um clique, outro estende, o mesmo desfaz e um intervalo recomeça", () => {
  assert.deepEqual(selecionarVerso(null, 4), { inicio: 4, fim: 4 });
  assert.deepEqual(selecionarVerso({ inicio: 4, fim: 4 }, 2), { inicio: 2, fim: 4 });
  assert.deepEqual(selecionarVerso({ inicio: 4, fim: 4 }, 5), { inicio: 4, fim: 5 });
  assert.equal(selecionarVerso({ inicio: 4, fim: 4 }, 4), null);
  assert.deepEqual(selecionarVerso({ inicio: 2, fim: 4 }, 3), { inicio: 3, fim: 3 });
});

test("citar estes versos abre o compositor de citação com o trecho", () => {
  const url = new URL(caminhoDaCitacaoDeVersos(7, "um\n  dois"), "http://x");
  assert.equal(url.pathname, "/escrever");
  assert.equal(url.searchParams.get("citar"), "7");
  assert.equal(url.searchParams.get("versos"), "um\n  dois");
});

test("o filtro do verso só deixa passar a crítica cuja âncora cobre o verso", () => {
  const ancora = { verso_inicio: 2, verso_fim: 4, trecho: "" };
  assert.equal(ancoraCobreOVerso(ancora, null), true);
  assert.equal(ancoraCobreOVerso(null, null), true);
  assert.equal(ancoraCobreOVerso(ancora, 2), true);
  assert.equal(ancoraCobreOVerso(ancora, 4), true);
  assert.equal(ancoraCobreOVerso(ancora, 7), false);
  assert.equal(ancoraCobreOVerso(ancora, 1), false);
  assert.equal(ancoraCobreOVerso(null, 7), false);
});

// #137: o poema pode ter negrito, itálico, sublinhado e tachado no texto.
const FORMATADO = "**Minha terra** tem *palmeiras*,\nOnde canta o ~~Sabiá~~;\n\n++As aves++";

test("com marcas, a numeração não muda e a citação de versos leva as marcas", () => {
  assert.equal(versosDoPoema(FORMATADO).length, 4);
  assert.equal(trechoDosVersos(FORMATADO, { inicio: 1, fim: 2 }), "**Minha terra** tem *palmeiras*,\nOnde canta o ~~Sabiá~~;");
  assert.deepEqual(versosDaSelecao(FORMATADO, [2, 3]), { inicio: 2, fim: 2 });
  const caminho = caminhoDaCitacaoDeVersos(7, trechoDosVersos(FORMATADO, { inicio: 4, fim: 4 }));
  assert.equal(new URL(caminho, "http://x").searchParams.get("versos"), "++As aves++");
});

// Seleção do navegador de mentira: toca as linhas cujo data-verso está em `tocadas`.
const linhas = (n) => Array.from({ length: n }, (_, i) => ({ dataset: { verso: String(i + 1) } }));
const selecao = (tocadas, isCollapsed = false) => ({
  isCollapsed,
  containsNode: (linha, parcial) => parcial === true && tocadas.includes(Number(linha.dataset.verso)),
});

test("versos tocados pela seleção, mesmo em parte, e nenhum com a seleção recolhida", () => {
  assert.deepEqual(versosTocados(selecao([2, 3, 4]), linhas(5)), [2, 3, 4]);
  assert.deepEqual(versosTocados(selecao([2, 3], true), linhas(5)), []);
  assert.deepEqual(versosTocados(selecao([]), linhas(5)), []);
});

test("no card cortado, os números são os do poema inteiro (o corte só esconde o fim)", () => {
  const longo = Array.from({ length: 30 }, (_, i) => `verso ${i + 1}`).join("\n");
  const tocados = versosTocados(selecao([19, 20]), linhas(20));
  assert.deepEqual(versosDaSelecao(longo, tocados), { inicio: 19, fim: 20 });
});

test("a seleção que pega a linha em branco entre estrofes vira os versos com texto", () => {
  assert.deepEqual(versosDaSelecao(POEMA, versosTocados(selecao([2, 3, 4]), linhas(5))), { inicio: 2, fim: 4 });
  assert.equal(versosDaSelecao(POEMA, versosTocados(selecao([3]), linhas(5))), null);
});

test("o caminho da crítica leva na URL os números que o leitor vê", () => {
  assert.equal(caminhoDaCriticaDeVersos(7, POEMA, { inicio: 2, fim: 4 }), "/poema/7?versos=2-3");
  assert.equal(caminhoDaCriticaDeVersos(7, POEMA, { inicio: 4, fim: 4 }), "/poema/7?versos=3");
});

test("?versos= válido vira a seleção em linhas, e volta igual ao que o card gerou", () => {
  assert.deepEqual(lerVersosDaUrl("2-3", POEMA), { inicio: 2, fim: 4 });
  assert.deepEqual(lerVersosDaUrl("4", POEMA), { inicio: 5, fim: 5 });
  assert.deepEqual(lerVersosDaUrl("1-4", POEMA), { inicio: 1, fim: 5 });
  const caminho = caminhoDaCriticaDeVersos(1, POEMA, { inicio: 4, fim: 5 });
  assert.deepEqual(lerVersosDaUrl(new URL(caminho, "http://x").searchParams.get("versos"), POEMA), { inicio: 4, fim: 5 });
});

test("?versos= inválido é ignorado (null)", () => {
  for (const valor of [null, "", "0", "0-2", "4-2", "2-5", "5", "a", "2-", "-2", "2-3-4", " 2", "2.5", "1e1", "9999999"]) {
    assert.equal(lerVersosDaUrl(valor, POEMA), null, `?versos=${valor}`);
  }
});

test("?versos= conta as linhas do texto sem marcas (o chamador tira as marcas)", () => {
  assert.deepEqual(lerVersosDaUrl("2", "**um**\n*dois*"), { inicio: 2, fim: 2 });
});

// Renga: as estrofes juntas, com a linha em branco entre elas (texto_de no backend).
const ESTROFES = [{ texto: "na varanda\n  a chuva" }, { texto: "o caderno" }, { texto: "e a tinta\ncorre\n" }];

test("o texto da renga junta as estrofes com uma linha em branco, como o backend", () => {
  const texto = textoDaRenga(ESTROFES);
  assert.deepEqual(versosDoPoema(texto), ["na varanda", "  a chuva", "", "o caderno", "", "e a tinta", "corre", ""]);
  assert.equal(trechoDosVersos(texto, { inicio: 2, fim: 4 }), "  a chuva\n\no caderno");
});

test("o fim de cada estrofe no texto da renga, onde vai o autor", () => {
  assert.deepEqual(fimDasEstrofes(ESTROFES), [2, 4, 8]);
  assert.deepEqual(fimDasEstrofes([]), []);
});

test("a renga crescer não muda o número dos versos já escritos", () => {
  const antes = versosDoPoema(textoDaRenga(ESTROFES.slice(0, 2)));
  const depois = versosDoPoema(textoDaRenga(ESTROFES));
  assert.deepEqual(depois.slice(0, antes.length), antes);
  assert.deepEqual(fimDasEstrofes(ESTROFES).slice(0, 2), fimDasEstrofes(ESTROFES.slice(0, 2)));
});

test("comentar versos no card da renga leva à página dela com ?versos=", () => {
  const texto = textoDaRenga(ESTROFES);
  assert.equal(caminhoDaCriticaNaRenga(3, texto, { inicio: 2, fim: 4 }), "/rengas/3?versos=2-3");
  assert.equal(caminhoDaCriticaNaRenga(3, texto, { inicio: 6, fim: 6 }), "/rengas/3?versos=4");
  const valor = new URL(caminhoDaCriticaNaRenga(3, texto, { inicio: 4, fim: 6 }), "http://x").searchParams.get("versos");
  assert.equal(valor, "3-4");
  assert.deepEqual(lerVersosDaUrl(valor, textoDaRenga(ESTROFES)), { inicio: 4, fim: 6 });
});

test("as rotas dos comentários de poema não mudam; as da renga ficam dentro dela", () => {
  assert.equal(caminhoDosComentarios({ tipo: "poema", id: 7 }), "/posts/7/comentarios");
  assert.equal(caminhoDoComentario({ tipo: "poema", id: 7 }, 9), "/comentarios/9");
  assert.equal(caminhoDosComentarios({ tipo: "renga", id: 3 }), "/rengas/3/comentarios");
  assert.equal(caminhoDoComentario({ tipo: "renga", id: 3 }, 9), "/rengas/3/comentarios/9");
});
