// A cópia de reserva do vocabulário (lib/vocabulario.ts) bate com o backend, que
// é a fonte: os limites de backend/app/core/limites.py e as formas, na ordem e
// com os rótulos, de ROTULOS_DAS_FORMAS em backend/app/schemas/post.py. Mudou lá
// e não aqui, este teste falha. Rode com `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { importarLib } from "./importarLib.mjs";

const { FORMAS, LIMITES, nomeDaForma, ROTULOS_DAS_FORMAS } = await importarLib("vocabulario");
const doBackend = (caminho) => readFileSync(new URL(`../../backend/app/${caminho}`, import.meta.url), "utf8");

test("os limites são os de core/limites.py, com os nomes em minúsculas", () => {
  const limites = Object.fromEntries(
    [...doBackend("core/limites.py").matchAll(/^([A-Z_]+) = ([\d_]+)$/gm)].map(([, nome, valor]) => [
      nome.toLowerCase(),
      Number(valor.replace(/_/g, "")),
    ]),
  );
  assert.deepEqual(LIMITES, limites);
});

test("as formas são as do backend, na mesma ordem e com os mesmos rótulos", () => {
  const bloco = /ROTULOS_DAS_FORMAS = \{([^}]*)\}/.exec(doBackend("schemas/post.py"))[1];
  const rotulos = Object.fromEntries([...bloco.matchAll(/"(\w+)": "([^"]+)"/g)].map(([, codigo, rotulo]) => [codigo, rotulo]));
  assert.deepEqual(ROTULOS_DAS_FORMAS, rotulos);
  assert.deepEqual(FORMAS, Object.keys(rotulos));
});

test("forma fora da lista fica só sem o _", () => {
  assert.equal(nomeDaForma("prosa_poetica"), "prosa poética");
  assert.equal(nomeDaForma("forma_nova"), "forma nova");
});
