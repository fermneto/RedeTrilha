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
const { achadas, ALTURA_MAXIMA_DA_LISTA, filtrarOpcoes, lugarDaLista, semAcentos } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

// A primeira é a sem valor ("prefiro não dizer"); as outras têm valor = rótulo,
// ou a sigla dada como "Rótulo:SIGLA".
const opcoes = (...rotulos) =>
  rotulos.map((r, i) => {
    const [rotulo, sigla] = r.split(":");
    return { valor: i === 0 ? null : (sigla ?? rotulo), rotulo };
  });
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
  assert.deepEqual(rotulos(filtrarOpcoes(ufs, "sao")), ["prefiro não dizer", "São Paulo"]);
  assert.deepEqual(rotulos(filtrarOpcoes(ufs, "PARAI")), ["prefiro não dizer", "Paraíba"]);
});

test("quem começa pelo termo vem antes de quem só o contém", () => {
  const paises = opcoes("prefiro não dizer", "Brasil", "Nicarágua", "Papua-Nova Guiné", "Porto Rico", "Portugal", "Guatemala", "Guiné");
  const lugares = (busca) => rotulos(filtrarOpcoes(paises, busca)).slice(1);
  assert.deepEqual(lugares("por"), ["Porto Rico", "Portugal"]);
  assert.deepEqual(lugares("gua"), ["Guatemala", "Nicarágua"]);
  assert.deepEqual(lugares("guine"), ["Guiné", "Papua-Nova Guiné"]);
});

test("\"prefiro não dizer\" fica sempre no topo e não conta como achada", () => {
  const paises = opcoes("prefiro não dizer", "Brasil:BR", "Portugal:PT");
  assert.deepEqual(rotulos(filtrarOpcoes(paises, "port")), ["prefiro não dizer", "Portugal"]);
  assert.equal(achadas(filtrarOpcoes(paises, "port")), 1);
});

test("acha pela sigla, e a sigla exata vem primeiro", () => {
  const paises = opcoes("prefiro não dizer", "Brasil:BR", "Portugal:PT", "Peru:PE");
  assert.deepEqual(rotulos(filtrarOpcoes(paises, "br")), ["prefiro não dizer", "Brasil"]);
  assert.deepEqual(rotulos(filtrarOpcoes(paises, "PT")), ["prefiro não dizer", "Portugal"]);
  const ufs = opcoes("prefiro não dizer", "Pará:PA", "Paraíba:PB", "Paraná:PR", "Pernambuco:PE");
  assert.deepEqual(rotulos(filtrarOpcoes(ufs, "pb")), ["prefiro não dizer", "Paraíba"]);
  assert.deepEqual(rotulos(filtrarOpcoes(ufs, "pe")), ["prefiro não dizer", "Pernambuco"]);
  assert.deepEqual(rotulos(filtrarOpcoes(ufs, "pa")), ["prefiro não dizer", "Pará", "Paraíba", "Paraná"]);
});

test("sem nada que bata, sobra só \"prefiro não dizer\"", () => {
  const achou = filtrarOpcoes(opcoes("prefiro não dizer", "Brasil"), "xyz");
  assert.deepEqual(rotulos(achou), ["prefiro não dizer"]);
  assert.equal(achadas(achou), 0);
});

test("a lista abre para baixo, e para cima só se lá couber mais", () => {
  assert.deepEqual(lugarDaLista(600, 100), { lado: "abaixo", altura: ALTURA_MAXIMA_DA_LISTA });
  assert.deepEqual(lugarDaLista(200.6, 400), { lado: "abaixo", altura: 200 });
  assert.deepEqual(lugarDaLista(120, 400), { lado: "acima", altura: ALTURA_MAXIMA_DA_LISTA });
  assert.deepEqual(lugarDaLista(120, 80), { lado: "abaixo", altura: 132 });
});
