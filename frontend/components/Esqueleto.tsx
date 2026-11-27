// Esqueletos do carregamento: a silhueta do conteúdo que vem, para a página não
// pular quando os dados chegam. As peças usam as mesmas classes de texto do
// conteúdo real (poema-corpo, text-sm...), então cada linha ocupa a altura da
// linha de verdade. O contêiner (Carregando) fica com aria-busy e diz
// "carregando…" só ao leitor de tela; as peças são aria-hidden. A cor e o brilho
// vêm de .esqueleto, no globals.css. O esqueleto some no instante em que o
// dado chega, sem tempo mínimo.

import { TAMANHOS_DO_AVATAR } from "@/components/Avatar";

type Largura = string;

// Uma linha de texto: a barra fica no meio da altura de linha herdada.
// Largura "0" é a linha em branco entre estrofes.
function Linha({ largura, className = "" }: { largura: Largura; className?: string }) {
  return (
    <span aria-hidden="true" className={`block ${className}`}>
      <span className="esqueleto inline-block h-[0.6em] max-w-full rounded-full align-middle" style={{ width: largura }} />
    </span>
  );
}

// Um retângulo qualquer (botão, chip, campo): o tamanho e o raio vêm em className.
function Peca({ className, style }: { className: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className={`esqueleto block shrink-0 ${className}`} style={style} />;
}

function Circulo({ tamanho = "m" }: { tamanho?: keyof typeof TAMANHOS_DO_AVATAR }) {
  return <Peca className={`${TAMANHOS_DO_AVATAR[tamanho]} rounded-full`} />;
}

function Carregando({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-busy="true" className={className}>
      <span role="status" className="sr-only">
        carregando…
      </span>
      {children}
    </div>
  );
}

// Formas de poema para as linhas dos esqueletos: larguras de verso desiguais, como
// versos de verdade, e "0" para a linha em branco entre estrofes. Cada cartão da
// lista usa uma, em rodízio, para a lista não parecer o mesmo cartão repetido.
const FORMAS: Largura[][] = [
  ["74%", "61%", "68%", "42%", "0", "79%", "56%", "70%", "38%"],
  ["58%", "83%", "64%", "0", "71%", "49%", "77%"],
  ["66%", "72%", "51%", "81%", "60%", "34%"],
];
const TITULOS: Largura[] = ["46%", "32%", "54%"];

function forma(indice: number): Largura[] {
  return FORMAS[indice % FORMAS.length];
}

// Uma estrofe só: os quatro primeiros versos da forma, sem a linha em branco.
function estrofe(indice: number): Largura[] {
  return forma(indice).filter((largura) => largura !== "0").slice(0, 4);
}

// Os versos de um poema, na fonte e na altura de linha do poema.
function Versos({ larguras, className = "" }: { larguras: Largura[]; className?: string }) {
  return (
    <div className={`poema-corpo ${className}`}>
      {larguras.map((largura, i) => (
        <Linha key={i} largura={largura} />
      ))}
    </div>
  );
}

// O PoemaCard: avatar, nome, título, versos e a fileira de ações. Inteiro, é o
// da página do poema: mais versos, recuados como os numerados (VersosComentaveis).
export function EsqueletoDePoema({ indice = 0, inteiro = false }: { indice?: number; inteiro?: boolean }) {
  const versos = inteiro ? [...forma(indice), "0", ...forma(indice + 1)] : forma(indice);
  return (
    <div className="px-4 pt-3 pb-1">
      <div className="flex gap-3">
        <Circulo />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-x-1.5 text-[0.9375rem] leading-5">
            <Linha largura="7.5rem" />
            <Linha largura="5rem" />
          </div>
          <Linha largura={TITULOS[indice % TITULOS.length]} className="poema-titulo mt-2" />
          <Versos larguras={versos} className={inteiro ? "mt-2 pl-9" : "mt-2"} />
          <div className="mt-1 -ml-[0.4375rem] grid max-w-sm grid-cols-6 justify-items-start">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} aria-hidden="true" className="flex h-11 w-[2.125rem] items-center justify-center">
                <Peca className="h-5 w-5 rounded-full" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// A lista do feed, do perfil, do Explorar e das antologias. `desde` continua o
// rodízio das formas (a próxima página da rolagem infinita).
export function EsqueletoDaLista({ quantos, desde = 0 }: { quantos: number; desde?: number }) {
  return (
    <Carregando>
      <ul className="divide-y divide-borda">
        {Array.from({ length: quantos }, (_, i) => (
          <li key={i}>
            <EsqueletoDePoema indice={desde + i} />
          </li>
        ))}
      </ul>
    </Carregando>
  );
}

// A árvore de comentários (ArvoreComentarios): caixas com autor, texto e "responder".
export function EsqueletoDeComentarios({ quantos = 3 }: { quantos?: number }) {
  const textos: Largura[][] = [["92%", "58%"], ["76%"], ["88%", "94%", "40%"]];
  return (
    <Carregando>
      <ul className="space-y-3">
        {Array.from({ length: quantos }, (_, i) => (
          <li key={i} className="rounded-md border border-borda bg-papel-alto p-3">
            <Linha largura="11rem" className="text-xs" />
            <div className="mt-1 text-sm">
              {textos[i % textos.length].map((largura, j) => (
                <Linha key={j} largura={largura} />
              ))}
            </div>
            <Linha largura="4rem" className="mt-1 text-xs" />
          </li>
        ))}
      </ul>
    </Carregando>
  );
}

// A página do poema: o card inteiro e os comentários.
export function EsqueletoDaPaginaDoPoema() {
  return (
    <Carregando>
      <div className="border-b border-borda">
        <EsqueletoDePoema inteiro />
      </div>
      <div className="space-y-4 px-4 py-6">
        <Linha largura="8rem" className="text-xl" />
        <EsqueletoDeComentarios />
      </div>
    </Carregando>
  );
}

// O cabeçalho do perfil, a fila das abas e os primeiros poemas.
export function EsqueletoDePerfil() {
  return (
    <Carregando>
      <div className="space-y-4 px-4 pt-5 pb-6">
        <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-3 sm:grid-cols-[auto_1fr_auto]">
          <Circulo tamanho="g" />
          <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <Linha largura="60%" className="text-3xl" />
            <Linha largura="7rem" className="text-sm" />
          </div>
          <Peca className="col-start-2 row-start-1 h-[2.375rem] w-28 justify-self-end rounded sm:col-start-3" />
        </div>
        <Linha largura="85%" />
        <Linha largura="16rem" className="text-sm" />
      </div>
      <div aria-hidden="true" className="flex border-y border-borda">
        {["4.5rem", "6rem"].map((largura) => (
          <span key={largura} className="flex min-h-13 flex-1 items-center justify-center text-[0.9375rem]">
            <Linha largura={largura} />
          </span>
        ))}
      </div>
      <ul className="divide-y divide-borda">
        {[0, 1].map((i) => (
          <li key={i}>
            <EsqueletoDePoema indice={i} />
          </li>
        ))}
      </ul>
    </Carregando>
  );
}

// O poema do dia da coluna direita: título, versos, autor e o link.
export function EsqueletoDoPoemaDoDia() {
  return (
    <Carregando className="px-4 pb-4">
      <Linha largura="55%" className="poema-titulo mt-1 text-[1.0625rem]" />
      <Versos larguras={["78%", "64%", "71%", "45%", "0", "69%", "58%"]} className="mt-2 text-[0.9375rem] leading-[1.7]" />
      <Linha largura="8rem" className="mt-3 text-sm" />
      <span aria-hidden="true" className="mt-2 flex min-h-11 items-center text-sm">
        <Linha largura="7rem" />
      </span>
    </Carregando>
  );
}

// O "Em alta" (ListaEmAlta): a contagem, a #tag e o primeiro verso.
export function EsqueletoDeEmAlta({ quantos }: { quantos: number }) {
  return (
    <Carregando>
      <ul>
        {Array.from({ length: quantos }, (_, i) => (
          <li key={i} className="px-4 py-3">
            <Linha largura="10rem" className="text-[0.8125rem]" />
            <Linha largura={["38%", "26%", "44%"][i % 3]} className="font-bold" />
            <Linha largura={["82%", "68%", "75%"][i % 3]} className="mt-0.5 font-serifada text-[0.9375rem]" />
          </li>
        ))}
      </ul>
    </Carregando>
  );
}

// Uma pessoa para seguir (LinhaPoeta): avatar, nome, @ e o botão.
export function EsqueletoDePessoas({ quantos, comLink = false }: { quantos: number; comLink?: boolean }) {
  return (
    <Carregando>
      <ul className="pb-2">
        {Array.from({ length: quantos }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2.5">
            <Circulo />
            <div className="min-w-0 flex-1">
              <Linha largura={["62%", "48%", "70%"][i % 3]} />
              <Linha largura="40%" className="text-sm" />
            </div>
            <Peca className="h-11 w-[5.5rem] rounded-full" />
          </li>
        ))}
      </ul>
      {comLink && (
        <span aria-hidden="true" className="flex min-h-11 items-center px-4 text-sm">
          <Linha largura="12rem" />
        </span>
      )}
    </Carregando>
  );
}

// O cartão do Acervo e das sugestões de quem seguir (CartaoDoAcervo).
function EsqueletoDeCartao({ indice }: { indice: number }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-borda bg-papel-alto p-4">
      <div className="flex items-start gap-3">
        <Circulo />
        <div className="min-w-0 flex-1">
          <Linha largura={["64%", "52%", "72%"][indice % 3]} className="text-[0.9375rem] leading-snug" />
          <Linha largura="40%" className="text-sm" />
        </div>
      </div>
      <Linha largura={["88%", "70%", "80%"][indice % 3]} className="text-sm" />
      <div className="mt-auto flex items-center justify-between gap-3">
        <Linha largura="8.5rem" className="text-sm" />
        <Peca className="h-11 w-[5.5rem] rounded-full" />
      </div>
    </div>
  );
}

