// Testa as funções do onboarding (lib/api.ts), transpilando o arquivo como em
// anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { abertaDireto, alternarNaLista, caminhoDasPreferencias, caminhoDosGostos, ehTelaDeBoasVindas, nomeDoPais, passosDasPreferencias } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("alternar marca e desmarca sem repetir", () => {
  assert.deepEqual(alternarNaLista([], "barroco"), ["barroco"]);
  assert.deepEqual(alternarNaLista(["barroco", "realismo"], "barroco"), ["realismo"]);
  assert.deepEqual(alternarNaLista(["realismo"], "modernismo_hispanico"), ["realismo", "modernismo_hispanico"]);
});

test("nome do país em português, ou o código", () => {
  assert.equal(nomeDoPais("BR"), "Brasil");
  assert.equal(nomeDoPais("PT"), "Portugal");
  assert.equal(nomeDoPais("??"), "??");
});

test("preferências pelo menu voltam à página atual, ou ao perfil vindo do onboarding", () => {
  assert.equal(caminhoDasPreferencias("/explorar?tag=amor", "ana"), "/boas-vindas?voltar=%2Fexplorar%3Ftag%3Damor");
  assert.equal(caminhoDasPreferencias("/", "ana"), "/boas-vindas?voltar=%2F");
  assert.equal(caminhoDasPreferencias("/boas-vindas?voltar=%2F", "ana"), "/boas-vindas?voltar=%2Fu%2Fana");
  assert.equal(caminhoDasPreferencias("/sugestoes", "ana"), "/boas-vindas?voltar=%2Fu%2Fana");
  assert.equal(caminhoDasPreferencias("/boas-vindas/quem-seguir", "ana"), "/boas-vindas?voltar=%2Fu%2Fana");
  assert.equal(caminhoDasPreferencias("/sugestoes-antigas", "ana"), "/boas-vindas?voltar=%2Fsugestoes-antigas");
});

test("passos: os dois, ou só os gostos com ?so=gostos", () => {
  assert.deepEqual(passosDasPreferencias(null), ["gostos", "regiao"]);
  assert.deepEqual(passosDasPreferencias("regiao"), ["gostos", "regiao"]);
  assert.deepEqual(passosDasPreferencias("gostos"), ["gostos"]);
});

test("o link dos gostos abre só esse passo e volta para a grade de onde saiu", () => {
  for (const grade of ["/sugestoes", "/boas-vindas/quem-seguir"]) {
    const url = new URL(caminhoDosGostos(grade), "http://x");
    assert.equal(url.pathname, "/boas-vindas");
    assert.equal(url.searchParams.get("voltar"), grade);
    assert.deepEqual(passosDasPreferencias(url.searchParams.get("so")), ["gostos"]);
  }
});

test("só as telas do onboarding ficam sem a navegação do site", () => {
  assert.equal(ehTelaDeBoasVindas("/boas-vindas"), true);
  assert.equal(ehTelaDeBoasVindas("/boas-vindas/quem-seguir"), true);
  assert.equal(ehTelaDeBoasVindas("/sugestoes"), false);
  assert.equal(ehTelaDeBoasVindas("/boas-vindas-antigas"), false);
  assert.equal(ehTelaDeBoasVindas("/"), false);
});

test("cancelar: aberta direto em /boas-vindas não tem página do Verso antes", () => {
  assert.equal(abertaDireto("http://x/boas-vindas?voltar=%2F"), true);
  assert.equal(abertaDireto(undefined), true);
  assert.equal(abertaDireto("lixo"), true);
  assert.equal(abertaDireto("http://x/sugestoes"), false);
  assert.equal(abertaDireto("http://x/"), false);
});
