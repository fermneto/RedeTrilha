// O cartão de compartilhamento (Open Graph e Twitter Card) no servidor: busca o
// mínimo do poema, do perfil, da renga ou da antologia em GET /cartoes/... (sem
// login, schemas/cartao.py no backend), monta os metadados das páginas
// (generateMetadata nos layout.tsx das rotas) e desenha a imagem de 1200 × 630
// (opengraph-image.tsx e twitter-image.tsx) com o next/og.
//
// Se a API der erro, demorar ou não achar (404, inclusive a antologia privada),
// sai o cartão padrão do Verso, sem quebrar a página.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Metadata } from "next";
import { ImageResponse } from "next/og";

import {
  anosDeVida,
  type AutorDoCartao,
  type CartaoAntologia,
  type CartaoPoema,
  type CartaoRenga,
  type CartaoUsuario,
} from "./api";
import {
  DESCRICAO,
  descricaoDoPoema,
  encurtar,
  NOME,
  primeirosVersos,
  semEscritaDaDireita,
  SITE,
  temEscritaDaDireita,
  tituloDoPoema,
} from "./cartao";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APRESENTACAO = "Para quem lê e escreve poesia: o poema inteiro, a conversa sobre ele e os clássicos no mesmo feed.";

// Os dados do cartão mudam pouco (o poema publicado é imutável): uma hora de cache.
const REVALIDAR = 3600;
const ESPERA_MS = 3000;

export const TAMANHO = { width: 1200, height: 630 };

// ---- Dados

