// Testa a exibição segura (components/TextoFormatado.tsx) e o documento do
// editor (lib/editorDePoema.ts) do #137. Os arquivos são transpilados para
// node_modules/.cache, onde o react e o prosemirror se resolvem; os imports com
// "@/" viram caminhos relativos. Rode com `npm test`.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const destino = new URL("../node_modules/.cache/verso-testes/", import.meta.url);
for (const pasta of ["lib", "components"]) mkdirSync(new URL(pasta, destino), { recursive: true });
for (const arquivo of ["lib/marcas.ts", "lib/editorDePoema.ts", "components/TextoFormatado.tsx"]) {
  const js = ts
    .transpileModule(readFileSync(new URL(`../${arquivo}`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    })
    .outputText.replace(/from "@\/(lib|components)\/([^"]+)"/g, (_, pasta, nome) => `from "../${pasta}/${nome}.mjs"`);
  writeFileSync(new URL(arquivo.replace(/\.tsx?$/, ".mjs"), destino), js);
}
const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { TextoFormatado, VersoFormatado } = await import(new URL("components/TextoFormatado.mjs", destino));
const { docDoTexto, textoDoDoc, versosColados, textoCopiado, esquema } = await import(
  new URL("lib/editorDePoema.mjs", destino)
);
const { textoSemMarcas } = await import(new URL("lib/marcas.mjs", destino));
const html = (texto) => renderToStaticMarkup(createElement(TextoFormatado, { texto }));

test("exibe as quatro marcas como elementos, com as quebras e os recuos", () => {
  assert.equal(
    html("**Amor** é *fogo*\n\n  ++que++ ~~arde~~"),
    '<strong class="font-bold">Amor</strong> é <em>fogo</em>\n\n  <u>que</u> <s>arde</s>',
  );
  assert.equal(html("***tudo***"), '<strong class="font-bold"><em>tudo</em></strong>');
});

test("HTML no texto aparece literal, nunca interpretado (XSS)", () => {
  const saida = html('<script>alert(1)</script> **<img src=x onerror="alert(2)">**');
  assert.ok(!saida.includes("<script>") && !saida.includes("<img"), saida);
  assert.ok(saida.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(saida.includes('<strong class="font-bold">&lt;img src=x onerror=&quot;alert(2)&quot;&gt;</strong>'));
  const fonte = readFileSync(new URL("../components/TextoFormatado.tsx", import.meta.url), "utf8");
  assert.ok(!fonte.includes("dangerouslySetInnerHTML"));
});

test("poema antigo, sem marcas e com * literal, aparece igual", () => {
  assert.equal(html("shade*,\n*  *  *\n2 * 3"), "shade*,\n*  *  *\n2 * 3");
});

test("verso a verso (crítica ancorada): cada linha se formata sozinha", () => {
  assert.equal(renderToStaticMarkup(createElement(VersoFormatado, { linha: "a *b*" })), "a <em>b</em>");
});

test("editor: texto → documento → texto é idêntico, com estrofes, recuos e * literal", () => {
  const textos = [
    "Minha terra tem palmeiras,\n  Onde canta o Sabiá;\n\n\tAs aves",
    "**Amor** é *fogo* que ++arde++ sem se ~~ver~~,\n\n**é ferida**",
    "shade*,\n*  *  *\n\\*\\*literal\\*\\*",
    "",
  ];
  for (const texto of textos) {
    const doc = docDoTexto(texto);
    assert.equal(doc.childCount, texto.split("\n").length, texto);
    assert.equal(textoDoDoc(doc), texto, texto);
  }
});

test("editor: negrito em dois versos fecha e reabre em cada um", () => {
  const negrito = esquema.mark("negrito");
  const doc = esquema.node("doc", null, [
    esquema.node("verso", null, [esquema.text("primeiro", [negrito])]),
    esquema.node("verso", null, [esquema.text("segundo", [negrito])]),
  ]);
  assert.equal(textoDoDoc(doc), "**primeiro**\n**segundo**");
});

test("colar de fora entra como texto puro, um verso por linha", () => {
  const slice = versosColados("**não é negrito**\r\n\n  recuo");
  assert.equal(slice.content.childCount, 3);
  slice.content.forEach((verso) => verso.forEach((no) => assert.equal(no.marks.length, 0)));
  assert.equal(textoCopiado(slice), "**não é negrito**\n\n  recuo");
});

test("copiar do editor dá o texto limpo, sem os delimitadores", () => {
  const doc = docDoTexto("**Amor** é *fogo*\n\nque arde");
  assert.equal(doc.textBetween(0, doc.content.size, "\n"), textoSemMarcas("**Amor** é *fogo*\n\nque arde"));
});

test("comentários continuam texto puro: a árvore não formata o corpo do comentário", () => {
  const fonte = readFileSync(new URL("../components/ArvoreComentarios.tsx", import.meta.url), "utf8");
  assert.ok(fonte.includes('<p className="mt-1 text-sm whitespace-pre-wrap">{comentario.texto}</p>'));
  assert.ok(!/TextoFormatado texto=\{comentario/.test(fonte));
});

test("o verso do Em alta aparece formatado, sem ** vazando", () => {
  const fonte = readFileSync(new URL("../components/EmAlta.tsx", import.meta.url), "utf8");
  assert.ok(fonte.includes("<VersoFormatado linha={trecho} />"));
  assert.equal(
    renderToStaticMarkup(createElement(VersoFormatado, { linha: "  a **casa** *vazia*" })),
    '  a <strong class="font-bold">casa</strong> <em>vazia</em>',
  );
});

test("mensagem direta: o texto é puro e o poema compartilhado sai formatado no card", () => {
  const conversa = readFileSync(new URL("../app/mensagens/[id]/page.tsx", import.meta.url), "utf8");
  // O balão mostra o texto como foi escrito; o campo é um textarea, sem a barra B I U S.
  assert.ok(/\n\s*\{mensagem\.texto\}\n/.test(conversa));
  assert.ok(!conversa.includes("TextoFormatado") && !conversa.includes("EditorDePoema"));
  assert.ok(conversa.includes("<textarea"));
  const enviar = readFileSync(new URL("../components/EnviarPorMensagem.tsx", import.meta.url), "utf8");
  assert.ok(!enviar.includes("TextoFormatado") && !enviar.includes("EditorDePoema"));
  // O poema compartilhado é o PoemaCard, cujo corpo passa pelo TextoFormatado.
  assert.ok(conversa.includes("<PoemaCard post={mensagem.post} aninhado />"));
  const card = readFileSync(new URL("../components/PoemaCard.tsx", import.meta.url), "utf8");
  assert.ok(card.includes("<TextoFormatado texto={cortar ? versos.slice(0, visiveis).join"));
  assert.equal(html("**olha** este"), '<strong class="font-bold">olha</strong> este');
});
