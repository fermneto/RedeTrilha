// Testa lib/dicas.ts: quando cada dica do livro aparece e onde a nota fica,
// transpilando o arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/dicas.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { lugarDasDicas, numeroDaDica, posicionarNota, proximaDica, VIRADAS_ENTRE_DICAS } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const tudoAVista = () => true;

test("as dicas só aparecem no Início e no compositor", () => {
  assert.equal(lugarDasDicas("/"), "inicio");
  assert.equal(lugarDasDicas("/escrever"), "escrever");
  assert.equal(lugarDasDicas("/explorar"), null);
  assert.equal(proximaDica([], null, 10, tudoAVista), null);
});

test("no Início, virar a página vem logo ao chegar", () => {
  assert.equal(proximaDica([], "inicio", 0, tudoAVista), "virar_pagina");
});

test("as outras esperam a pessoa folhear e vêm uma de cada vez, na ordem", () => {
  const vistas = ["virar_pagina"];
  assert.equal(proximaDica(vistas, "inicio", VIRADAS_ENTRE_DICAS - 1, tudoAVista), null);
  assert.equal(proximaDica(vistas, "inicio", VIRADAS_ENTRE_DICAS, tudoAVista), "acoes");
  assert.equal(proximaDica(["virar_pagina", "acoes"], "inicio", VIRADAS_ENTRE_DICAS, tudoAVista), "lombada");
  assert.equal(proximaDica(["virar_pagina", "acoes", "lombada"], "inicio", 5, tudoAVista), "escrever");
  assert.equal(proximaDica(["virar_pagina", "acoes", "lombada", "escrever"], "inicio", 5, tudoAVista), null);
});

test("sem o lugar da dica à vista, espera (não pula para a seguinte)", () => {
  const semAcoes = (d) => d !== "acoes";
  assert.equal(proximaDica(["virar_pagina"], "inicio", 3, semAcoes), null);
});

test("no compositor, só a de escrever, mesmo antes das outras", () => {
  assert.equal(proximaDica([], "escrever", 0, tudoAVista), "escrever");
  assert.equal(proximaDica(["escrever"], "escrever", 0, tudoAVista), null);
});

test("vista em qualquer lugar, não volta no outro", () => {
  assert.equal(proximaDica(["virar_pagina", "acoes", "lombada", "escrever"], "escrever", 0, tudoAVista), null);
});

test("o número da dica na ordem", () => {
  assert.equal(numeroDaDica("virar_pagina"), 1);
  assert.equal(numeroDaDica("escrever"), 4);
});

const tela = { width: 1280, height: 800 };
const nota = { width: 300, height: 160 };

test("a nota fica do lado pedido quando cabe", () => {
  const p = posicionarNota({ top: 300, left: 20, width: 56, height: 56 }, nota, tela, "direita");
  assert.equal(p.lado, "direita");
  assert.equal(p.left, 20 + 56 + 14);
  assert.equal(p.seta, 300 + 28 - p.top);
});

test("sem espaço em cima, a nota desce; sem espaço embaixo, sobe", () => {
  assert.equal(posicionarNota({ top: 40, left: 600, width: 40, height: 40 }, nota, tela, "acima").lado, "abaixo");
  assert.equal(posicionarNota({ top: 740, left: 600, width: 40, height: 40 }, nota, tela, "abaixo").lado, "acima");
});

test("no celular, a nota à direita que não cabe vai para cima, dentro da tela", () => {
  const celular = { width: 390, height: 800 };
  const p = posicionarNota({ top: 740, left: 330, width: 44, height: 44 }, nota, celular, "direita");
  assert.equal(p.lado, "acima");
  assert.equal(p.left, 390 - 12 - 300);
  assert.equal(p.top, 740 - 14 - 160);
  assert.ok(p.seta <= nota.width - 18);
});
