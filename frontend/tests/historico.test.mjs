// Testa lib/historico.ts, o caminho que o "voltar" das páginas de publicação
// segue, transpilando o arquivo como em sessaoDoFeed.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/historico.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { anotar, historicoVazio, temAnterior } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const andar = (caminhos, inicio = historicoVazio()) => caminhos.reduce(anotar, inicio);
const voltar = (h, caminho) => anotar({ ...h, voltando: true }, caminho);

test("link direto: sem página anterior, o voltar vai para o Início", () => {
  assert.equal(temAnterior(andar(["/poema/3"])), false);
});

test("do feed para o poema: há para onde voltar", () => {
  assert.equal(temAnterior(andar(["/", "/poema/3"])), true);
});

test("a mesma rota de novo (só mudou o # ou a busca) não empilha", () => {
  assert.deepEqual(andar(["/", "/poema/3", "/poema/3"]).pilha, ["/", "/poema/3"]);
});

test("o voltar do navegador desempilha: no link direto, volta a não ter anterior", () => {
  const h = andar(["/poema/3", "/poema/8"]);
  const depois = voltar(h, "/poema/3");
  assert.deepEqual(depois.pilha, ["/poema/3"]);
  assert.equal(temAnterior(depois), false);
});

test("o avançar do navegador (popstate para uma rota nova) empilha", () => {
  const h = voltar(andar(["/", "/poema/3"]), "/");
  assert.deepEqual(voltar(h, "/poema/3").pilha, ["/", "/poema/3"]);
});
