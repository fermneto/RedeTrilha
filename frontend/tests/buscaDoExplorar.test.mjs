// Testa termosDaBusca() e opcaoVizinha() de lib/api.ts (a busca do topo do
// Explorar), transpilando o arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { opcaoVizinha, termosDaBusca } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

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
