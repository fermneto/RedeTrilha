// Testa as partes puras de lib/sessaoDoFeed.ts: o filtro entre as abas, o
// "visto", a curtida guardada e o dono da sessão, transpilando o arquivo como em
// avisos.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/sessaoDoFeed.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { abaVazia, comAcao, donoDoToken, marcarVisto, sessaoVazia, visiveis } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const poema = (id, extra = {}) => ({ tipo: "poema", id, texto: `p${id}`, repost_de: null, curti: false, curtidas: 0, ...extra });
const renga = (id) => ({ tipo: "renga", renga: { id, curti: false, curtidas: 0 }, atividade: "abriu", por: [] });
const chave = (item) => (item.tipo === "renga" ? `renga-${item.renga.id}` : `poema-${item.id}`);

test("o visto numa aba some da outra; o não visto aparece nas duas", () => {
  const itens = [poema(1), poema(2), renga(1), poema(3)];
  const vistos = { "poema-1": "seguindo", "renga-1": "para-voce" };
  assert.deepEqual(visiveis(itens, chave, vistos, "para-voce").map(chave), ["poema-2", "renga-1", "poema-3"]);
  assert.deepEqual(visiveis(itens, chave, vistos, "seguindo").map(chave), ["poema-1", "poema-2", "poema-3"]);
});

test("fica com a aba em que foi visto primeiro", () => {
  const um = marcarVisto({}, "poema-1", "seguindo");
  assert.deepEqual(um, { "poema-1": "seguindo" });
  // Ver de novo na outra aba não muda o dono, e devolve o mesmo objeto.
  assert.equal(marcarVisto(um, "poema-1", "para-voce"), um);
});

test("a curtida feita no feed fica nos itens guardados das duas abas", () => {
  const sessao = {
    ...sessaoVazia("x"),
    abas: {
      "para-voce": { ...abaVazia(), itens: [poema(1), poema(9, { texto: "cito", repost_de: poema(1) }), renga(1)] },
      seguindo: { ...abaVazia(), itens: [poema(1)] },
    },
  };
  const estado = { curti: true, curtidas: 1, repostei: false, reposts: 0 };
  const nova = comAcao(sessao, { tipo: "poema", id: 1 }, estado);
  const [p1, citacao, r1] = nova.abas["para-voce"].itens;
  assert.equal(p1.curti, true);
  assert.equal(citacao.curti, false);
  assert.equal(citacao.repost_de.curti, true);
  assert.equal(r1.renga.curti, false);
  assert.equal(nova.abas.seguindo.itens[0].curtidas, 1);
  assert.equal(sessao.abas.seguindo.itens[0].curti, false);
  const comRenga = comAcao(sessao, { tipo: "renga", id: 1 }, estado);
  assert.equal(comRenga.abas["para-voce"].itens[2].renga.curti, true);
});

test("o dono é um resumo estável do token, sem copiá-lo", () => {
  assert.equal(donoDoToken(null), "");
  assert.equal(donoDoToken("abc"), donoDoToken("abc"));
  assert.notEqual(donoDoToken("abc"), donoDoToken("abd"));
  assert.ok(!donoDoToken("um-token-secreto").includes("secreto"));
});

test("o mais curtido da continuação aparece mesmo visto na outra aba", () => {
  const itens = [poema(1), poema(1, { subiu_por: "curtidas" })];
  const vistos = { "poema-1": "seguindo" };
  assert.deepEqual(
    visiveis(itens, chave, vistos, "para-voce").map((i) => i.subiu_por ?? null),
    ["curtidas"],
  );
});

test("a aba vazia começa sem virada", () => {
  assert.equal(abaVazia().fimEm, null);
});

test("a releitura da continuação aparece mesmo vista na outra aba", () => {
  const itens = [poema(1, { subiu_por: "releitura" })];
  assert.equal(visiveis(itens, chave, { "poema-1": "seguindo" }, "para-voce").length, 1);
});
