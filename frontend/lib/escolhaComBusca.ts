// A parte pura da EscolhaComBusca (components/EscolhaComBusca.tsx), o campo de
// país e de estado das Preferências: filtrar a lista pelo que se digita, sem
// acento nem caixa ("sao" acha "São Paulo"), e decidir para que lado a lista abre
// e com que altura, para não estourar a tela nem ficar atrás do teclado.
// Testes: tests/escolhaComBusca.test.mjs.

export type OpcaoDeEscolha = { valor: string | null; rotulo: string };

// "São Tomé" → "sao tome": minúsculas e sem os acentos.
export function semAcentos(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

// As opções que batem com a busca. A opção sem valor ("prefiro não dizer") nunca
// é filtrada e fica sempre no topo. Depois vem a sigla exata (o valor: o código
// ISO do país, "PT", ou a UF, "PB"), as que começam pelo termo, as que têm uma
// palavra começando por ele e, por fim, as que só o contêm; dentro de cada grupo,
// na ordem original (Brasil continua antes dos outros). Busca vazia devolve tudo.
export function filtrarOpcoes(opcoes: OpcaoDeEscolha[], busca: string): OpcaoDeEscolha[] {
  const termo = semAcentos(busca.trim());
  if (!termo) return opcoes;
  const grupos: OpcaoDeEscolha[][] = [[], [], [], [], []];
  for (const opcao of opcoes) {
    const rotulo = semAcentos(opcao.rotulo);
    if (opcao.valor === null) grupos[0].push(opcao);
    else if (semAcentos(opcao.valor) === termo) grupos[1].push(opcao);
    else if (rotulo.startsWith(termo)) grupos[2].push(opcao);
    else if (rotulo.split(/[\s\-–(),.]+/).some((p) => p.startsWith(termo))) grupos[3].push(opcao);
    else if (rotulo.includes(termo)) grupos[4].push(opcao);
  }
  return grupos.flat();
}

// Quantas das opções achadas são de fato um lugar (sem contar "prefiro não dizer").
export function achadas(opcoes: OpcaoDeEscolha[]): number {
  return opcoes.filter((o) => o.valor !== null).length;
}

export const ALTURA_MAXIMA_DA_LISTA = 288;
// Abaixo disso (umas quatro opções de 44 px), a lista vira para cima se lá couber mais.
export const ALTURA_CONFORTAVEL = 184;

// Para que lado abre a lista e com que altura máxima, dado o espaço livre abaixo
// e acima do campo (já descontados o teclado e o recorte da página do livro).
export function lugarDaLista(
  espacoAbaixo: number,
  espacoAcima: number,
): { lado: "abaixo" | "acima"; altura: number } {
  const lado = espacoAbaixo < ALTURA_CONFORTAVEL && espacoAcima > espacoAbaixo ? "acima" : "abaixo";
  const espaco = lado === "abaixo" ? espacoAbaixo : espacoAcima;
  return { lado, altura: Math.max(Math.min(ALTURA_MAXIMA_DA_LISTA, Math.floor(espaco)), 132) };
}
