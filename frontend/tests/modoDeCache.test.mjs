// Quais requisições usam o cache do navegador (lib/api.ts), transpilando o
// arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { modoDeCache } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("as rotas com Cache-Control no backend respeitam o header, com ou sem query", () => {
  for (const path of [
    "/tags/trending?limit=10",
    "/tags/busca?q=mar",
    "/acervo/filtros",
    "/preferencias/opcoes",
    "/usuarios?offset=0&limit=100",
  ]) {
    assert.equal(modoDeCache("GET", path), "default", path);
  }
});

test("rotas com dado de quem pede continuam no-store", () => {
  for (const path of [
    "/feed",
    "/feed/para-voce",
    "/poemas/do-dia",
    "/usuarios/fernando_pessoa",
    "/usuarios/fernando_pessoa/posts",
    "/acervo?tipo=consagrados",
    "/tags/mar/posts",
    "/preferencias",
  ]) {
    assert.equal(modoDeCache("GET", path), "no-store", path);
  }
});

test("só GET usa o cache", () => {
  assert.equal(modoDeCache("POST", "/usuarios"), "no-store");
  assert.equal(modoDeCache("PUT", "/preferencias/opcoes"), "no-store");
});
