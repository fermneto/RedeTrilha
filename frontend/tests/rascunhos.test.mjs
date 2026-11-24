// Testa a data e a prévia da lista de Rascunhos (lib/api.ts), transpilando o
// arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { previaDoRascunho, quandoEditado } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("editado hoje e ontem mostram a hora; antes disso, a data", () => {
  const agora = new Date(2026, 10, 24, 15, 0);
  const iso = (d) => d.toISOString();
  assert.match(quandoEditado(iso(new Date(2026, 10, 24, 9, 5)), agora), /^hoje, 09:05$/);
  assert.match(quandoEditado(iso(new Date(2026, 10, 23, 23, 59)), agora), /^ontem, 23:59$/);
  assert.equal(quandoEditado(iso(new Date(2026, 10, 12, 10, 0)), agora), "12/11/2026");
});

test("a data do SQLite, sem fuso, é lida como UTC", () => {
  const agora = new Date("2026-11-24T18:00:00Z");
  assert.equal(quandoEditado("2026-11-24T12:00:00", agora), quandoEditado("2026-11-24T12:00:00Z", agora));
});

test("a prévia pula as linhas em branco do começo e guarda a quebra entre estrofes", () => {
  const texto = "\n\nprimeiro verso\nsegundo\n\nterceiro\nquarto\n";
  assert.deepEqual(previaDoRascunho(texto, 4), { previa: "primeiro verso\nsegundo\n\nterceiro", versos: 4, cortado: true });
  assert.deepEqual(previaDoRascunho(texto, 10), { previa: "primeiro verso\nsegundo\n\nterceiro\nquarto", versos: 4, cortado: false });
});

test("a prévia não termina numa linha em branco e não mexe no recuo do verso", () => {
  assert.deepEqual(previaDoRascunho("um\ndois\n\n\ttrês", 3), { previa: "um\ndois", versos: 3, cortado: true });
  assert.equal(previaDoRascunho("\tum", 3).previa, "\tum");
});
