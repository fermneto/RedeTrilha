// O número curto dos contadores das ações (curtidas, reposts, comentários), para
// caber na casa da fileira no celular: até 999 inteiro; de mil em diante,
// "1,2k", "12k", "1,2M", sem espaço, como nas redes. Uma casa decimal só abaixo
// de 10 e sem ",0"; a conta arredonda para baixo, como no X, para 999.999 não
// virar "1000k".
const ESCALAS = [
  [1_000_000, "M"],
  [1_000, "k"],
] as const;

export function contagemCurta(n: number): string {
  for (const [base, nome] of ESCALAS) {
    if (n < base) continue;
    const valor = n / base;
    const curto = valor < 10 ? Math.floor(valor * 10) / 10 : Math.floor(valor);
    return `${curto.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${nome}`;
  }
  return String(n);
}

// A palavra no singular só para 1: "1 poema", mas "0 poemas" e "3 poemas".
export function noPlural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios;
}
