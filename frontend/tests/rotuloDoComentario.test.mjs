// Testa o rótulo do poema que subiu por comentário no "Para você" (lib/api.ts),
// transpilando o arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { importarLib } from "./importarLib.mjs";

const { rotuloDoComentario } = await importarLib("api");

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
