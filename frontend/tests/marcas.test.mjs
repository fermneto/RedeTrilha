// Testa a conversão texto ↔ editor de lib/marcas.ts (#137), transpilando o
// arquivo como em anosDeVida.test.mjs. Os casos de backend/tests/casos_marcas.json
// são os mesmos do backend (core/marcas.py). Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/marcas.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { analisarLinha, analisarTexto, escreverLinha, escreverTexto, textoSemMarcas, MARCAS } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const CASOS = JSON.parse(readFileSync(new URL("../../backend/tests/casos_marcas.json", import.meta.url), "utf8"));
const comoNoBackend = (texto) =>
  analisarTexto(texto).map((linha) => linha.map((s) => [s.texto, [...s.marcas].sort()]));

test("os casos compartilhados com o backend dão o mesmo resultado", () => {
  for (const caso of CASOS) {
    assert.deepEqual(comoNoBackend(caso.texto), caso.linhas, caso.texto);
    assert.equal(textoSemMarcas(caso.texto), caso.sem_marcas, caso.texto);
  }
});

test("ida e volta idêntica: poemas antigos, * literal, várias marcas, estrofes e recuos", () => {
  const textos = [
    ...CASOS.map((c) => c.texto),
    "Minha terra tem palmeiras,\nOnde canta o Sabiá;\n\n  As aves, que aqui gorjeiam,\n\tNão gorjeiam como lá.",
    "**Amor** é fogo que arde sem se ver,\n  é *ferida* que dói, e não se ~~sente~~;\n\n++é um contentamento++",
    "",
    "\n\n",
    "Thomas Moore: shade*,\n*  *  *\nfights*! ",
  ];
  for (const texto of textos) assert.equal(escreverTexto(analisarTexto(texto)), texto, texto);
});

test("a marca fecha e reabre em cada verso: a contagem de linhas não muda", () => {
  // O editor tem a palavra em negrito nos dois versos: cada linha leva o par.
  const linhas = [[{ texto: "começa", marcas: ["negrito"] }], [], [{ texto: "acaba", marcas: ["negrito"] }]];
  const salvo = escreverTexto(linhas);
  assert.equal(salvo, "**começa**\n\n**acaba**");
  assert.equal(salvo.split("\n").length, 3);
  assert.deepEqual(analisarTexto("**começa\nacaba**"), [[{ texto: "**começa", marcas: [] }], [{ texto: "acaba**", marcas: [] }]]);
});

test("* digitado ao lado de uma marca é escapado; o literal volta literal", () => {
  const segmentos = [{ texto: "a", marcas: ["italico"] }, { texto: "*b*", marcas: [] }];
  const salvo = escreverLinha(segmentos);
  assert.equal(salvo, "*a*\\*b\\*");
  assert.deepEqual(analisarLinha(salvo), segmentos);
  assert.equal(escreverLinha([{ texto: "2 * 3", marcas: [] }]), "2 * 3");
});

test("espaço na ponta da marca sai dela; marca só de espaço some", () => {
  assert.equal(escreverLinha([{ texto: " palavra ", marcas: ["negrito"] }]), " **palavra** ");
  assert.equal(escreverLinha([{ texto: "\t", marcas: ["sublinhado"] }]), "\t");
});

test("aleatório: qualquer conteúdo do editor volta igual", () => {
  let semente = 137;
  const sorteio = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
  const letras = "ab *+~\\\t";
  for (let n = 0; n < 3000; n++) {
    const segmentos = Array.from({ length: 1 + Math.floor(sorteio() * 5) }, () => ({
      texto: Array.from({ length: 1 + Math.floor(sorteio() * 4) }, () => letras[Math.floor(sorteio() * letras.length)]).join(""),
      marcas: MARCAS.filter(() => sorteio() < 0.4),
    }));
    const salvo = escreverLinha(segmentos);
    const lido = analisarLinha(salvo);
    assert.equal(lido.map((s) => s.texto).join(""), segmentos.map((s) => s.texto).join(""), salvo);
    assert.equal(escreverLinha(lido), salvo, salvo);
    // Cada letra sem espaço guarda as marcas que tinha.
    const marcasDe = (segs) => segs.flatMap((s) => Array.from(s.texto, (c) => (/\s/.test(c) ? "" : s.marcas.join())));
    assert.deepEqual(marcasDe(lido), marcasDe(segmentos), salvo);
  }
});
