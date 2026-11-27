// Testa para onde abre o popover "adicionar à antologia" (lib/popover.ts, #62).
// Rode com `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { importarLib } from "./importarLib.mjs";

const { abrirParaCima, faixaVisivel } = await importarLib("popover");

test("sem recorte nem nada preso, a faixa é a janela", () => {
  assert.deepEqual(faixaVisivel(900, null, [], 100), { inicio: 0, fim: 900 });
});

test("o contêiner que rola recorta a faixa", () => {
  assert.deepEqual(faixaVisivel(900, { inicio: 28, fim: 872 }, [], 100), { inicio: 28, fim: 872 });
});

test("o pé da conversa abaixo do botão encurta a faixa (#62)", () => {
  assert.deepEqual(faixaVisivel(900, { inicio: 28, fim: 872 }, [444], 142), { inicio: 28, fim: 444 });
});

test("o que fica acima do botão não encurta a faixa", () => {
  assert.deepEqual(faixaVisivel(900, null, [80], 142), { inicio: 0, fim: 900 });
});

test("vale o mais alto entre a barra fixa e o pé da conversa", () => {
  assert.deepEqual(faixaVisivel(844, null, [788, 426], 100), { inicio: 0, fim: 426 });
});

test("cabe embaixo: abre embaixo", () => {
  assert.equal(abrirParaCima({ topo: 100, base: 140 }, 300, { inicio: 0, fim: 900 }), false);
});

test("não cabe embaixo e em cima há mais espaço: abre para cima", () => {
  assert.equal(abrirParaCima({ topo: 600, base: 640 }, 343, { inicio: 0, fim: 740 }), true);
});

test("o pé da conversa conta como fim da tela", () => {
  const faixa = faixaVisivel(900, { inicio: 28, fim: 872 }, [600], 640);
  assert.equal(abrirParaCima({ topo: 500, base: 540 }, 343, faixa), true);
});

test("não cabe em lugar nenhum e embaixo há mais espaço: continua embaixo", () => {
  const faixa = faixaVisivel(900, { inicio: 28, fim: 872 }, [444], 142);
  assert.equal(abrirParaCima({ topo: 108, base: 142 }, 343, faixa), false);
});

test("o espaço de cima começa no topo do contêiner, não no da janela", () => {
  // Na janela haveria 400px acima; no contêiner, só 100.
  assert.equal(abrirParaCima({ topo: 400, base: 440 }, 343, { inicio: 300, fim: 700 }), false);
});
