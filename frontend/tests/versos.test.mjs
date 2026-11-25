// Testa as funções da crítica ancorada no verso (#71) de lib/api.ts, transpilando
// o arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { ancoraCobreOVerso, caminhoDaCitacaoDeVersos, referenciaDosVersos, selecionarVerso, trechoDosVersos, versosDaSelecao, versosDoPoema } =
  await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

const POEMA = "  Minha terra tem palmeiras,\nOnde canta o Sabiá;\n\nAs aves, que aqui gorjeiam,\n  Não gorjeiam como lá.";

test("a linha em branco entre estrofes conta como verso, como no backend", () => {
  assert.equal(versosDoPoema(POEMA).length, 5);
  assert.equal(trechoDosVersos(POEMA, { inicio: 4, fim: 5 }), "As aves, que aqui gorjeiam,\n  Não gorjeiam como lá.");
});

test("o trecho guarda recuos e quebras", () => {
  assert.equal(trechoDosVersos(POEMA, { inicio: 1, fim: 3 }), "  Minha terra tem palmeiras,\nOnde canta o Sabiá;\n");
});

test("referência no singular e no plural", () => {
  assert.equal(referenciaDosVersos({ inicio: 5, fim: 5 }), "verso 5");
  assert.equal(referenciaDosVersos({ inicio: 5, fim: 8 }), "versos 5–8");
});

test("a seleção de texto vira os versos inteiros que ela toca", () => {
  assert.deepEqual(versosDaSelecao(POEMA, [2]), { inicio: 2, fim: 2 });
  assert.deepEqual(versosDaSelecao(POEMA, [1, 2, 3, 4]), { inicio: 1, fim: 4 });
});

test("as linhas em branco das pontas saem da seleção; só elas não selecionam nada", () => {
  assert.deepEqual(versosDaSelecao(POEMA, [2, 3]), { inicio: 2, fim: 2 });
  assert.deepEqual(versosDaSelecao(POEMA, [3, 4]), { inicio: 4, fim: 4 });
  assert.equal(versosDaSelecao(POEMA, [3]), null);
  assert.equal(versosDaSelecao(POEMA, []), null);
});

test("pelo teclado: um clique, outro estende, o mesmo desfaz e um intervalo recomeça", () => {
  assert.deepEqual(selecionarVerso(null, 4), { inicio: 4, fim: 4 });
  assert.deepEqual(selecionarVerso({ inicio: 4, fim: 4 }, 2), { inicio: 2, fim: 4 });
  assert.deepEqual(selecionarVerso({ inicio: 4, fim: 4 }, 5), { inicio: 4, fim: 5 });
  assert.equal(selecionarVerso({ inicio: 4, fim: 4 }, 4), null);
  assert.deepEqual(selecionarVerso({ inicio: 2, fim: 4 }, 3), { inicio: 3, fim: 3 });
});

test("citar estes versos abre o compositor de citação com o trecho", () => {
  const url = new URL(caminhoDaCitacaoDeVersos(7, "um\n  dois"), "http://x");
  assert.equal(url.pathname, "/escrever");
  assert.equal(url.searchParams.get("citar"), "7");
  assert.equal(url.searchParams.get("versos"), "um\n  dois");
});

test("o filtro do verso só deixa passar a crítica cuja âncora cobre o verso", () => {
  const ancora = { verso_inicio: 2, verso_fim: 4, trecho: "" };
  assert.equal(ancoraCobreOVerso(ancora, null), true);
  assert.equal(ancoraCobreOVerso(null, null), true);
  assert.equal(ancoraCobreOVerso(ancora, 2), true);
  assert.equal(ancoraCobreOVerso(ancora, 4), true);
  assert.equal(ancoraCobreOVerso(ancora, 7), false);
  assert.equal(ancoraCobreOVerso(ancora, 1), false);
  assert.equal(ancoraCobreOVerso(null, 7), false);
});

// #137: o poema pode ter negrito, itálico, sublinhado e tachado no texto.
const FORMATADO = "**Minha terra** tem *palmeiras*,\nOnde canta o ~~Sabiá~~;\n\n++As aves++";

test("com marcas, a numeração não muda e a citação de versos leva as marcas", () => {
  assert.equal(versosDoPoema(FORMATADO).length, 4);
  assert.equal(trechoDosVersos(FORMATADO, { inicio: 1, fim: 2 }), "**Minha terra** tem *palmeiras*,\nOnde canta o ~~Sabiá~~;");
  assert.deepEqual(versosDaSelecao(FORMATADO, [2, 3]), { inicio: 2, fim: 2 });
  const caminho = caminhoDaCitacaoDeVersos(7, trechoDosVersos(FORMATADO, { inicio: 4, fim: 4 }));
  assert.equal(new URL(caminho, "http://x").searchParams.get("versos"), "++As aves++");
});
