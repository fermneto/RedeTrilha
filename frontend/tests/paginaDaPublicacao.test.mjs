// Testa as partes puras da página da publicação em lib/api.ts: a data por
// extenso, com a hora, e o "mais do autor" tirado da página do perfil,
// transpilando o arquivo como em avisos.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

process.env.TZ = "America/Sao_Paulo";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { formatarDataEHora, formatarDataPorExtenso, outrosPoemas } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

test("a data da publicação vem por extenso, com a hora no fuso de quem lê", () => {
  // O SQLite devolve sem o "Z": é UTC mesmo assim.
  assert.equal(formatarDataEHora("2026-11-26T17:32:00"), "26 de nov. de 2026, 14:32");
  assert.equal(formatarDataPorExtenso("2026-11-26T17:32:00Z"), "26 de nov. de 2026");
});

const ana = 1;
const poema = (id, extra = {}) => ({
  tipo: "poema",
  id,
  autor_id: ana,
  texto: `verso ${id}`,
  repost_de_id: null,
  renga_citada_id: null,
  repost_removido: false,
  ...extra,
});

test("mais do autor: só os poemas dele, sem o aberto, até a quantidade pedida", () => {
  const itens = [
    poema(9),
    poema(5),
    { tipo: "renga", renga: { id: 2 } },
    poema(7, { repost_de_id: 3 }),
    poema(6, { renga_citada_id: 2 }),
    // Repost puro no perfil: o original, de outra pessoa.
    poema(4, { autor_id: 2 }),
    poema(3),
    poema(2),
  ];
  assert.deepEqual(outrosPoemas(itens, ana, { tipo: "poema", id: 9 }, 2).map((p) => p.id), [5, 3]);
  // Na renga, nada a tirar pelo id.
  assert.deepEqual(outrosPoemas(itens, ana, { tipo: "renga", id: 9 }, 3).map((p) => p.id), [9, 5, 3]);
});
