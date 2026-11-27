// Testa marcaDoVerso() de lib/api.ts (a marca da oficina ao lado de cada verso),
// transpilando o arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { importarLib } from "./importarLib.mjs";

const { marcaDoVerso } = await importarLib("api");

const verso = { silabas: 10, rima: "A", tipo_rima: "consoante" };

test("sílabas e rima ligadas", () => {
  assert.equal(marcaDoVerso(verso, { silabas: true, rimas: true }), "10 · A");
});

test("cada toggle sozinho", () => {
  assert.equal(marcaDoVerso(verso, { silabas: true, rimas: false }), "10");
  assert.equal(marcaDoVerso(verso, { silabas: false, rimas: true }), "A");
  assert.equal(marcaDoVerso(verso, { silabas: false, rimas: false }), "");
});

test("linha em branco ou fora da análise", () => {
  const branca = { silabas: null, rima: null, tipo_rima: null };
  assert.equal(marcaDoVerso(branca, { silabas: true, rimas: true }), "");
  assert.equal(marcaDoVerso(undefined, { silabas: true, rimas: true }), "");
});
