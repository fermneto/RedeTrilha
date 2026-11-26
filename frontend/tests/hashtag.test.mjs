// Testa hashtag() de lib/api.ts: como a tag aparece na tela. A forma composta
// junta as palavras (#versolivre) e o link continua com o "_" (caminhoDaTag).
// Transpila o arquivo como em lerUsernames.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { caminhoDaTag, hashtag } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("forma composta aparece sem o sublinhado", () => {
  assert.equal(hashtag("verso_livre"), "#versolivre");
  assert.equal(hashtag("prosa_poetica"), "#prosapoetica");
});

test("forma simples aparece como é", () => {
  assert.equal(hashtag("soneto"), "#soneto");
});

test("tag que não é forma fica como é, com o sublinhado", () => {
  assert.equal(hashtag("amor"), "#amor");
  assert.equal(hashtag("noite_fria"), "#noite_fria");
});

test("o link da forma continua com o valor de sempre", () => {
  assert.equal(caminhoDaTag("verso_livre"), "/explorar?forma=verso_livre");
});
