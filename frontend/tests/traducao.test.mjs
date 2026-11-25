// Testa a tradução no lugar do original (lib/traducao.ts), transpilando o arquivo
// como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/traducao.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { SEM_TRADUCAO, alternarTraducao, traducaoChegou, traducaoFalhou, textoExibido, rotuloDoBotao } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const ORIGINAL = { titulo: "L'Albatros", texto: "Souvent, **pour s'amuser**,\n\n  les hommes d'équipage" };
const TRADUCAO = { titulo: "O Albatroz", texto: "Às vezes, **por diversão**,\n\n  os homens da tripulação", idioma_destino: "pt" };

test("o primeiro clique pede a busca e não mostra nada ainda", () => {
  const { estado, buscar } = alternarTraducao(SEM_TRADUCAO);
  assert.equal(buscar, true);
  assert.equal(estado.carregando, true);
  assert.equal(estado.mostrando, false);
  assert.equal(rotuloDoBotao(SEM_TRADUCAO), "Traduzir");
  assert.equal(rotuloDoBotao(estado), "Traduzindo…");
  assert.deepEqual(textoExibido(ORIGINAL, estado), { ...ORIGINAL, traduzido: false, lang: null });
});

test("clicar de novo enquanto carrega não busca outra vez", () => {
  const carregando = alternarTraducao(SEM_TRADUCAO).estado;
  const { estado, buscar } = alternarTraducao(carregando);
  assert.equal(buscar, false);
  assert.equal(estado, carregando);
});

test("a tradução chega e toma o lugar do título e do corpo, com as marcas e recuos", () => {
  const estado = traducaoChegou(alternarTraducao(SEM_TRADUCAO).estado, TRADUCAO);
  assert.equal(estado.mostrando, true);
  assert.equal(rotuloDoBotao(estado), "ver original");
  assert.deepEqual(textoExibido(ORIGINAL, estado), {
    titulo: "O Albatroz",
    texto: TRADUCAO.texto,
    traduzido: true,
    lang: "pt",
  });
});

test("ver original volta ao original e ver tradução reaproveita a que já veio", () => {
  const traduzido = traducaoChegou(alternarTraducao(SEM_TRADUCAO).estado, TRADUCAO);
  const voltou = alternarTraducao(traduzido);
  assert.equal(voltou.buscar, false);
  assert.equal(voltou.estado.mostrando, false);
  assert.equal(voltou.estado.traducao, TRADUCAO);
  assert.equal(rotuloDoBotao(voltou.estado), "ver tradução");
  assert.equal(textoExibido(ORIGINAL, voltou.estado).texto, ORIGINAL.texto);

  const deNovo = alternarTraducao(voltou.estado);
  assert.equal(deNovo.buscar, false);
  assert.equal(deNovo.estado.mostrando, true);
  assert.equal(textoExibido(ORIGINAL, deNovo.estado).texto, TRADUCAO.texto);
});

test("tradução sem título mantém o título original", () => {
  const estado = traducaoChegou(SEM_TRADUCAO, { ...TRADUCAO, titulo: null });
  assert.equal(textoExibido(ORIGINAL, estado).titulo, "L'Albatros");
  assert.equal(textoExibido({ titulo: null, texto: "x" }, estado).titulo, null);
});

test("a falha mostra o erro, fica no original e o próximo clique tenta de novo", () => {
  const falhou = traducaoFalhou(alternarTraducao(SEM_TRADUCAO).estado, "tradução indisponível agora");
  assert.equal(falhou.erro, "tradução indisponível agora");
  assert.equal(falhou.carregando, false);
  assert.equal(textoExibido(ORIGINAL, falhou).traduzido, false);
  const { estado, buscar } = alternarTraducao(falhou);
  assert.equal(buscar, true);
  assert.equal(estado.erro, null);
});
