// Testa as partes puras dos avisos em lib/api.ts (a frase, o link e o tempo
// relativo), transpilando o arquivo como em mensagens.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { quemNoAviso, acaoDoAviso, linkDoAviso, tempoRelativo } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const ana = { id: 1, username: "ana", name: "Ana" };
const bia = { id: 2, username: "bia", name: "Bia" };

function aviso(extra) {
  return {
    id: 9,
    tipo: "curtida",
    created_at: "2026-11-25T12:00:00",
    lido: false,
    atores: [ana],
    total_atores: 1,
    post_id: 7,
    renga_id: null,
    comentario_id: null,
    titulo: "Chuva",
    trecho: "",
    verso_inicio: null,
    verso_fim: null,
    ...extra,
  };
}

test("quem: um, dois ou o primeiro e mais n", () => {
  assert.equal(quemNoAviso(aviso({})), "Ana");
  assert.equal(quemNoAviso(aviso({ atores: [ana, bia], total_atores: 2 })), "Ana e Bia");
  assert.equal(quemNoAviso(aviso({ atores: [ana, bia], total_atores: 4 })), "Ana e mais 3");
});

test("a ação concorda com o número e diz os versos da crítica", () => {
  assert.equal(acaoDoAviso(aviso({})), "curtiu seu poema");
  assert.equal(acaoDoAviso(aviso({ total_atores: 3 })), "curtiram seu poema");
  assert.equal(
    acaoDoAviso(aviso({ tipo: "critica", comentario_id: 3, verso_inicio: 5, verso_fim: 8 })),
    "criticou os versos 5–8 do seu poema",
  );
  assert.equal(
    acaoDoAviso(aviso({ tipo: "critica", renga_id: 2, post_id: null, verso_inicio: 3, verso_fim: 3 })),
    "criticou o verso 3 da renga",
  );
  assert.equal(acaoDoAviso(aviso({ tipo: "seguidor", post_id: null })), "começou a seguir você");
});

test("o link leva ao poema, à crítica com ?versos=, à renga ou ao perfil", () => {
  assert.equal(linkDoAviso(aviso({})), "/poema/7");
  assert.equal(linkDoAviso(aviso({ tipo: "critica", verso_inicio: 2, verso_fim: 4 })), "/poema/7?versos=2-4");
  assert.equal(linkDoAviso(aviso({ tipo: "estrofe", post_id: null, renga_id: 3 })), "/rengas/3");
  assert.equal(
    linkDoAviso(aviso({ tipo: "critica", post_id: null, renga_id: 3, verso_inicio: 1, verso_fim: 2 })),
    "/rengas/3?versos=1-2",
  );
  assert.equal(linkDoAviso(aviso({ tipo: "seguidor", post_id: null })), "/u/ana");
});

test("tempo relativo: agora, minutos, horas, dias e a data depois de uma semana", () => {
  const agora = new Date("2026-11-25T12:00:00Z");
  assert.equal(tempoRelativo("2026-11-25T11:59:30", agora), "agora");
  assert.equal(tempoRelativo("2026-11-25T11:55:00", agora), "5 min");
  assert.equal(tempoRelativo("2026-11-25T09:00:00", agora), "3 h");
  assert.equal(tempoRelativo("2026-11-23T12:00:00", agora), "2 d");
  assert.match(tempoRelativo("2026-11-01T12:00:00", agora), /\/2026$/);
});