async function buscarCartao<T>(caminho: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}/cartoes/${caminho}`, {
      next: { revalidate: REVALIDAR },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const numero = (id: string) => (/^\d+$/.test(id) ? id : null);

function cartaoDoPoema(id: string): Promise<CartaoPoema | null> {
  const n = numero(id);
  return n ? buscarCartao<CartaoPoema>(`poema/${n}`) : Promise.resolve(null);
}

function cartaoDoUsuario(username: string): Promise<CartaoUsuario | null> {
  return buscarCartao<CartaoUsuario>(`usuario/${encodeURIComponent(username)}`);
}

function cartaoDaRenga(id: string): Promise<CartaoRenga | null> {
  const n = numero(id);
  return n ? buscarCartao<CartaoRenga>(`renga/${n}`) : Promise.resolve(null);
}

function cartaoDaAntologia(id: string): Promise<CartaoAntologia | null> {
  const n = numero(id);
  return n ? buscarCartao<CartaoAntologia>(`antologia/${n}`) : Promise.resolve(null);
}

// Os versos chegam sem as marcas de formatação: o resumo não as tira de novo
// (um "*" literal do poema viraria marca).
const SEM_MARCAS = false;
const textoDe = (cartao: { versos: string[] }) => cartao.versos.join("\n");

// ---- Metadados

// O openGraph e o twitter de uma rota substituem os do layout raiz por inteiro:
// por isso cada rota repete o nome do site, a língua e o tipo do cartão.
function metadados(titulo: string, descricao: string, caminho: string, extra?: Metadata["openGraph"]): Metadata {
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: caminho },
    openGraph: {
      siteName: NOME,
      locale: "pt_BR",
      type: "website",
      url: caminho,
      title: titulo,
      description: descricao,
      ...extra,
    },
    twitter: { card: "summary_large_image", title: titulo, description: descricao },
  };
}

const nomeComAnos = (u: AutorDoCartao) => {
  const vida = anosDeVida(u);
  return vida ? `${u.name} (${vida})` : u.name;
};

const tituloDoCartao = (poema: CartaoPoema, largura?: number) =>
  tituloDoPoema({ titulo: poema.titulo, texto: textoDe(poema) }, largura, SEM_MARCAS);

export async function metadadosDoPoema(id: string): Promise<Metadata> {
  const caminho = `/poema/${id}`;
  const poema = await cartaoDoPoema(id);
  if (!poema) return metadados("Poema", DESCRICAO, caminho);
  const titulo = `${tituloDoCartao(poema)}, de ${nomeComAnos(poema.autor)}`;
  return metadados(titulo, descricaoDoPoema(textoDe(poema), undefined, SEM_MARCAS), caminho, {
    type: "article",
    authors: [poema.autor.name],
  });
}

export async function metadadosDoPerfil(username: string): Promise<Metadata> {
  const caminho = `/u/${encodeURIComponent(username)}`;
  const perfil = await cartaoDoUsuario(username);
  if (!perfil) return metadados(`@${username}`, DESCRICAO, caminho);
  const vida = anosDeVida(perfil);
  const descricao =
    perfil.bio.trim() ||
    (perfil.consagrado
      ? `Poeta consagrado${vida ? ` · ${vida}` : ""} · obra em domínio público`
      : `Poemas de ${perfil.name} no Verso.`);
  return metadados(`${perfil.name} (@${perfil.username})`, encurtar(descricao, 200), caminho, {
    type: "profile",
    username: perfil.username,
  });
}

// "Ana", "Ana e Bia", "Ana, Bia e Caio", "Ana, Bia, Caio e mais 2".
function listaDeNomes(nomes: string[], maximo = 3): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  if (nomes.length > maximo) return `${nomes.slice(0, maximo).join(", ")} e mais ${nomes.length - maximo}`;
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export async function metadadosDaRenga(id: string): Promise<Metadata> {
  const caminho = `/rengas/${id}`;
  const renga = await cartaoDaRenga(id);
  if (!renga) return metadados("Renga", DESCRICAO, caminho);
  const autores = listaDeNomes(renga.autores.map((a) => a.name));
  return metadados(
    `${renga.titulo}, renga de ${autores}`,
    descricaoDoPoema(textoDe(renga), undefined, SEM_MARCAS),
    caminho,
    { type: "article" },
  );
}

export async function metadadosDaAntologia(id: string): Promise<Metadata> {
  const caminho = `/antologias/${id}`;
  const antologia = await cartaoDaAntologia(id);
  if (!antologia) return metadados("Antologia", DESCRICAO, caminho);
  const descricao =
    antologia.descricao?.trim() ||
    `${antologia.qtd} ${antologia.qtd === 1 ? "poema reunido" : "poemas reunidos"} por ${antologia.dono.name}.`;
  return metadados(`${antologia.nome}, antologia de ${antologia.dono.name}`, encurtar(descricao, 200), caminho);
}

// ---- Imagem

// As cores do tema escuro de app/globals.css. Uma imagem de link só tem um tema
// (o WhatsApp e o X não sabem o de quem vê), e o cartão é sempre o escuro.
const PAPEL = "#17150f";
const TINTA = "#ebe5d8";
const TINTA_SUAVE = "#a39a8b";
const BORDA = "#36312a";
const DESTAQUE = "#e09a7f";

// Literata e Schibsted Grotesk, as mesmas da interface, em TTF estático (o next/og
// não lê woff2 nem fonte variável). Ficam em assets/fontes, fora do public/.
const FONTES = [
  { arquivo: "Literata-Regular.ttf", name: "Literata", weight: 400, style: "normal" },
  { arquivo: "Literata-SemiBold.ttf", name: "Literata", weight: 600, style: "normal" },
  { arquivo: "Literata-SemiBoldItalic.ttf", name: "Literata", weight: 600, style: "italic" },
  { arquivo: "SchibstedGrotesk-Medium.ttf", name: "Schibsted Grotesk", weight: 500, style: "normal" },
] as const;

type Fontes = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;
let fontes: Promise<Fontes> | null = null;

function carregarFontes(): Promise<Fontes> {
  fontes ??= Promise.all(
    FONTES.map(async ({ arquivo, ...fonte }) => ({
      ...fonte,
      data: await readFile(join(process.cwd(), "assets/fontes", arquivo)),
    })),
  );
  return fontes;
}

const SERIFADA = "Literata";
// Até onde vai o título numa linha só da imagem (Literata semibold de 50 px).
const LARGURA_DO_TITULO = 40;
const SANS = "Schibsted Grotesk";

async function desenhar(conteudo: React.ReactElement): Promise<ImageResponse> {
  return new ImageResponse(conteudo, { ...TAMANHO, fonts: await carregarFontes() });
}

// O logo, como no topo da barra lateral: "Verso" em Literata semibold itálica.
function Marca({ tamanho }: { tamanho: number }) {
  return (
    <div
      style={{
        fontFamily: SERIFADA,
        fontStyle: "italic",
        fontWeight: 600,
        fontSize: tamanho,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        color: TINTA,
      }}
    >
      Verso
    </div>
  );
}

// O lacre de cera com a pena (components/SeloConsagrado.tsx), na cor de destaque.
function Lacre({ tamanho }: { tamanho: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <path
        fill={DESTAQUE}
        d="M9.25 3.54Q12 .4 14.75 3.54Q18.82 2.62 19.2 6.77Q23.03 8.42 20.9 12Q23.03 15.58 19.2 17.23Q18.82 21.38 14.75 20.46Q12 23.6 9.25 20.46Q5.18 21.38 4.8 17.23Q.97 15.58 3.1 12Q.97 8.42 4.8 6.77Q5.18 2.62 9.25 3.54Z"
      />
      <path fill={PAPEL} d="M12 17.25L8.9 12.4C8.9 10.5 10.1 8.9 12 7.6C13.9 8.9 15.1 10.5 15.1 12.4Z" />
      <path stroke={DESTAQUE} strokeWidth="1.1" strokeLinecap="round" d="M12 16.3V12.9" />
      <circle cx="12" cy="11.9" r="0.95" fill={DESTAQUE} />
    </svg>
  );
}

// A folha: papel, margens largas e, embaixo, um filete com a assinatura à esquerda
// e o logo à direita.
function Folha({ children, assinatura }: { children: React.ReactNode; assinatura: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: PAPEL,
        padding: "60px 80px 52px",
        color: TINTA,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden" }}>{children}</div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderTop: `1.5px solid ${BORDA}`,
          paddingTop: 26,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontFamily: SANS, fontWeight: 500, fontSize: 28 }}>
          {assinatura}
        </div>
        <Marca tamanho={46} />
      </div>
    </div>
  );
}

// Autor: o nome em tinta, o lacre do consagrado e os anos de vida em tinta suave.
function Autor({ prefixo, usuario }: { prefixo?: string; usuario: AutorDoCartao }) {
  const vida = anosDeVida(usuario);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {prefixo && <span style={{ color: TINTA_SUAVE }}>{prefixo}</span>}
      <span>{usuario.name}</span>
      {usuario.consagrado && <Lacre tamanho={30} />}
      {vida && <span style={{ color: TINTA_SUAVE }}>{vida}</span>}
    </div>
  );
}

function Titulo({ children, tamanho = 50 }: { children: React.ReactNode; tamanho?: number }) {
  return (
    <div
      style={{
        fontFamily: SERIFADA,
        fontWeight: 600,
        fontSize: tamanho,
        lineHeight: 1.18,
        letterSpacing: "-0.01em",
        marginBottom: 22,
      }}
    >
      {children}
    </div>
  );
}

// Os versos com as quebras e os recuos do poema (white-space: pre).
function Versos({ versos, maximo }: { versos: string[]; maximo: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", fontFamily: SERIFADA, fontSize: 29, lineHeight: 1.5 }}>
      {versos.slice(0, maximo).map((verso, i) => (
        // Linha em branco entre estrofes: meia linha, como no poema.
        <div key={i} style={verso ? { whiteSpace: "pre" } : { height: 22 }}>
          {verso}
        </div>
      ))}
    </div>
  );
}

export function imagemPadrao(): Promise<ImageResponse> {
  return desenhar(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: PAPEL,
        padding: "0 96px",
      }}
    >
      <Marca tamanho={176} />
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 38,
          lineHeight: 1.4,
          color: TINTA_SUAVE,
          maxWidth: 880,
          marginTop: 36,
        }}
      >
        {APRESENTACAO}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 56 }}>
        <div style={{ width: 56, height: 4, backgroundColor: DESTAQUE }} />
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 26, color: TINTA_SUAVE }}>
          {new URL(SITE).host}
        </div>
      </div>
    </div>,
  );
}

// Poema: título (quando tem), os primeiros versos e o autor. Sem título, só os
// versos: o primeiro já é o título da página.
export async function imagemDoPoema(id: string): Promise<ImageResponse> {
  const poema = await cartaoDoPoema(id);
  if (!poema) return imagemPadrao();
  if (temEscritaDaDireita(textoDe(poema))) return imagemDaEscritaDaDireita(poema);
  const titulo = poema.titulo ? tituloDoCartao(poema, LARGURA_DO_TITULO) : null;
  const maximo = titulo ? 7 : 8;
  return desenhar(
    <Folha assinatura={<Autor usuario={poema.autor} />}>
      {titulo && <Titulo>{titulo}</Titulo>}
      <Versos versos={primeirosVersos(textoDe(poema), maximo, undefined, SEM_MARCAS).versos} maximo={maximo} />
    </Folha>,
  );
}

// Poema em árabe, persa ou hebraico (ver temEscritaDaDireita): o título no que
// tiver de legível, a língua do original e o autor, sem os versos.
function imagemDaEscritaDaDireita(poema: CartaoPoema): Promise<ImageResponse> {
  const titulo = encurtar(semEscritaDaDireita(poema.titulo ?? ""), LARGURA_DO_TITULO);
  const lingua = poema.idioma ? new Intl.DisplayNames(["pt-BR"], { type: "language" }).of(poema.idioma) : null;
  return desenhar(
    <Folha assinatura={<Autor usuario={poema.autor} />}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1 }}>
        <Titulo tamanho={titulo ? 50 : 64}>{titulo || poema.autor.name}</Titulo>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 32, color: TINTA_SUAVE }}>
          {lingua ? `Um poema em ${lingua}, no original.` : "Um poema no original."}
        </div>
      </div>
    </Folha>,
  );
}

// O avatar vira data URL antes de desenhar: imagem que não carrega (fora do ar,
// formato que o next/og não lê) cai nas iniciais em vez de derrubar o cartão.
async function avatar(url: string): Promise<string | null> {
  if (!/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": `Verso/1.0 (+${SITE})` },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    const tipo = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpeg)$/.test(tipo.split(";")[0])) return null;
    return `data:${tipo.split(";")[0]};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