export function EsqueletoDeCartoes({ quantos, className }: { quantos: number; className: string }) {
  return (
    <Carregando>
      <ul className={`grid gap-3 ${className}`}>
        {Array.from({ length: quantos }, (_, i) => (
          <li key={i}>
            <EsqueletoDeCartao indice={i} />
          </li>
        ))}
      </ul>
    </Carregando>
  );
}

// As linhas da lista de rengas (CartaoDaRenga): título, autores e a situação.
export function EsqueletoDeRengas({ quantos }: { quantos: number }) {
  return (
    <Carregando>
      <ul className="-mx-(--recuo-da-folha) divide-y divide-borda border-b border-borda">
        {Array.from({ length: quantos }, (_, i) => (
          <li key={i} className="px-(--margem-da-folha) py-4">
            <Linha largura={["52%", "38%", "60%"][i % 3]} className="font-serifada text-xl leading-snug" />
            <Linha largura={["14rem", "10rem", "17rem"][i % 3]} className="mt-1 text-sm" />
            <Linha largura="70%" className="mt-2 text-[0.8125rem] leading-relaxed" />
          </li>
        ))}
      </ul>
    </Carregando>
  );
}

// A página da renga: título, autores, as estrofes com quem escreveu e os comentários.
export function EsqueletoDaPaginaDaRenga() {
  return (
    <Carregando>
      <div className="linha-da-folha border-b border-borda pt-6 pb-6">
        <Linha largura="50%" className="poema-titulo" />
        <Linha largura="14rem" className="mt-1.5 text-sm" />
        <Linha largura="65%" className="mt-3 text-[0.8125rem] leading-relaxed" />
        <div className="mt-5 space-y-5 pl-9">
          {[0, 1].map((i) => (
            <div key={i}>
              <Versos larguras={estrofe(i)} />
              <Linha largura="6rem" className="mt-1.5 text-[0.8125rem]" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4 px-4 py-6">
        <Linha largura="8rem" className="text-xl" />
        <EsqueletoDeComentarios quantos={2} />
      </div>
    </Carregando>
  );
}

// As linhas da lista de antologias (AntologiaItem): nome, quantos poemas e a descrição.
export function EsqueletoDeAntologias({ quantos, comDono = false }: { quantos: number; comDono?: boolean }) {
  return (
    <Carregando>
      <ul className="-mx-(--recuo-da-folha) divide-y divide-borda border-b border-borda">
        {Array.from({ length: quantos }, (_, i) => (
          <li key={i} className="px-(--margem-da-folha) py-4">
            <span className="flex items-baseline gap-3">
              <Linha largura={["48%", "36%", "58%"][i % 3]} className="flex-1 font-serifada text-[1.1875rem] leading-snug" />
              <Linha largura="4rem" className="text-[0.8125rem]" />
            </span>
            {comDono && <Linha largura="11rem" className="mt-0.5 text-sm" />}
            <Linha largura={["72%", "60%", "80%"][i % 3]} className="mt-1 font-serifada text-[0.9375rem]" />
          </li>
        ))}
      </ul>
    </Carregando>
  );
}

// A página da antologia: nome, descrição, quem reuniu e os primeiros poemas.
export function EsqueletoDaPaginaDaAntologia() {
  return (
    <Carregando>
      <div className="linha-da-folha border-b border-borda pt-8 pb-6">
        <Linha largura="58%" className="font-serifada text-[2rem] leading-tight" />
        <div className="mt-3 max-w-[60ch] font-serifada text-[1.0625rem] leading-relaxed">
          <Linha largura="92%" />
          <Linha largura="64%" />
        </div>
        <Linha largura="13rem" className="mt-4 text-sm" />
      </div>
      <ul className="divide-y divide-borda">
        {[0, 1].map((i) => (
          <li key={i}>
            <EsqueletoDePoema indice={i} />
          </li>
        ))}
      </ul>
    </Carregando>
  );
}

// Os avisos (LinhaDoAviso): ícone, avatares, a frase e o trecho do poema.
export function EsqueletoDeAvisos({ quantos }: { quantos: number }) {
  return (
    <Carregando>
      <ul>
        {Array.from({ length: quantos }, (_, i) => (
          <li key={i} className="linha-da-folha flex gap-3 border-b border-borda py-3">
            <span aria-hidden="true" className="flex w-8 shrink-0 justify-end pt-1">
              <Peca className="h-6 w-6 rounded-md" />
            </span>
            <div className="min-w-0 flex-1">
              <Circulo tamanho="p" />
              <Linha largura={["78%", "62%", "70%"][i % 3]} className="mt-1.5 text-[0.9375rem] leading-5" />
              <Linha largura={["54%", "46%", "60%"][i % 3]} className="mt-1 font-serifada text-[0.9375rem]" />
            </div>
          </li>
        ))}
      </ul>
    </Carregando>
  );
}

// A caixa de mensagens (LinhaDaConversa): avatar, nome e a prévia da última mensagem.
export function EsqueletoDeConversas({ quantos }: { quantos: number }) {
  return (
    <Carregando>
      <ul>
        {Array.from({ length: quantos }, (_, i) => (
          <li key={i} className="linha-da-folha flex gap-3 border-b border-borda py-3">
            <Circulo />
            <div className="min-w-0 flex-1">
              <Linha largura={["52%", "44%", "60%"][i % 3]} className="text-[0.9375rem] leading-5" />
              <Linha largura={["74%", "58%", "66%"][i % 3]} className="mt-1 font-serifada text-[0.9375rem]" />
            </div>
          </li>
        ))}
      </ul>
    </Carregando>
  );
}

// O topo da conversa: avatar pequeno, nome e @.
export function EsqueletoDoTopoDaConversa() {
  return (
    <Carregando className="flex min-w-0 flex-1 items-center gap-3">
      <Circulo tamanho="p" />
      <span className="min-w-0 flex-1 leading-5">
        <Linha largura="9rem" className="text-[1.0625rem]" />
        <Linha largura="6rem" className="text-[0.8125rem]" />
      </span>
    </Carregando>
  );
}

// Os balões da conversa, alternando os lados como numa conversa de verdade.
export function EsqueletoDeMensagens() {
  const baloes: { minha: boolean; largura: Largura; linhas: number }[] = [
    { minha: false, largura: "62%", linhas: 2 },
    { minha: false, largura: "38%", linhas: 1 },
    { minha: true, largura: "54%", linhas: 1 },
    { minha: false, largura: "70%", linhas: 3 },
    { minha: true, largura: "46%", linhas: 2 },
  ];
  return (
    <Carregando>
      <ol className="flex flex-col">
        {baloes.map(({ minha, largura, linhas }, i) => (
          <li key={i} className={`mb-4 flex ${minha ? "justify-end" : "justify-start"}`}>
            {/* A altura do balão: o respiro (py-2) mais as linhas (1.65 × 16 px). */}
            <Peca
              className={`rounded-[1.25rem] ${minha ? "rounded-br-md" : "rounded-bl-md"}`}
              style={{ width: largura, height: `calc(1rem + ${linhas} * 1.65rem)` }}
            />
          </li>
        ))}
      </ol>
    </Carregando>
  );
}

// As opções do onboarding: os chips das escolas e das formas, ou os campos da região.
export function EsqueletoDasOpcoes({ passo }: { passo: "gostos" | "regiao" }) {
  if (passo === "regiao") {
    return (
      <Carregando>
        <Linha largura="2.5rem" className="text-sm" />
        <Peca className="mt-1 min-h-11 w-full rounded-xl" />
      </Carregando>
    );
  }
  const chips: Largura[][] = [
    ["10rem", "12rem", "13rem", "5.5rem", "13.5rem", "7rem", "5.5rem", "8rem", "6.5rem", "11.5rem", "9rem", "13rem", "11.5rem", "9.5rem", "11rem"],
    ["5rem", "4.5rem", "4.25rem", "5rem", "4.75rem", "6.5rem", "7.75rem", "4.5rem"],
  ];
  return (
    <Carregando className="space-y-10">
      {chips.map((larguras, i) => (
        <div key={i}>
          <div className="mb-3 border-b border-borda pb-2 text-sm">
            <Linha largura={i === 0 ? "8rem" : "3.5rem"} />
          </div>
          <div className="flex flex-wrap gap-2">
            {larguras.map((largura, j) => (
              <Peca key={j} className="min-h-11 rounded-full" style={{ width: largura }} />
            ))}
          </div>
        </div>
      ))}
    </Carregando>
  );
}

// Os rascunhos (ItemDoRascunho): quando foi editado, o título, os versos e as ações.
export function EsqueletoDeRascunhos({ quantos }: { quantos: number }) {
  return (
    <Carregando>
      <ul>
        {Array.from({ length: quantos }, (_, i) => (
          <li key={i} className="linha-da-folha border-b border-borda pt-4 pb-2">
            <Linha largura="12rem" className="text-[0.8125rem]" />
            <Linha largura={TITULOS[i % TITULOS.length]} className="poema-titulo mt-3" />
            <Versos larguras={estrofe(i)} className="mt-2" />
            <span aria-hidden="true" className="flex min-h-11 items-center gap-5 text-sm">
              <Linha largura="8rem" />
              <Linha largura="4rem" />
              <Linha largura="3.5rem" />
            </span>
          </li>
        ))}
      </ul>
    </Carregando>
  );
}

// As linhas dos menus do card (enviar por mensagem, adicionar à antologia):
// com avatar (pessoas) ou com a caixinha de marcar (antologias).
export function EsqueletoDoMenu({ quantos, com }: { quantos: number; com: "avatar" | "caixa" }) {
  return (
    <Carregando>
      <ul>
        {Array.from({ length: quantos }, (_, i) => (
          <li key={i} className="flex min-h-11 items-center gap-3 px-2">
            {com === "avatar" ? <Circulo tamanho="p" /> : <Peca className="h-4 w-4 rounded-sm" />}
            {com === "avatar" ? (
              <span className="min-w-0 flex-1 leading-4">
                <Linha largura={["60%", "48%", "68%"][i % 3]} />
                <Linha largura="40%" className="text-xs" />
              </span>
            ) : (
              <Linha largura={["58%", "44%", "66%"][i % 3]} className="flex-1" />
            )}
          </li>
        ))}
      </ul>
    </Carregando>
  );
}
