// Testa termosDaBusca(), opcaoVizinha() e caminhoDoAcervoComBusca() de lib/api.ts (a busca do topo do
// Explorar), transpilando o arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { importarLib } from "./importarLib.mjs";

const { caminhoDoAcervoComBusca, opcaoVizinha, termosDaBusca } = await importarLib("api");

test("texto solto procura tag (normalizada) e poeta", () => {
  assert.deepEqual(termosDaBusca("  Saudade "), { tag: "saudade", poeta: "Saudade" });
  assert.deepEqual(termosDaBusca("Cecília Meireles"), { tag: "ceciliameireles", poeta: "Cecília Meireles" });
});

test("# procura só tags, @ só poetas", () => {
  assert.deepEqual(termosDaBusca("#Solidão"), { tag: "solidao", poeta: "" });
  assert.deepEqual(termosDaBusca("@ana_ "), { tag: "", poeta: "ana_" });
  assert.deepEqual(termosDaBusca("#"), { tag: "", poeta: "" });
});

test("as setas dão a volta e começam pela ponta certa", () => {
  assert.equal(opcaoVizinha(-1, 3, 1), 0);
  assert.equal(opcaoVizinha(-1, 3, -1), 2);
  assert.equal(opcaoVizinha(2, 3, 1), 0);
  assert.equal(opcaoVizinha(0, 3, -1), 2);
  assert.equal(opcaoVizinha(0, 0, 1), -1);
});

test("ver todos os poetas abre a aba Poetas com a busca", () => {
  assert.equal(caminhoDoAcervoComBusca(" Cecília "), "/explorar?aba=poetas&q=Cec%C3%ADlia");
  assert.equal(caminhoDoAcervoComBusca("ana_"), "/explorar?aba=poetas&q=ana_");
});
