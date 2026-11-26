// Testa juntarAoFeed e chaveDoAlvo (lib/api.ts): a defesa do front contra poema ou
// renga repetidos no feed, transpilando o arquivo como em avisos.test.mjs. Rode
// com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { chaveDoAlvo, juntarAoFeed } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const ana = { id: 1, username: "ana" };
const bia = { id: 2, username: "bia" };
const caio = { id: 3, username: "caio" };

function poema(id, extra = {}) {
  return { tipo: "poema", id, texto: `poema ${id}`, autor: ana, repost_de: null, repostado_por: [], ...extra };
}

function renga(id, atividade, por) {
  return { tipo: "renga", renga: { id }, atividade, por };
}

const ids = (itens) => itens.map(chaveDoAlvo);

test("o repost puro conta como o original; a citação, não", () => {
  const original = poema(7);
  assert.equal(chaveDoAlvo(poema(9, { texto: "", repost_de: original })), "poema-7");
  assert.equal(chaveDoAlvo(poema(10, { texto: "cito", repost_de: original })), "poema-10");
  assert.equal(chaveDoAlvo(renga(7, "abriu", [ana])), "renga-7");
});

test("fica a primeira ocorrência, na posição dela, e soma quem repostou", () => {
  const atuais = [poema(1, { repostado_por: [bia] }), poema(2)];
  const novos = [poema(3), poema(1, { repostado_por: [caio, bia] })];
  const itens = juntarAoFeed(atuais, novos);
  assert.deepEqual(ids(itens), ["poema-1", "poema-2", "poema-3"]);
  assert.deepEqual(itens[0].repostado_por, [bia, caio]);
});

test("o repost puro repetido entra no rótulo com o autor dele", () => {
  const original = poema(1, { repostado_por: [bia] });
  const itens = juntarAoFeed([original], [poema(5, { texto: "", repost_de: poema(1), autor: caio })]);
  assert.deepEqual(ids(itens), ["poema-1"]);
  assert.deepEqual(itens[0].repostado_por, [bia, caio]);
});

test("o poema que subiu pela publicação não ganha rótulo de repost", () => {
  const itens = juntarAoFeed([poema(1)], [poema(1, { repostado_por: [bia] })]);
  assert.deepEqual(itens[0].repostado_por, []);
});

test("repetido dentro da mesma página também sai uma vez", () => {
  const itens = juntarAoFeed([], [poema(1, { repostado_por: [ana] }), poema(1, { repostado_por: [bia] })]);
  assert.equal(itens.length, 1);
  assert.deepEqual(itens[0].repostado_por, [ana, bia]);
});

test("renga repetida soma quem repostou; a que abriu fica como está", () => {
  const itens = juntarAoFeed(
    [renga(4, "repostou", [ana]), renga(5, "abriu", [ana])],
    [renga(4, "repostou", [bia, ana]), renga(5, "abriu", [ana]), poema(4)],
  );
  assert.deepEqual(ids(itens), ["renga-4", "renga-5", "poema-4"]);
  assert.deepEqual(itens[0].por, [ana, bia]);
  assert.deepEqual(itens[1].por, [ana]);
});

test("não muda a lista de antes", () => {
  const atuais = [poema(1, { repostado_por: [bia] })];
  juntarAoFeed(atuais, [poema(1, { repostado_por: [caio] })]);
  assert.deepEqual(atuais[0].repostado_por, [bia]);
});

test("o mais curtido da continuação repete, como folha nova no fim", () => {
  const atuais = [poema(1), poema(2)];
  const novos = [poema(3), poema(1, { subiu_por: "curtidas" }), poema(1, { subiu_por: "curtidas" })];
  assert.deepEqual(ids(juntarAoFeed(atuais, novos)), ["poema-1", "poema-2", "poema-3", "poema-1", "poema-1"]);
});
