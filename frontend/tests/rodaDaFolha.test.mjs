// Testa o gesto de virar a página no touchpad (lib/rodaDaFolha.ts), transpilando
// o arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/rodaDaFolha.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { deslocamentoLateral, lerRoda, LIMIAR_DA_RODA, FIM_DO_GESTO_MS, RODA_PARADA } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const evento = (deltaX, deltaY, timeStamp, extra = {}) => ({ deltaX, deltaY, deltaMode: 0, shiftKey: false, timeStamp, ...extra });

// Passa uma sequência de eventos e devolve os passos de cada um.
function gesto(eventos, estado = RODA_PARADA) {
  const passos = [];
  for (const e of eventos) {
    const lido = lerRoda(estado, e);
    estado = lido.estado;
    passos.push(lido.passo);
  }
  return { passos, estado };
}

test("rolagem vertical nunca é lateral nem vira a página", () => {
  assert.equal(deslocamentoLateral(evento(0, 40, 0)), null);
  assert.equal(deslocamentoLateral(evento(10, 30, 0)), null);
  const { passos } = gesto(Array.from({ length: 30 }, (_, i) => evento(5, 80, i * 16)));
  assert.ok(passos.every((p) => p === 0));
});

test("deslizar para a esquerda (deltaX positivo) avança; para a direita volta", () => {
  assert.deepEqual(gesto([evento(30, 2, 0), evento(40, 0, 16)]).passos, [0, 1]);
  assert.deepEqual(gesto([evento(-30, 0, 0), evento(-40, 3, 16)]).passos, [0, -1]);
});

test("abaixo do limiar não vira", () => {
  const { passos } = gesto([evento(LIMIAR_DA_RODA / 2 - 1, 0, 0), evento(LIMIAR_DA_RODA / 2 - 1, 0, 16)]);
  assert.deepEqual(passos, [0, 0]);
});

test("um gesto com inércia longa vira uma folha só", () => {
  // Um segundo e meio de eventos a cada 16 ms, decaindo como a inércia do macOS.
  const eventos = Array.from({ length: 95 }, (_, i) => evento(Math.max(1, 60 * 0.96 ** i), 0, i * 16));
  const { passos } = gesto(eventos);
  assert.equal(passos.filter((p) => p !== 0).length, 1);
});

test("depois do silêncio, um gesto novo vira de novo", () => {
  const primeiro = gesto([evento(80, 0, 0), evento(80, 0, 16)]);
  assert.deepEqual(primeiro.passos, [1, 0]);
  const segundo = gesto([evento(80, 0, 16 + FIM_DO_GESTO_MS + 1)], primeiro.estado);
  assert.deepEqual(segundo.passos, [1]);
});

test("trocar de sentido no meio recomeça a conta", () => {
  const { passos } = gesto([evento(50, 0, 0), evento(-20, 0, 16), evento(-30, 0, 32)]);
  assert.deepEqual(passos, [0, 0, 0]);
});

test("Shift + roda vertical conta como lateral; linhas viram pixels", () => {
  assert.equal(deslocamentoLateral(evento(0, 3, 0, { shiftKey: true, deltaMode: 1 })), 48);
  assert.deepEqual(gesto([evento(0, 100, 0, { shiftKey: true })]).passos, [1]);
  assert.deepEqual(gesto([evento(0, -100, 0, { shiftKey: true })]).passos, [-1]);
});