const contagem = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

// Perfil: avatar, nome, @, a linha de consagrado, a bio e quantos poemas. Sem a
// API, o @ da URL no lugar do nome.
export async function imagemDoPerfil(username: string): Promise<ImageResponse> {
  const perfil = await cartaoDoUsuario(username);
  if (!perfil) {
    return desenhar(
      <Folha assinatura={<span style={{ color: TINTA_SUAVE }}>{new URL(SITE).host}</span>}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1 }}>
          <Titulo tamanho={72}>{`@${encurtar(username, 30)}`}</Titulo>
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 34, color: TINTA_SUAVE }}>
            poemas no Verso
          </div>
        </div>
      </Folha>,
    );
  }
  const foto = await avatar(perfil.avatar_url);
  const vida = anosDeVida(perfil);
  const bio = perfil.bio.trim() ? encurtar(perfil.bio.replace(/\s+/g, " "), 170) : null;
  return desenhar(
    <Folha
      assinatura={
        <span style={{ color: TINTA_SUAVE }}>
          {contagem(perfil.poemas, "poema", "poemas")}
        </span>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} width={148} height={148} alt="" style={{ borderRadius: 74, objectFit: "cover" }} />
        ) : (
          <div
            style={{
              width: 148,
              height: 148,
              borderRadius: 74,
              backgroundColor: BORDA,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: 54,
              color: TINTA,
            }}
          >
            {iniciais(perfil.name)}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: SERIFADA, fontWeight: 600, fontSize: 62, lineHeight: 1.1 }}>
              {encurtar(perfil.name, 32)}
            </div>
            {perfil.consagrado && <Lacre tamanho={50} />}
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 30, color: TINTA_SUAVE, marginTop: 8 }}>
            {`@${perfil.username}`}
          </div>
        </div>
      </div>
      {perfil.consagrado && (
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 28, color: DESTAQUE, marginTop: 34 }}>
          {`Poeta consagrado${vida ? ` · ${vida}` : ""} · obra em domínio público`}
        </div>
      )}
      {bio && (
        <div
          style={{
            fontFamily: SERIFADA,
            fontSize: 32,
            lineHeight: 1.45,
            marginTop: perfil.consagrado ? 18 : 40,
            maxWidth: 1000,
          }}
        >
          {bio}
        </div>
      )}
    </Folha>,
  );
}

