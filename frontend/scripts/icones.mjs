// Gera os ícones do Verso a partir de um único desenho: o "V" da Literata
// SemiBold Itálico (a fonte e o peso do logo da barra lateral), em tinta sobre
// papel. Rode `node scripts/icones.mjs` dentro de frontend/ e commite o que sair:
//
// - app/icon.svg         o favicon dos navegadores atuais, com versão escura
//                        (prefers-color-scheme dentro do SVG);
// - app/favicon.ico      16, 32 e 48 px, para quem não lê SVG;
// - app/apple-icon.png   180 px, sem cantos (o iOS arredonda sozinho);
// - public/icone-192.png e public/icone-512.png, os do manifest (app/manifest.ts),
//   com o V dentro da zona segura do ícone "maskable" do Android.
//
// O contorno do V saiu da fonte (assets/fontes/Literata-SemiBoldItalic.ttf) com
// opentype.js, numa caixa de 64 × 64 com o V de 46 de altura centrado. Nos
// tamanhos de aba (16 e 32 px) o traço fino da direita do V itálico sumia: ali o
// V ganha um contorno da mesma cor, que o engrossa sem mudar o desenho.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

// As cores de app/globals.css.
const PAPEL = "#faf7f0";
const TINTA = "#1f1b16";
const PAPEL_ESCURO = "#17150f";
const TINTA_ESCURA = "#ebe5d8";

const V =
  "M23.0 10.9L32.9 51.1L33.1 51.1L47.4 10.8L41.3 10.2L41.5 9L54.1 9L54.0 10.2L49.1 10.8" +
  "L33.5 53.9L26.6 55L14.8 10.8L9.9 10.2L10.1 9L28.7 9L28.5 10.2L23.0 10.9Z";

// O favicon: cartão de papel com cantos arredondados e o V engrossado.
const favicon = (papel, tinta) =>
  `<rect width="64" height="64" rx="14" fill="${papel}"/>` +
  `<path d="${V}" fill="${tinta}" stroke="${tinta}" stroke-width="1.6" stroke-linejoin="round"/>`;

// Ícone grande (Apple, Android): papel até a borda e o V sem contorno, menor,
// para caber na zona segura (o círculo de 80% do ícone maskable).
const grande = (escala) =>
  `<rect width="64" height="64" fill="${PAPEL}"/>` +
  `<path d="${V}" fill="${TINTA}" transform="translate(32 32) scale(${escala}) translate(-32 -32)"/>`;

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

const claro = svg(favicon(PAPEL, TINTA));

// No SVG, o tema escuro do navegador troca papel e tinta pelas cores do modo escuro.
gravar(
  "app/icon.svg",
  svg(
    `<style>.p{fill:${PAPEL}}.t{fill:${TINTA};stroke:${TINTA}}` +
      `@media (prefers-color-scheme:dark){.p{fill:${PAPEL_ESCURO}}.t{fill:${TINTA_ESCURA};stroke:${TINTA_ESCURA}}}</style>` +
      `<rect class="p" width="64" height="64" rx="14"/>` +
      `<path class="t" d="${V}" stroke-width="1.6" stroke-linejoin="round"/>`,
  ),
);

const tamanhosIco = [16, 32, 48];
gravar(
  "app/favicon.ico",
  ico(await Promise.all(tamanhosIco.map(async (lado) => ({ lado, dados: await png(claro, lado) })))),
);
gravar("app/apple-icon.png", await png(svg(grande(0.78)), 180));
gravar("public/icone-192.png", await png(svg(grande(0.62)), 192));
gravar("public/icone-512.png", await png(svg(grande(0.62)), 512));
