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
const { lugarDasDicas, posicionarNota, proximaDica, VIRADAS_ENTRE_DICAS } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const tudoAVista = () => true;

const V = VIRADAS_ENTRE_DICAS;

test("as dicas aparecem em qualquer página do livro", () => {
  assert.equal(lugarDasDicas("/"), "inicio");
  assert.equal(lugarDasDicas("/escrever"), "escrever");
  assert.equal(lugarDasDicas("/explorar"), "livro");
  assert.equal(lugarDasDicas("/u/ana"), "livro");
  assert.equal(proximaDica([], "livro", V, tudoAVista), "virar_pagina");
});

test("ao chegar, a primeira que cabe vem logo; depois dela, espera folhear", () => {
  assert.equal(proximaDica([], "inicio", V, tudoAVista), "virar_pagina");
  const vistas = ["virar_pagina"];
  assert.equal(proximaDica(vistas, "inicio", V - 1, tudoAVista), null);
  assert.equal(proximaDica(vistas, "inicio", V, tudoAVista), "acoes");
  assert.equal(proximaDica(["virar_pagina", "acoes"], "inicio", V, tudoAVista), "lombada");
  assert.equal(proximaDica(["virar_pagina", "acoes", "lombada"], "inicio", V, tudoAVista), "escrever");
  assert.equal(proximaDica(["virar_pagina", "acoes", "lombada", "escrever"], "inicio", V, tudoAVista), null);
});

test("no contexto: sem o lugar de uma à vista, vem a seguinte que cabe ali", () => {
  // Um perfil sem a conversa à vista e sem mais de uma folha: só a lombada cabe.
  const soALombada = (d) => d === "lombada";
  assert.equal(proximaDica([], "livro", V, soALombada), "lombada");
  assert.equal(proximaDica([], "livro", V, () => false), null);
});

test("fora do Início e do compositor, o botão de escrever fica sem dica", () => {
  assert.equal(proximaDica(["virar_pagina", "acoes", "lombada"], "livro", V, tudoAVista), null);
});

test("no compositor, a de escrever vem ao chegar, mesmo antes das outras e sem intervalo", () => {
  assert.equal(proximaDica([], "escrever", 0, tudoAVista), "escrever");
  assert.equal(proximaDica(["escrever"], "escrever", V, tudoAVista), null);
});

test("vista em qualquer lugar, não volta no outro", () => {
  assert.equal(proximaDica(["virar_pagina", "acoes", "lombada", "escrever"], "escrever", 0, tudoAVista), null);
  assert.equal(proximaDica(["virar_pagina", "acoes", "lombada", "escrever"], "livro", V, tudoAVista), null);
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

test("acima da seta, a nota sobe até não cobrir o campo de comentar nem os botões", () => {
  const desktop = { width: 1440, height: 900 };
  const seta = { top: 816, left: 1338, width: 48, height: 48 };
  const campo = { top: 759, left: 815, width: 535, height: 50 };
  const comentar = { top: 700, left: 1250, width: 90, height: 44 };
  const longe = { top: 100, left: 100, width: 90, height: 44 };
  const p = posicionarNota(seta, nota, desktop, "acima", [campo, comentar, longe]);
  assert.equal(p.lado, "acima");
  assert.equal(p.top, 700 - 14 - 160);
  // A ponta continua apontando a seta de folhear.
  assert.equal(p.left + p.seta, seta.left + seta.width / 2);
  // Sem obstáculo no caminho, fica colada na âncora.
  assert.equal(posicionarNota(seta, nota, desktop, "acima", [longe]).top, 816 - 14 - 160);
});
