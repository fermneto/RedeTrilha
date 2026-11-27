// O número curto dos contadores das ações (curtidas, reposts, comentários), para
// caber na casa da fileira: até 999 inteiro; de mil em diante, "1,2 mil",
// "12 mil", "1,2 mi". Uma casa decimal só abaixo de 10 e sem ",0"; a conta
// arredonda para baixo, como no X, para 999.999 não virar "1.000 mil".
const ESCALAS = [
  [1_000_000, "mi"],
  [1_000, "mil"],
] as const;

export function contagemCurta(n: number): string {
  for (const [base, nome] of ESCALAS) {
    if (n < base) continue;
    const valor = n / base;
    const curto = valor < 10 ? Math.floor(valor * 10) / 10 : Math.floor(valor);
    return `${curto.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${nome}`;
  }
  return String(n);
}
