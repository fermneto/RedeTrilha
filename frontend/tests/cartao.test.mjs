// Testa o resumo do poema para o cartão de compartilhamento (lib/cartao.ts):
// transpila lib/marcas.ts e lib/cartao.ts e troca o import "./marcas" pelo
// módulo transpilado. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const comoModulo = (arquivo) => {
  const fonte = readFileSync(new URL(`../lib/${arquivo}`, import.meta.url), "utf8");
  const js = ts.transpileModule(fonte, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
};

const marcas = comoModulo("marcas.ts");
const cartao = Buffer.from(comoModulo("cartao.ts").split(",")[1], "base64")
  .toString()
  .replace('"./marcas"', JSON.stringify(marcas));
const { primeirosVersos, tituloDoPoema, descricaoDoPoema, encurtar } = await import(
  `data:text/javascript;base64,${Buffer.from(cartao).toString("base64")}`
);

test("os primeiros versos saem sem as marcas de formatação", () => {
  const texto = "**Vozes** da *noite*,\n++ouço++ e ~~calo~~.";
  assert.deepEqual(primeirosVersos(texto), { versos: ["Vozes da noite,", "ouço e calo."], cortado: false });
});

test("até 8 versos, com a estrofe e os recuos do poema", () => {
  const texto = "\n\num\n  dois\n\n\n\ntrês\nquatro\ncinco\nseis\nsete\noito\nnove";
  const { versos, cortado } = primeirosVersos(texto);
  assert.deepEqual(versos, ["um", "  dois", "", "três", "quatro", "cinco", "seis", "sete"]);
  assert.equal(cortado, true);
});

test("não termina numa linha em branco e diz quando o poema não continua", () => {
  assert.deepEqual(primeirosVersos("um\ndois\n\n", 3), { versos: ["um", "dois"], cortado: false });
  assert.deepEqual(primeirosVersos("um\n\ntrês", 2), { versos: ["um"], cortado: true });
});

test("verso longo demais leva reticências, cortado num espaço", () => {
  const longo = "As armas e os barões assinalados que da ocidental praia lusitana por mares nunca dantes navegados";
  const [verso] = primeirosVersos(longo, 8, 40).versos;
  assert.ok(verso.length <= 40, verso);
  assert.ok(verso.endsWith("…"), verso);
  assert.equal(verso, "As armas e os barões assinalados que…");
});

test("o título é o do poema, sem marcas; sem título, o primeiro verso", () => {
  assert.equal(tituloDoPoema({ titulo: "*Versos íntimos*", texto: "Vês?!" }), "Versos íntimos");
  assert.equal(tituloDoPoema({ titulo: null, texto: "\n**Vês?!** Ninguém assistiu\nao formidável" }), "Vês?! Ninguém assistiu");
  assert.equal(tituloDoPoema({ titulo: "  ", texto: "\n\n" }), "Poema sem título");
});

test("a descrição corre os versos com / e as estrofes com //", () => {
  assert.equal(descricaoDoPoema("um\ndois\n\ntrês"), "um / dois // três");
  const longa = descricaoDoPoema("palavra ".repeat(60));
  assert.ok(longa.length <= 160 && longa.endsWith("…"));
});

test("encurtar não mexe no texto que cabe", () => {
  assert.equal(encurtar("cabe", 10), "cabe");
});

test("o primeiro verso como título perde a pontuação que o ligava ao seguinte", () => {
  assert.equal(tituloDoPoema({ titulo: null, texto: "ônibus lotado —\no calor" }), "ônibus lotado");
  assert.equal(tituloDoPoema({ titulo: null, texto: "Onde estás?\n" }), "Onde estás?");
});

test("a escrita da direita fica de fora do cartão", async () => {
  const { temEscritaDaDireita, semEscritaDaDireita } = await import(
    `data:text/javascript;base64,${Buffer.from(cartao).toString("base64")}`
  );
  assert.equal(temEscritaDaDireita("به نام خداوند جان و خرد"), true);
  assert.equal(temEscritaDaDireita("Versos íntimos"), false);
  assert.equal(semEscritaDaDireita("Shahnameh — Abertura (به نام خداوند جان و خرد)"), "Shahnameh — Abertura");
  assert.equal(semEscritaDaDireita("غزل ۱"), "");
});
