// Testa comAPessoa (lib/repercussao.ts): a linha "curtido por ..." da página da
// publicação atualiza na hora, sem nova requisição. Transpila o arquivo como em
// historico.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/repercussao.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { comAPessoa } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

const pessoa = (id, name) => ({ id, name, username: name.toLowerCase() });
const ana = pessoa(1, "Ana");
const bia = pessoa(2, "Bia");
const caio = pessoa(3, "Caio");
const eu = pessoa(9, "Eu");
const pagina = (items, total) => ({ items, total, offset: 0, limit: 3 });
const ids = (p) => p.items.map((u) => u.id);

test("curtir põe a pessoa no começo da prévia e soma 1", () => {
  const depois = comAPessoa(pagina([ana, bia], 2), eu, true, 3);
  assert.deepEqual(ids(depois), [9, 1, 2]);
  assert.equal(depois.total, 3);
});

test("a prévia não passa do limite de rostos", () => {
  const depois = comAPessoa(pagina([ana, bia, caio], 10), eu, true, 3);
  assert.deepEqual(ids(depois), [9, 1, 2]);
  assert.equal(depois.total, 11);
});

test("a primeira curtida faz a linha aparecer", () => {
  const depois = comAPessoa(pagina([], 0), eu, true, 3);
  assert.deepEqual(ids(depois), [9]);
  assert.equal(depois.total, 1);
});

test("descurtir tira a pessoa e subtrai 1", () => {
  const depois = comAPessoa(pagina([eu, ana, bia], 5), eu, false, 3);
  assert.deepEqual(ids(depois), [1, 2]);
  assert.equal(depois.total, 4);
});

test("descurtir a única curtida zera a linha", () => {
  const depois = comAPessoa(pagina([eu], 1), eu, false, 3);
  assert.deepEqual(ids(depois), []);
  assert.equal(depois.total, 0);
});

test("sem limite (a lista aberta), nada é cortado", () => {
  const depois = comAPessoa(pagina([ana, bia, caio], 3), eu, true);
  assert.deepEqual(ids(depois), [9, 1, 2, 3]);
  assert.equal(depois.total, 4);
});

test("descurtir quem não estava entre os rostos subtrai 1 do mesmo jeito", () => {
  const depois = comAPessoa(pagina([ana, bia, caio], 50), eu, false, 3);
  assert.deepEqual(ids(depois), [1, 2, 3]);
  assert.equal(depois.total, 49);
});

test("não muda a página recebida", () => {
  const antes = pagina([ana], 1);
  comAPessoa(antes, eu, true, 3);
  assert.deepEqual(ids(antes), [1]);
  assert.equal(antes.total, 1);
});
