// Carrega um arquivo de lib/ nos testes: transpila o TypeScript e troca cada
// import relativo ("./vocabulario") pelo arquivo transpilado, também como data:
// URL. `await importarLib("api")` devolve os exports de lib/api.ts.
import { readFileSync } from "node:fs";
import ts from "typescript";

async function urlDe(arquivo) {
  const fonte = readFileSync(new URL(`../lib/${arquivo}.ts`, import.meta.url), "utf8");
  let js = ts.transpileModule(fonte, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [trecho, nome] of js.matchAll(/from "\.\/(\w+)"/g)) {
    js = js.replace(trecho, `from "${await urlDe(nome)}"`);
  }
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
}

export async function importarLib(arquivo) {
  return import(await urlDe(arquivo));
}
