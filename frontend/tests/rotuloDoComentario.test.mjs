// Testa o rótulo do poema que subiu por comentário no "Para você" (lib/api.ts),
// transpilando o arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { rotuloDoComentario } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

const pessoas = (n) => Array.from({ length: n }, (_, i) => ({ username: `p${i}` }));

test("sem subiu_por (feed Seguindo, perfil) não há rótulo", () => {
  assert.equal(rotuloDoComentario({ subiu_por: null, comentado_por: [] }), null);
  assert.equal(rotuloDoComentario({}), null);
});

test("comentário no singular e no plural", () => {
  assert.deepEqual(rotuloDoComentario({ subiu_por: "comentario", comentado_por: pessoas(1) }), {
    resto: 0,
    verbo: "comentou",
  });
  assert.deepEqual(rotuloDoComentario({ subiu_por: "comentario", comentado_por: pessoas(2) }), {
    resto: 0,
    verbo: "comentaram",
  });
});

test("crítica nos versos conta quem passa dos dois nomes", () => {
  assert.deepEqual(rotuloDoComentario({ subiu_por: "critica", comentado_por: pessoas(4) }), {
    resto: 2,
    verbo: "criticaram os versos",
  });
  assert.equal(rotuloDoComentario({ subiu_por: "critica", comentado_por: pessoas(1) }).verbo, "criticou os versos");
});
