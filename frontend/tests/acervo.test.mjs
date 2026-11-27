// Testa lerFiltrosDoAcervo() e caminhoDoAcervo() de lib/api.ts: a URL da aba Acervo
// do Explorar e o redirecionamento da rota antiga /acervo, transpilando o arquivo
// como em anosDeVida.test.mjs. Rode com `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { importarLib } from "./importarLib.mjs";

const { caminhoDoAcervo, lerFiltrosDoAcervo } = await importarLib("api");

const ler = (busca) => lerFiltrosDoAcervo(new URLSearchParams(busca));
// O que /acervo?... vira: o mesmo que a página antiga redireciona.
const redirecionar = (busca) => {
  const { filtros, pagina } = ler(busca);
  return caminhoDoAcervo(filtros, pagina);
};

test("a vista inicial é só a aba", () => {
  assert.equal(redirecionar(""), "/explorar?aba=poetas");
});

test("os filtros e a página da rota antiga vão para a aba", () => {
  assert.equal(
    redirecionar("tipo=consagrados&q=Cec%C3%ADlia&lingua=pt&epoca=xx&ordem=seguidos&pagina=3"),
    "/explorar?aba=poetas&tipo=consagrados&q=Cec%C3%ADlia&lingua=pt&epoca=xx&ordem=seguidos&pagina=3",
  );
});

test("valor desconhecido vira o padrão e sai da URL", () => {
  assert.equal(redirecionar("tipo=robos&ordem=sorte&pagina=0"), "/explorar?aba=poetas");
  assert.equal(redirecionar("pagina=abc&ordem=alfabetica&tipo=todos"), "/explorar?aba=poetas");
  assert.deepEqual(ler("pagina=-2").pagina, 1);
});

test("poetas do Verso não têm língua nem época", () => {
  assert.deepEqual(ler("tipo=do_verso&lingua=pt&epoca=xx").filtros, {
    tipo: "do_verso",
    q: "",
    lingua: null,
    epoca: null,
    ordem: "alfabetica",
  });
  assert.equal(redirecionar("tipo=do_verso&lingua=pt"), "/explorar?aba=poetas&tipo=do_verso");
});

test("a busca vai sem os espaços das pontas", () => {
  assert.equal(redirecionar("q=%20ana_%20"), "/explorar?aba=poetas&q=ana_");
});
