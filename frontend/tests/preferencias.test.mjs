// Testa as funções do onboarding (lib/api.ts), transpilando o arquivo como em
// anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { alternarNaLista, nomeDoPais } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("alternar marca e desmarca sem repetir", () => {
  assert.deepEqual(alternarNaLista([], "barroco"), ["barroco"]);
  assert.deepEqual(alternarNaLista(["barroco", "realismo"], "barroco"), ["realismo"]);
  assert.deepEqual(alternarNaLista(["realismo"], "modernismo_hispanico"), ["realismo", "modernismo_hispanico"]);
});

test("nome do país em português, ou o código", () => {
  assert.equal(nomeDoPais("BR"), "Brasil");
  assert.equal(nomeDoPais("PT"), "Portugal");
  assert.equal(nomeDoPais("??"), "??");
});
