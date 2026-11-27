// Testa contagemCurta() de lib/numeros.ts: o número dos contadores da fileira de
// ações (components/BarraDeAcoes.tsx), e noPlural(). Transpila o arquivo como em
// hashtag.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/numeros.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { contagemCurta, noPlural } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("até 999 o número vem inteiro", () => {
  assert.equal(contagemCurta(0), "0");
  assert.equal(contagemCurta(7), "7");
  assert.equal(contagemCurta(999), "999");
});

test("de mil em diante, em k, com uma casa abaixo de 10", () => {
  assert.equal(contagemCurta(1000), "1k");
  assert.equal(contagemCurta(1234), "1,2k");
  assert.equal(contagemCurta(1250), "1,2k");
  assert.equal(contagemCurta(9999), "9,9k");
  assert.equal(contagemCurta(12_345), "12k");
  assert.equal(contagemCurta(999_999), "999k");
});

test("de um milhão em diante, em M", () => {
  assert.equal(contagemCurta(1_000_000), "1M");
  assert.equal(contagemCurta(1_234_567), "1,2M");
  assert.equal(contagemCurta(12_000_000), "12M");
});

test("noPlural: o singular só para 1", () => {
  assert.equal(noPlural(1, "poema", "poemas"), "poema");
  assert.equal(noPlural(0, "poema", "poemas"), "poemas");
  assert.equal(noPlural(3, "poema", "poemas"), "poemas");
});
