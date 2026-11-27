// Testa anosDeVida() de lib/api.ts sem test runner extra: importarLib.mjs
// transpila o arquivo com o typescript do próprio front. Rode com `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { importarLib } from "./importarLib.mjs";

const { anosDeVida } = await importarLib("api");

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
