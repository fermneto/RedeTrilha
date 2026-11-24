// Testa compararVersos() de lib/compararVersos.ts como o anosDeVida.test.mjs:
// transpila com o typescript do front e importa o módulo. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/compararVersos.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { compararVersos } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("versões iguais: tudo igual, inclusive linha vazia e recuo", () => {
  const poema = "um\n\n  dois";
  assert.deepEqual(compararVersos(poema, poema), [
    { tipo: "igual", verso: "um" },
    { tipo: "igual", verso: "" },
    { tipo: "igual", verso: "  dois" },
  ]);
});

test("verso trocado sai e entra no mesmo lugar", () => {
  assert.deepEqual(compararVersos("a\nb\nc", "a\nB\nc"), [
    { tipo: "igual", verso: "a" },
    { tipo: "saiu", verso: "b" },
    { tipo: "entrou", verso: "B" },
    { tipo: "igual", verso: "c" },
  ]);
});

test("verso acrescentado no fim e verso tirado do começo", () => {
  assert.deepEqual(compararVersos("a\nb", "b\nc"), [
    { tipo: "saiu", verso: "a" },
    { tipo: "igual", verso: "b" },
    { tipo: "entrou", verso: "c" },
  ]);
});

test("recuo diferente conta como verso diferente", () => {
  const tipos = compararVersos("verso", "  verso").map((l) => l.tipo);
  assert.deepEqual(tipos, ["saiu", "entrou"]);
});
