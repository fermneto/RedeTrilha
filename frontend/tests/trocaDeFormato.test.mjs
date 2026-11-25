// Testa a passagem do poema para a renga (lib/trocaDeFormato.ts), transpilando o
// arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/trocaDeFormato.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { guardarPoemaParaRenga, lerPoemaParaRenga, temPoema } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

function armazem() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    dados,
  };
}

test("o poema vira a 1ª estrofe com as quebras e os recuos intactos", () => {
  const a = armazem();
  const texto = "\n  chove na rua\n\n    e o verso **molha**\n";
  guardarPoemaParaRenga({ titulo: "  Chuva  ", texto }, a);
  assert.deepEqual(lerPoemaParaRenga(a), { titulo: "Chuva", estrofe: texto });
});

test("lê uma vez só: voltar à página não preenche de novo", () => {
  const a = armazem();
  guardarPoemaParaRenga({ titulo: "", texto: "um verso" }, a);
  assert.equal(lerPoemaParaRenga(a).estrofe, "um verso");
  assert.equal(lerPoemaParaRenga(a), null);
});

test("corpo em branco não leva nada", () => {
  const a = armazem();
  guardarPoemaParaRenga({ titulo: "Só título", texto: "  \n \n" }, a);
  assert.equal(a.dados.size, 0);
  assert.equal(temPoema(" \n\t"), false);
  assert.equal(temPoema(" a "), true);
});

test("sem armazenamento ou com valor estranho, segue sem poema", () => {
  assert.equal(lerPoemaParaRenga(null), null);
  guardarPoemaParaRenga({ titulo: "x", texto: "y" }, null);
  const a = armazem();
  a.setItem("verso:poema-para-renga", "{quebrado");
  assert.equal(lerPoemaParaRenga(a), null);
  a.setItem("verso:poema-para-renga", JSON.stringify({ titulo: 1, estrofe: "y" }));
  assert.equal(lerPoemaParaRenga(a), null);
});
