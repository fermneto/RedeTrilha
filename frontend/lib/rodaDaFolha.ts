// Virar a página com o deslizar de dois dedos para o lado no touchpad (e com
// Shift + roda do mouse). Só conta o deslocamento lateral: a rolagem vertical
// continua rolando a página e nunca vira a folha.
//
// Um gesto vira uma folha só. O touchpad continua mandando eventos por cerca de
// um segundo depois que os dedos saem (a inércia do macOS e do Linux), então,
// depois de virar, a roda fica travada até ela ficar em silêncio por um tempo.
//
// O sinal: deslizar os dedos para a esquerda leva o conteúdo para a esquerda e
// chega como deltaX positivo em todos os navegadores (rolar para a direita), que
// é a próxima página, como no livro. Shift + roda para baixo também avança.

export type EstadoDaRoda = {
  // Deslocamento lateral acumulado no gesto, em pixels (positivo = avançar).
  acumulado: number;
  // Já virou neste gesto: ignora o resto até a roda parar.
  travado: boolean;
  // Instante do último evento (event.timeStamp, em ms).
  ultimo: number;
};

export type EventoDaRoda = {
  deltaX: number;
  deltaY: number;
  // WheelEvent.deltaMode: 0 pixels, 1 linhas, 2 páginas.
  deltaMode: number;
  shiftKey: boolean;
  timeStamp: number;
};

// Quanto o gesto precisa andar para o lado até virar a folha.
export const LIMIAR_DA_RODA = 60;
// Silêncio que encerra o gesto (e a inércia dele) e destrava a roda.
export const FIM_DO_GESTO_MS = 220;
// Lateral "de verdade": o deltaX precisa vencer o deltaY com esta folga.
const FOLGA_LATERAL = 1.5;

const PIXELS_POR_LINHA = 16;
const PIXELS_POR_PAGINA = 400;

export const RODA_PARADA: EstadoDaRoda = { acumulado: 0, travado: false, ultimo: -Infinity };

// O deslocamento lateral do evento em pixels, ou null se ele não é lateral.
export function deslocamentoLateral(e: EventoDaRoda): number | null {
  const escala = e.deltaMode === 1 ? PIXELS_POR_LINHA : e.deltaMode === 2 ? PIXELS_POR_PAGINA : 1;
  let dx = e.deltaX;
  let dy = e.deltaY;
  // Shift + roda: a maioria dos navegadores já entrega como deltaX; os que não
  // trocam mandam no deltaY.
  if (e.shiftKey && dx === 0) {
    dx = dy;
    dy = 0;
  }
  if (dx === 0 || Math.abs(dx) < Math.abs(dy) * FOLGA_LATERAL) return null;
  return dx * escala;
}

// Recebe o estado e um evento da roda; devolve o estado novo e se vira a folha
// (1 avança, -1 volta, 0 não vira).
export function lerRoda(estado: EstadoDaRoda, e: EventoDaRoda): { estado: EstadoDaRoda; passo: 1 | -1 | 0 } {
  const novoGesto = e.timeStamp - estado.ultimo > FIM_DO_GESTO_MS;
  const base: EstadoDaRoda = novoGesto ? { ...RODA_PARADA, ultimo: e.timeStamp } : { ...estado, ultimo: e.timeStamp };
  if (base.travado) return { estado: base, passo: 0 };

  const dx = deslocamentoLateral(e);
  if (dx === null) return { estado: { ...base, acumulado: 0 }, passo: 0 };

  // Mudou de sentido no meio do gesto: recomeça a conta do lado novo.
  const acumulado = Math.sign(dx) === Math.sign(base.acumulado) ? base.acumulado + dx : dx;
  if (Math.abs(acumulado) < LIMIAR_DA_RODA) return { estado: { ...base, acumulado }, passo: 0 };
  return { estado: { acumulado: 0, travado: true, ultimo: e.timeStamp }, passo: acumulado > 0 ? 1 : -1 };
}
