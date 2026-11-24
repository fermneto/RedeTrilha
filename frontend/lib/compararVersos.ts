// Comparação verso a verso entre uma versão anterior e a atual de um poema, para
// a tela de versões. Linhas iguais ficam; as que só a anterior tem saíram, as que
// só a atual tem entraram. Maior subsequência comum: os poemas têm dezenas a
// centenas de versos, e a tabela de n × m cabe com folga.

export type LinhaComparada = { tipo: "igual" | "saiu" | "entrou"; verso: string };

export function compararVersos(anterior: string, atual: string): LinhaComparada[] {
  const a = anterior.split("\n");
  const b = atual.split("\n");
  // comum[i][j] = tamanho da maior subsequência comum de a[i:] e b[j:].
  const comum = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      comum[i][j] = a[i] === b[j] ? comum[i + 1][j + 1] + 1 : Math.max(comum[i + 1][j], comum[i][j + 1]);
    }
  }
  const linhas: LinhaComparada[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      linhas.push({ tipo: "igual", verso: a[i] });
      i++;
      j++;
    } else if (i < a.length && (j === b.length || comum[i + 1][j] >= comum[i][j + 1])) {
      // No empate, o verso que saiu vem antes do que entrou no lugar dele.
      linhas.push({ tipo: "saiu", verso: a[i] });
      i++;
    } else {
      linhas.push({ tipo: "entrou", verso: b[j] });
      j++;
    }
  }
  return linhas;
}
