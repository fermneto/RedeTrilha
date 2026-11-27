// Testa contagemCurta() de lib/numeros.ts: o número dos contadores da fileira de
// ações (components/BarraDeAcoes.tsx). Transpila o arquivo como em
// hashtag.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/numeros.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { contagemCurta } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("até 999 o número vem inteiro", () => {
  assert.equal(contagemCurta(0), "0");
  assert.equal(contagemCurta(7), "7");
  assert.equal(contagemCurta(999), "999");
});

test("de mil em diante, em mil, com uma casa abaixo de 10", () => {
  assert.equal(contagemCurta(1000), "1 mil");
  assert.equal(contagemCurta(1234), "1,2 mil");
  assert.equal(contagemCurta(1250), "1,2 mil");
  assert.equal(contagemCurta(9999), "9,9 mil");
  assert.equal(contagemCurta(12_345), "12 mil");
  assert.equal(contagemCurta(999_999), "999 mil");
});

test("de um milhão em diante, em mi", () => {
  assert.equal(contagemCurta(1_000_000), "1 mi");
  assert.equal(contagemCurta(1_234_567), "1,2 mi");
  assert.equal(contagemCurta(12_000_000), "12 mi");
});
