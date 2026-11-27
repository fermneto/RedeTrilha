// Testa lerUsernames() de lib/api.ts (o campo de convidados da renga), como em
// anosDeVida.test.mjs: transpila o arquivo com o typescript do front e importa.
import assert from "node:assert/strict";
import { test } from "node:test";

import { importarLib } from "./importarLib.mjs";

const { lerUsernames } = await importarLib("api");

test("separa por vírgula e espaço e tira o @", () => {
  assert.deepEqual(lerUsernames("@ana, bia  @caio"), ["ana", "bia", "caio"]);
});

test("sem repetidos e em minúsculas", () => {
  assert.deepEqual(lerUsernames("Ana ana\n@ANA"), ["ana"]);
});

test("vazio vira lista vazia", () => {
  assert.deepEqual(lerUsernames("  ,  "), []);
});
