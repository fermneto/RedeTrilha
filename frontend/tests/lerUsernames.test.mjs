// Testa lerUsernames() de lib/api.ts (o campo de convidados da renga), como em
// anosDeVida.test.mjs: transpila o arquivo com o typescript do front e importa.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { lerUsernames } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("separa por vírgula e espaço e tira o @", () => {
  assert.deepEqual(lerUsernames("@ana, bia  @caio"), ["ana", "bia", "caio"]);
});

test("sem repetidos e em minúsculas", () => {
  assert.deepEqual(lerUsernames("Ana ana\n@ANA"), ["ana"]);
});

test("vazio vira lista vazia", () => {
  assert.deepEqual(lerUsernames("  ,  "), []);
});