// Renga, aberta ou de convidados: o título, as primeiras estrofes e os autores.
export async function imagemDaRenga(id: string): Promise<ImageResponse> {
  const renga = await cartaoDaRenga(id);
  if (!renga) return imagemPadrao();
  const { versos } = primeirosVersos(textoDe(renga), 7, undefined, SEM_MARCAS);
  const autores = listaDeNomes(renga.autores.map((a) => a.name));
  return desenhar(
    <Folha
      assinatura={
        <span>
          <span style={{ color: TINTA_SUAVE, marginRight: 10 }}>renga de</span>
          {autores}
        </span>
      }
    >
      <Titulo>{encurtar(renga.titulo, LARGURA_DO_TITULO)}</Titulo>
      <Versos versos={versos} maximo={7} />
    </Folha>,
  );
}

// Antologia pública: o nome, a descrição, os poetas que estão nela e quem reuniu.
export async function imagemDaAntologia(id: string): Promise<ImageResponse> {
  const antologia = await cartaoDaAntologia(id);
  if (!antologia) return imagemPadrao();
  const poemas = antologia.poemas
    .map((p) => ({
      titulo: semEscritaDaDireita(tituloDoPoema({ titulo: p.titulo, texto: p.primeiro_verso }, 44, SEM_MARCAS)),
      autor: p.autor.name,
    }))
    .filter((p) => p.titulo);
  return desenhar(
    <Folha
      assinatura={
        <span>
          <span style={{ color: TINTA_SUAVE, marginRight: 10 }}>reunida por</span>
          {`${antologia.dono.name} · ${contagem(antologia.qtd, "poema", "poemas")}`}
        </span>
      }
    >
      <Titulo tamanho={58}>{encurtar(antologia.nome, 34)}</Titulo>
      {antologia.descricao?.trim() && (
        <div style={{ fontFamily: SERIFADA, fontSize: 30, lineHeight: 1.45, color: TINTA, marginBottom: 26 }}>
          {encurtar(antologia.descricao.replace(/\s+/g, " "), 140)}
        </div>
      )}
      {poemas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", fontSize: 28, lineHeight: 1.5 }}>
          {poemas.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 16, height: 2, backgroundColor: DESTAQUE }} />
              <span style={{ fontFamily: SERIFADA, fontStyle: "italic", fontWeight: 600 }}>{p.titulo}</span>
              <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 24, color: TINTA_SUAVE }}>
                {encurtar(p.autor, 30)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Folha>,
  );
}
