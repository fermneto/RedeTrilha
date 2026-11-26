// Testa as partes puras das ações da renga em lib/api.ts (#171): as rotas de cada
// alvo, a citação, a frase e o link dos avisos de renga e a prévia da mensagem com
// renga, transpilando o arquivo como em avisos.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  acaoDoAviso,
  caminhoDaCitacao,
  caminhoDaCitacaoDeVersosDaRenga,
  caminhoDoAlvo,
  linkDoAviso,
  previaDaMensagem,
} = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

const ana = { id: 1, username: "ana", name: "Ana" };

function aviso(extra) {
  return {
    id: 9,
    tipo: "curtida",
    created_at: "2026-11-25T12:00:00",
    lido: false,
    atores: [ana],
    total_atores: 1,
    post_id: null,
    renga_id: 3,
    comentario_id: null,
    titulo: "Renga do RU",
    trecho: "",
    verso_inicio: null,
    verso_fim: null,
    ...extra,
  };
}

test("as rotas de curtir e repostar e a citação de um poema ou de uma renga", () => {
  assert.equal(caminhoDoAlvo({ tipo: "poema", id: 7 }), "/posts/7");
  assert.equal(caminhoDoAlvo({ tipo: "renga", id: 3 }), "/rengas/3");
  assert.equal(caminhoDaCitacao({ tipo: "poema", id: 7 }), "/escrever?citar=7");
  assert.equal(caminhoDaCitacao({ tipo: "renga", id: 3 }), "/escrever?citar_renga=3");
  assert.equal(
    caminhoDaCitacaoDeVersosDaRenga(3, "fila do RU\n  às onze"),
    "/escrever?citar_renga=3&versos=fila+do+RU%0A++%C3%A0s+onze",
  );
});

test("curtida, repost e citação de renga dizem 'a renga'", () => {
  assert.equal(acaoDoAviso(aviso({})), "curtiu a renga");
  assert.equal(acaoDoAviso(aviso({ total_atores: 2 })), "curtiram a renga");
  assert.equal(acaoDoAviso(aviso({ tipo: "repost" })), "repostou a renga");
  assert.equal(acaoDoAviso(aviso({ tipo: "repost", total_atores: 3 })), "repostaram a renga");
  assert.equal(acaoDoAviso(aviso({ tipo: "citacao", post_id: 12 })), "citou a renga");
  // As do poema continuam como eram.
  assert.equal(acaoDoAviso(aviso({ renga_id: null, post_id: 7 })), "curtiu seu poema");
});

test("o aviso de renga leva à renga; o de citação, ao poema que citou", () => {
  assert.equal(linkDoAviso(aviso({})), "/rengas/3");
  assert.equal(linkDoAviso(aviso({ tipo: "repost" })), "/rengas/3");
  assert.equal(linkDoAviso(aviso({ tipo: "citacao", post_id: 12 })), "/poema/12");
});

test("a prévia da caixa mostra a renga compartilhada", () => {
  const mensagem = {
    id: 1,
    conversa_id: 1,
    autor_id: 2,
    texto: "",
    post: null,
    post_removido: false,
    renga: { titulo: "Renga do RU" },
    created_at: "2026-11-24T12:00:00Z",
  };
  assert.equal(previaDaMensagem(mensagem, 1), "renga: Renga do RU");
  assert.equal(previaDaMensagem(mensagem, 2), "Você: renga: Renga do RU");
  assert.equal(previaDaMensagem({ ...mensagem, texto: "olha esta" }, 1), "olha esta");
});
