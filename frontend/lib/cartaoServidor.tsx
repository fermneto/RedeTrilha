// O cartão de compartilhamento (Open Graph e Twitter Card) no servidor: busca o
// poema, o perfil, a renga ou a antologia na API pública, monta os metadados das
// páginas (generateMetadata nos layout.tsx das rotas) e desenha a imagem de
// 1200 × 630 (opengraph-image.tsx e twitter-image.tsx) com o next/og.
//
// Sem login: a busca vai sem token. Se a API pedir login, der erro, demorar ou
// não achar (404, inclusive a antologia privada), sai o cartão padrão do Verso,
// sem quebrar a página. Renga só para convidados também sai no padrão, sem o
// conteúdo dela.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Metadata } from "next";
import { ImageResponse } from "next/og";

import {
  anosDeVida,
  textoDaRenga,
  type AntologiaDetalhe,
  type Perfil,
  type Post,
  type RengaDetalhe,
  type User,
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

const TAMANHO = { width: 1200, height: 630 };

// ---- Dados

async function buscarPublico<T>(caminho: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${caminho}`, {
      next: { revalidate: REVALIDAR },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const numero = (id: string) => (/^\d+$/.test(id) ? id : null);

export async function poemaPublico(id: string): Promise<Post | null> {
  const n = numero(id);
  return n ? buscarPublico<Post>(`/posts/${n}`) : null;
}

export async function perfilPublico(username: string): Promise<Perfil | null> {
  return buscarPublico<Perfil>(`/usuarios/${encodeURIComponent(username)}`);
}

// Renga de convidados não sai no cartão: só os convidados escrevem nela.
export async function rengaPublica(id: string): Promise<RengaDetalhe | null> {
  const n = numero(id);
  const renga = n ? await buscarPublico<RengaDetalhe>(`/rengas/${n}`) : null;
  return renga && renga.modo === "aberta" ? renga : null;
}

// O backend já devolve 404 para a privada de outra pessoa; a conferência aqui é
// para o cartão nunca mostrar uma privada, venha a resposta de onde vier.
export async function antologiaPublica(id: string): Promise<AntologiaDetalhe | null> {
  const n = numero(id);
  const antologia = n ? await buscarPublico<AntologiaDetalhe>(`/antologias/${n}`) : null;
  return antologia && antologia.publica ? antologia : null;
}

// O poema de um repost puro é o original; a citação é o poema de quem citou.
const poemaDoCartao = (poema: Post) => (poema.repost_de && !poema.texto.trim() ? poema.repost_de : poema);

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

const nomeComAnos = (u: User) => {
  const vida = anosDeVida(u);
  return vida ? `${u.name} (${vida})` : u.name;
};

export async function metadadosDoPoema(id: string): Promise<Metadata> {
  const caminho = `/poema/${id}`;
  const lido = await poemaPublico(id);
  if (!lido) return metadados("Poema", DESCRICAO, caminho);
  const poema = poemaDoCartao(lido);
  const titulo = `${tituloDoPoema(poema)}, de ${nomeComAnos(poema.autor)}`;
  return metadados(titulo, descricaoDoPoema(poema.texto), caminho, {
    type: "article",
    authors: [poema.autor.name],
    publishedTime: poema.created_at,
  });
}

export async function metadadosDoPerfil(username: string): Promise<Metadata> {
  const caminho = `/u/${encodeURIComponent(username)}`;
  const perfil = await perfilPublico(username);
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
export function listaDeNomes(nomes: string[], maximo = 3): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  if (nomes.length > maximo) return `${nomes.slice(0, maximo).join(", ")} e mais ${nomes.length - maximo}`;
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export async function metadadosDaRenga(id: string): Promise<Metadata> {
  const caminho = `/rengas/${id}`;
  const renga = await rengaPublica(id);
  if (!renga) return metadados("Renga", DESCRICAO, caminho);
  const autores = listaDeNomes(renga.autores.map((a) => a.name));
  return metadados(`${renga.titulo}, renga de ${autores}`, descricaoDoPoema(textoDaRenga(renga.estrofes)), caminho, {
    type: "article",
  });
}

export async function metadadosDaAntologia(id: string): Promise<Metadata> {
  const caminho = `/antologias/${id}`;
  const antologia = await antologiaPublica(id);
  if (!antologia) return metadados("Antologia", DESCRICAO, caminho);
  const descricao =
    antologia.descricao?.trim() ||
    `${antologia.qtd} ${antologia.qtd === 1 ? "poema reunido" : "poemas reunidos"} por ${antologia.dono.name}.`;
  return metadados(`${antologia.nome}, antologia de ${antologia.dono.name}`, encurtar(descricao, 200), caminho);
}

// ---- Imagem

// As cores de app/globals.css (o cartão é sempre o tema claro: papel e tinta).
const PAPEL = "#faf7f0";
const TINTA = "#1f1b16";
const TINTA_SUAVE = "#6b6359";
const BORDA = "#e4ddd0";
const DESTAQUE = "#8a3b2e";

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
function Autor({ prefixo, usuario }: { prefixo?: string; usuario: User }) {
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
  const lido = await poemaPublico(id);
  if (!lido) return imagemPadrao();
  const poema = poemaDoCartao(lido);
  if (temEscritaDaDireita(poema.texto)) return imagemDaEscritaDaDireita(poema);
  const titulo = poema.titulo ? tituloDoPoema(poema, LARGURA_DO_TITULO) : null;
  const maximo = titulo ? 7 : 8;
  return desenhar(
    <Folha assinatura={<Autor usuario={poema.autor} />}>
      {titulo && <Titulo>{titulo}</Titulo>}
      <Versos versos={primeirosVersos(poema.texto, maximo).versos} maximo={maximo} />
    </Folha>,
  );
}

// Poema em árabe, persa ou hebraico (ver temEscritaDaDireita): o título no que
// tiver de legível, a língua do original e o autor, sem os versos.
function imagemDaEscritaDaDireita(poema: Post): Promise<ImageResponse> {
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

// Perfil: avatar, nome, @, a linha de consagrado, a bio e as contagens. Sem a
// API, o @ da URL no lugar do nome.
export async function imagemDoPerfil(username: string): Promise<ImageResponse> {
  const perfil = await perfilPublico(username);
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
          {`${contagem(perfil.poemas, "poema", "poemas")} · ${contagem(perfil.seguidores, "seguidor", "seguidores")}`}
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

// Renga aberta: o título, as primeiras estrofes e os autores.
export async function imagemDaRenga(id: string): Promise<ImageResponse> {
  const renga = await rengaPublica(id);
  if (!renga) return imagemPadrao();
  const { versos } = primeirosVersos(textoDaRenga(renga.estrofes), 7);
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
  const antologia = await antologiaPublica(id);
  if (!antologia) return imagemPadrao();
  const poetas = [...new Map(antologia.poemas.map((p) => [poemaDoCartao(p).autor.id, poemaDoCartao(p).autor.name])).values()];
  const titulos = antologia.poemas
    .map((p) => semEscritaDaDireita(tituloDoPoema(poemaDoCartao(p), 56)))
    .filter(Boolean)
    .slice(0, 4);
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
      {titulos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", fontFamily: SERIFADA, fontSize: 28, lineHeight: 1.5 }}>
          {titulos.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 16, height: 2, backgroundColor: DESTAQUE }} />
              <span style={{ fontStyle: "italic", fontWeight: 600 }}>{t}</span>
            </div>
          ))}
        </div>
      )}
      {poetas.length > 0 && (
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 26, color: TINTA_SUAVE, marginTop: 18 }}>
          {`com poemas de ${listaDeNomes(poetas)}`}
        </div>
      )}
    </Folha>,
  );
}
