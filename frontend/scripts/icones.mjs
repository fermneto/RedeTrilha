// Gera os ícones do Verso a partir de um único desenho: o "V" da Literata
// SemiBold Itálico (a fonte e o peso do logo da barra lateral) em creme sobre um
// quadrado marrom (a cor da barra lateral), com uma pena salmão (a cor do botão
// de publicar) no lugar do traço fino da direita do V. Rode
// `node scripts/icones.mjs` dentro de frontend/ e commite o que sair:
//
// - app/icon.svg         o favicon dos navegadores atuais (o quadrado marrom
//                        tem fundo próprio, então vale em abas claras e escuras);
// - app/favicon.ico      16, 32 e 48 px, para quem não lê SVG;
// - app/apple-icon.png   180 px, sem cantos (o iOS arredonda sozinho);
// - public/icone-192.png e public/icone-512.png, os do manifest (app/manifest.ts),
//   com o desenho dentro da zona segura do ícone "maskable" do Android.
//
// O contorno do V saiu da fonte (assets/fontes/Literata-SemiBoldItalic.ttf) com
// opentype.js, numa caixa de 64 × 64 com o V de 46 de altura centrado. Uma pena
// fina sumiria em 16 px; por isso a pena é um só gomo cheio e grosso, sem
// haste, e o V creme continua sendo o que se lê.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

// As cores de app/globals.css: --color-capa, --color-gravura e o salmão do
// destaque no modo escuro (--color-destaque).
const CAPA = "#42261f";
const CREME = "#f3e8d8";
const SALMAO = "#e09a7f";

const V =
  "M23.0 10.9L32.9 51.1L33.1 51.1L47.4 10.8L41.3 10.2L41.5 9L54.1 9L54.0 10.2L49.1 10.8" +
  "L33.5 53.9L26.6 55L14.8 10.8L9.9 10.2L10.1 9L28.7 9L28.5 10.2L23.0 10.9Z";

// A pena: um gomo de lâmina curva que sai do vértice do V e sobe pela direita,
// bem cheio, sem haste, para não virar borrão em 16 px.
const PENA = "M33 55C31 38 38 19 57 6C57 26 49 46 33 55Z";

const desenho = (contorno = "") =>
  `<path d="${V}" fill="${CREME}"${contorno && ` stroke="${CREME}" ${contorno}`}/>` +
  `<path d="${PENA}" fill="${SALMAO}"/>`;

// O favicon: quadrado marrom de cantos arredondados, V engrossado e a pena.
const favicon = () =>
  `<rect width="64" height="64" rx="14" fill="${CAPA}"/>` + desenho('stroke-width="1.6" stroke-linejoin="round"');

// Ícone grande (Apple, Android): marrom até a borda e o desenho menor, para
// caber na zona segura (o círculo de 80% do ícone maskable).
const grande = (escala) =>
  `<rect width="64" height="64" fill="${CAPA}"/>` +
  `<g transform="translate(32 32) scale(${escala}) translate(-32 -32)">${desenho()}</g>`;

const svg = (corpo, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${extra}>${corpo}</svg>\n`;

const png = (fonte, lado) =>
  sharp(Buffer.from(fonte), { density: Math.ceil((72 * lado * 4) / 64) })
    .resize(lado, lado)
    .png()
    .toBuffer();

// ICO com as imagens em PNG dentro (aceito desde o Windows Vista e por todos os
// navegadores): cabeçalho, um diretório de 16 bytes por imagem e os PNGs.
function ico(imagens) {
  const cabecalho = Buffer.alloc(6 + 16 * imagens.length);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(imagens.length, 4);
  let deslocamento = cabecalho.length;
  imagens.forEach(({ lado, dados }, i) => {
    const e = 6 + 16 * i;
    cabecalho.writeUInt8(lado >= 256 ? 0 : lado, e);
    cabecalho.writeUInt8(lado >= 256 ? 0 : lado, e + 1);
    cabecalho.writeUInt8(0, e + 2);
    cabecalho.writeUInt8(0, e + 3);
    cabecalho.writeUInt16LE(1, e + 4);
    cabecalho.writeUInt16LE(32, e + 6);
    cabecalho.writeUInt32LE(dados.length, e + 8);
    cabecalho.writeUInt32LE(deslocamento, e + 12);
    deslocamento += dados.length;
  });
  return Buffer.concat([cabecalho, ...imagens.map((i) => i.dados)]);
}

function gravar(caminho, dados) {
  const destino = join(RAIZ, caminho);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, dados);
  console.log(caminho);
}

const claro = svg(favicon());

gravar("app/icon.svg", claro);

const tamanhosIco = [16, 32, 48];
gravar(
  "app/favicon.ico",
  ico(await Promise.all(tamanhosIco.map(async (lado) => ({ lado, dados: await png(claro, lado) })))),
);
gravar("app/apple-icon.png", await png(svg(grande(0.78)), 180));
gravar("public/icone-192.png", await png(svg(grande(0.62)), 192));
gravar("public/icone-512.png", await png(svg(grande(0.62)), 512));
