// Testa anosDeVida() de lib/api.ts sem test runner extra: transpila o arquivo com
// o typescript do próprio front e importa o módulo. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { anosDeVida } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

const consagrado = (nascimento, morte) => ({ consagrado: true, nascimento, morte });

test("anos depois de Cristo", () => {
  assert.equal(anosDeVida(consagrado(1861, 1898)), "1861–1898");
  assert.equal(anosDeVida(consagrado(null, 1898)), "m. 1898");
});

test("os dois anos antes de Cristo", () => {
  assert.equal(anosDeVida(consagrado(-800, -700)), "800–700 a.C.");
});

test("só o nascimento antes de Cristo", () => {
  assert.equal(anosDeVida(consagrado(-70, 19)), "70 a.C.–19");
});

test("só a morte, antes de Cristo", () => {
  assert.equal(anosDeVida(consagrado(null, -55)), "m. 55 a.C.");
});

test("sem a morte ou não consagrado", () => {
  assert.equal(anosDeVida(consagrado(1900, null)), null);
  assert.equal(anosDeVida({ consagrado: false, nascimento: 1861, morte: 1898 }), null);
});
