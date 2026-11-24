// Testa o texto de erro que as telas mostram (lib/api.ts), transpilando o
// arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { ErroDaApi, mensagemDeFalha } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

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
