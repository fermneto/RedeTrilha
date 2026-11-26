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
const { abertaDireto, alternarNaLista, caminhoDasPreferencias, caminhoDosGostos, ehTelaDeBoasVindas, passoInicial, nomeDoPais, passosDasPreferencias } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

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
  assert.equal(caminhoDasPreferencias("/explorar?tag=amor", "ana"), "/preferencias?voltar=%2Fexplorar%3Ftag%3Damor");
  assert.equal(caminhoDasPreferencias("/", "ana"), "/preferencias?voltar=%2F");
  assert.equal(caminhoDasPreferencias("/preferencias?voltar=%2F", "ana"), "/preferencias?voltar=%2Fu%2Fana");
  assert.equal(caminhoDasPreferencias("/sugestoes", "ana"), "/preferencias?voltar=%2Fu%2Fana");
  assert.equal(caminhoDasPreferencias("/boas-vindas/quem-seguir", "ana"), "/preferencias?voltar=%2Fu%2Fana");
  assert.equal(caminhoDasPreferencias("/preferencias?voltar=%2F", "ana"), "/preferencias?voltar=%2Fu%2Fana");
  assert.equal(caminhoDasPreferencias("/sugestoes-antigas", "ana"), "/preferencias?voltar=%2Fsugestoes-antigas");
});

test("passos: os dois, ou só os gostos com ?so=gostos", () => {
  assert.deepEqual(passosDasPreferencias(null), ["gostos", "regiao"]);
  assert.deepEqual(passosDasPreferencias("regiao"), ["gostos", "regiao"]);
  assert.deepEqual(passosDasPreferencias("gostos"), ["gostos"]);
});

test("o link dos gostos abre só esse passo e volta para a grade de onde saiu", () => {
  for (const [grade, tela] of [["/sugestoes", "/preferencias"], ["/boas-vindas/quem-seguir", "/boas-vindas"]]) {
    const url = new URL(caminhoDosGostos(grade), "http://x");
    assert.equal(url.pathname, tela);
    assert.equal(url.searchParams.get("voltar"), grade);
    assert.deepEqual(passosDasPreferencias(url.searchParams.get("so")), ["gostos"]);
  }
});

test("o voltar da grade abre na região; sem ?passo=, no primeiro", () => {
  assert.equal(passoInicial(["gostos", "regiao"], "regiao"), 1);
  assert.equal(passoInicial(["gostos", "regiao"], null), 0);
  assert.equal(passoInicial(["gostos"], "regiao"), 0);
  assert.equal(passoInicial(["gostos", "regiao"], "lixo"), 0);
});

test("só as telas do onboarding ficam sem a navegação do site", () => {
  assert.equal(ehTelaDeBoasVindas("/boas-vindas"), true);
  assert.equal(ehTelaDeBoasVindas("/boas-vindas/quem-seguir"), true);
  assert.equal(ehTelaDeBoasVindas("/sugestoes"), false);
  assert.equal(ehTelaDeBoasVindas("/preferencias"), false);
  assert.equal(ehTelaDeBoasVindas("/boas-vindas-antigas"), false);
  assert.equal(ehTelaDeBoasVindas("/"), false);
});

test("cancelar: aberta direto nas preferências não tem página do Verso antes", () => {
  assert.equal(abertaDireto("http://x/boas-vindas?voltar=%2F"), true);
  assert.equal(abertaDireto("http://x/preferencias?voltar=%2F"), true);
  assert.equal(abertaDireto(undefined), true);
  assert.equal(abertaDireto("lixo"), true);
  assert.equal(abertaDireto("http://x/sugestoes"), false);
  assert.equal(abertaDireto("http://x/"), false);
});

test("gostos: o lugar com a UF por extenso, as formas sem \"outro\" e com o link do Explorar", async () => {
  const { lugarDosGostos, formasDoPerfil, caminhoDaForma } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  const vazio = { escolas: [], formas: [], pais: null, uf: null, mostrar_lugar: true };
  const ufs = [{ codigo: "PB", rotulo: "Paraíba" }];
  assert.equal(lugarDosGostos(vazio, ufs), null);
  assert.equal(lugarDosGostos({ ...vazio, pais: "BR", uf: "PB" }, ufs), "Paraíba, Brasil");
  assert.equal(lugarDosGostos({ ...vazio, pais: "PT" }, ufs), "Portugal");
  assert.deepEqual(formasDoPerfil(["soneto", "outro", "verso_livre"]), ["soneto", "verso_livre"]);
  assert.deepEqual(formasDoPerfil(["outro"]), []);
  assert.equal(caminhoDaForma("verso_livre"), "/explorar?forma=verso_livre");
});
