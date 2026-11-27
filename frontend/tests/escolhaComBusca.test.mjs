// Testa lib/escolhaComBusca.ts (o campo de país e de estado das Preferências),
// transpilando o arquivo como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/escolhaComBusca.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { ALTURA_MAXIMA_DA_LISTA, filtrarOpcoes, lugarDaLista, semAcentos } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const opcoes = (...rotulos) => rotulos.map((rotulo, i) => ({ valor: i === 0 ? null : rotulo, rotulo }));
const rotulos = (lista) => lista.map((o) => o.rotulo);

test("tira acento e caixa", () => {
  assert.equal(semAcentos("São Tomé e Príncipe"), "sao tome e principe");
  assert.equal(semAcentos("CÔTE"), "cote");
});

test("busca vazia devolve tudo, na ordem de antes", () => {
  const paises = opcoes("prefiro não dizer", "Brasil", "Alemanha");
  assert.deepEqual(filtrarOpcoes(paises, ""), paises);
  assert.deepEqual(filtrarOpcoes(paises, "   "), paises);
});

test("acha sem acento e sem caixa", () => {
  const ufs = opcoes("prefiro não dizer", "Paraíba", "São Paulo", "Rio Grande do Sul");
  assert.deepEqual(rotulos(filtrarOpcoes(ufs, "sao")), ["São Paulo"]);
  assert.deepEqual(rotulos(filtrarOpcoes(ufs, "PARAI")), ["Paraíba"]);
  assert.deepEqual(rotulos(filtrarOpcoes(ufs, "não")), ["prefiro não dizer"]);
});

test("quem começa pelo termo vem antes de quem só o contém", () => {
  const paises = opcoes("prefiro não dizer", "Brasil", "Nicarágua", "Papua-Nova Guiné", "Porto Rico", "Portugal", "Guatemala", "Guiné");
  assert.deepEqual(rotulos(filtrarOpcoes(paises, "por")), ["Porto Rico", "Portugal"]);
  assert.deepEqual(rotulos(filtrarOpcoes(paises, "gua")), ["Guatemala", "Nicarágua"]);
  assert.deepEqual(rotulos(filtrarOpcoes(paises, "guine")), ["Guiné", "Papua-Nova Guiné"]);
});

test("sem nada que bata, a lista fica vazia", () => {
  assert.deepEqual(filtrarOpcoes(opcoes("prefiro não dizer", "Brasil"), "xyz"), []);
});

test("a lista abre para baixo, e para cima só se lá couber mais", () => {
  assert.deepEqual(lugarDaLista(600, 100), { lado: "abaixo", altura: ALTURA_MAXIMA_DA_LISTA });
  assert.deepEqual(lugarDaLista(200.6, 400), { lado: "abaixo", altura: 200 });
  assert.deepEqual(lugarDaLista(120, 400), { lado: "acima", altura: ALTURA_MAXIMA_DA_LISTA });
  assert.deepEqual(lugarDaLista(120, 80), { lado: "abaixo", altura: 132 });
});
