// Testa as partes puras das mensagens diretas em lib/api.ts (o leitor do stream SSE,
// a espera da reconexão, a prévia da caixa e o "Visto"), transpilando o arquivo como
// em rascunhos.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { importarLib } from "./importarLib.mjs";

const { lerEventosDoStream, esperaDaReconexao, previaDaMensagem, situacaoDaMinhaUltima } = await importarLib("api");

test("o leitor do stream separa os eventos completos e guarda o pedaço que falta", () => {
  const { eventos, resto } = lerEventosDoStream(
    'event: pronto\ndata: {}\n\n: batida\n\nevent: mensagem\ndata: {"conversa_id": 7}\n\nevent: li',
  );
  assert.deepEqual(eventos, [
    { tipo: "pronto", dados: "{}" },
    { tipo: "mensagem", dados: '{"conversa_id": 7}' },
  ]);
  assert.equal(resto, "event: li");
  const depois = lerEventosDoStream(resto + 'da\ndata: {"ultima_lida_id": 3}\n\n');
  assert.deepEqual(depois.eventos, [{ tipo: "lida", dados: '{"ultima_lida_id": 3}' }]);
  assert.equal(depois.resto, "");
});

test("o leitor aceita \\r\\n e ignora as batidas", () => {
  assert.deepEqual(lerEventosDoStream(": batida\r\n\r\n").eventos, []);
  assert.deepEqual(lerEventosDoStream("event: pronto\r\ndata: {}\r\n\r\n").eventos, [{ tipo: "pronto", dados: "{}" }]);
});

test("a reconexão dobra a espera até 30 s", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 10].map(esperaDaReconexao), [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
});

const mensagem = (extra) => ({
  id: 1,
  conversa_id: 1,
  autor_id: 2,
  texto: "",
  post: null,
  post_removido: false,
  created_at: "2026-11-24T12:00:00Z",
  ...extra,
});

test("a prévia da caixa é a primeira linha com texto, ou o poema", () => {
  assert.equal(previaDaMensagem(mensagem({ texto: "\n  \nprimeiro verso\nsegundo" }), 1), "primeiro verso");
  assert.equal(previaDaMensagem(mensagem({ texto: "oi", autor_id: 1 }), 1), "Você: oi");
  const post = { titulo: "Mar", autor: { username: "caio" } };
  assert.equal(previaDaMensagem(mensagem({ post }), 1), "poema: Mar");
  assert.equal(previaDaMensagem(mensagem({ post: { ...post, titulo: null } }), 1), "poema de @caio");
  assert.equal(previaDaMensagem(mensagem({ post_removido: true }), 1), "poema removido pelo autor");
  assert.equal(previaDaMensagem(null, 1), "");
});

test("Visto ou Enviada só embaixo da minha última mensagem", () => {
  const conversa = [mensagem({ id: 4, autor_id: 2 }), mensagem({ id: 5, autor_id: 1 })];
  assert.deepEqual(situacaoDaMinhaUltima(conversa, 1, 5), { id: 5, rotulo: "Visto" });
  assert.deepEqual(situacaoDaMinhaUltima(conversa, 1, 4), { id: 5, rotulo: "Enviada" });
  assert.deepEqual(situacaoDaMinhaUltima(conversa, 1, null), { id: 5, rotulo: "Enviada" });
  assert.equal(situacaoDaMinhaUltima(conversa, 2, 5), null);
  assert.equal(situacaoDaMinhaUltima([], 1, 5), null);
});
