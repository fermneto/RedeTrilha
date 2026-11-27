// Testa o texto de erro que as telas mostram (lib/api.ts), transpilando o
// arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { importarLib } from "./importarLib.mjs";

const { ErroDaApi, mensagemDeFalha } = await importarLib("api");

test("erro da API mostra o detail do backend", () => {
  assert.equal(mensagemDeFalha(new ErroDaApi("poema não encontrado", 404), "não deu"), "poema não encontrado");
});

test("Error comum (ex.: rede fora) mostra a própria mensagem", () => {
  assert.equal(mensagemDeFalha(new TypeError("Failed to fetch"), "não deu"), "Failed to fetch");
});

test("o que não é Error cai no texto padrão", () => {
  assert.equal(mensagemDeFalha("ops", "não deu para apagar"), "não deu para apagar");
  assert.equal(mensagemDeFalha(undefined, "não deu para apagar"), "não deu para apagar");
});
