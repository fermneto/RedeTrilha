"use client";
// As páginas de uma aba do Início, paginadas por cursor, guardadas na sessão de
// leitura (lib/sessaoDoFeed.ts): ao voltar à aba (ou ao Início, vindo de outra
// página, ou ao recarregar), os itens, o cursor e a folha são os de quando a
// pessoa saiu. Mesma regra da ListaDePoemas: um pedido por vez, sem repetir
// poema nem renga (`juntarAoFeed`: um repost conta como o original e soma quem
// repostou no rótulo da primeira ocorrência), e o erro para os pedidos até
// "tentar de novo".
//
// `itens` já vem sem o que a pessoa viu primeiro na outra aba. Quando faltam
// `folga` folhas para o fim do que está à vista, pede a próxima página; se ela
// vier toda filtrada, o fim continua perto e pede outra, até achar itens. O feed
// não acaba (só com a rede sem poemas).
//
// `avisoEm` é a folha, entre os `itens`, onde entra o aviso da virada (o
// `fim_em` do backend: no Seguindo, acabou o que é de quem a pessoa segue; no
// Para você, o inédito): a folha do aviso fica antes de `itens[avisoEm]`, e as
// posições do caderno contam com ela.
//
// Cada folha que aparece na tela vai para o backend como "já vista"
// (`marcarVistosNoFeed`), em lotes, para as próximas sessões a pularem.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  alvoDoItem,
  chaveDoAlvo,
  juntarAoFeed,
  marcarVistosNoFeed,
  mensagemDeFalha,
  type FeedPage,
  type ItemVisto,
} from "@/lib/api";
import {
  abaVazia,
  guardarSessao,
  marcarVisto,
  sessaoAtual,
  visiveis,
  type Aba,
  type EstadoDaAba,
  type PosicaoNoCaderno,
} from "@/lib/sessaoDoFeed";

// O lote de folhas vistas ainda não enviado: sai depois de uma pausa na leitura
// ou quando enche. Falhar não atrapalha a leitura (o cursor já evita repetir na
// sessão); o lote só se perde.
const PAUSA_PARA_ENVIAR_MS = 2000;
const LOTE_MAXIMO = 100;
let lote: ItemVisto[] = [];
let envio: ReturnType<typeof setTimeout> | null = null;

function enviarVistos() {
  if (envio) clearTimeout(envio);
  envio = null;
  const itens = lote;
  lote = [];
  if (itens.length > 0) marcarVistosNoFeed(itens).catch(() => {});
}

function lembrarVisto(item: ItemVisto) {
  lote.push(item);
  if (lote.length >= LOTE_MAXIMO) enviarVistos();
  else {
    if (envio) clearTimeout(envio);
    envio = setTimeout(enviarVistos, PAUSA_PARA_ENVIAR_MS);
  }
}

export function useFeedPorCursor(aba: Aba, buscar: (cursor: string | null) => Promise<FeedPage>, folga: number) {
  const [estado, setEstado] = useState<EstadoDaAba>(() => sessaoAtual().abas[aba] ?? abaVazia());
  const [vistos, setVistos] = useState(() => sessaoAtual().vistos);
  const [erro, setErro] = useState<string | null>(null);
  // Ref e não estado: evita dois pedidos da mesma página antes do re-render.
  const pedindo = useRef(false);
  const [pedidos, setPedidos] = useState(0);

  const itens = useMemo(() => visiveis(estado.itens, chaveDoAlvo, vistos, aba), [estado.itens, vistos, aba]);
  const fimEm = estado.fimEm ?? null;
  const avisoEm = useMemo(
    () => (fimEm !== null ? visiveis(estado.itens.slice(0, fimEm), chaveDoAlvo, vistos, aba).length : null),
    [fimEm, estado.itens, vistos, aba],
  );
  const folhas = itens.length + (avisoEm === null ? 0 : 1);

  // Ao sair do Início (ou fechar a aba do navegador), manda o lote que faltava.
  useEffect(() => {
    window.addEventListener("pagehide", enviarVistos);
    return () => {
      window.removeEventListener("pagehide", enviarVistos);
      enviarVistos();
    };
  }, []);

  useEffect(() => {
    guardarSessao((sessao) => ({ ...sessao, abas: { ...sessao.abas, [aba]: estado }, vistos }));
  }, [aba, estado, vistos]);

  const carregarMais = useCallback(async () => {
    if (pedindo.current || estado.fim || erro) return;
    pedindo.current = true;
    try {
      const pagina = await buscar(estado.cursor);
      setEstado((atual) => {
        const virada = pagina.fim_em ?? null;
        if (virada === null) {
          return {
            ...atual,
            itens: juntarAoFeed(atual.itens, pagina.items),
            cursor: pagina.proximo_cursor,
            fim: pagina.proximo_cursor === null,
          };
        }
        const antes = juntarAoFeed(atual.itens, pagina.items.slice(0, virada));
        return {
          ...atual,
          itens: juntarAoFeed(antes, pagina.items.slice(virada)),
          cursor: pagina.proximo_cursor,
          fim: pagina.proximo_cursor === null,
          fimEm: antes.length,
        };
      });
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para carregar os poemas"));
    } finally {
      pedindo.current = false;
      // Re-render depois do pedido: se a página veio toda filtrada, o efeito abaixo pede outra.
      setPedidos((n) => n + 1);
    }
  }, [buscar, estado.cursor, estado.fim, erro]);

  useEffect(() => {
    if (folhas - estado.posicao.folha <= folga) carregarMais();
  }, [folhas, estado.posicao.folha, folga, carregarMais, pedidos]);

  // A folha à vista: guarda a posição e marca o item como visto nesta aba.
  const aoMudar = useCallback(
    (posicao: PosicaoNoCaderno) => {
      setEstado((atual) =>
        atual.posicao.folha === posicao.folha && atual.posicao.lado === posicao.lado ? atual : { ...atual, posicao },
      );
      const indice = avisoEm === null || posicao.folha < avisoEm ? posicao.folha : posicao.folha - 1;
      const item = posicao.folha === avisoEm ? undefined : itens[indice];
      if (item) {
        setVistos((atuais) => marcarVisto(atuais, chaveDoAlvo(item), aba));
        lembrarVisto(alvoDoItem(item));
      }
    },
    [itens, avisoEm, aba],
  );

  return {
    itens,
    avisoEm,
    fim: estado.fim,
    erro,
    posicao: estado.posicao,
    aoMudar,
    tentarDeNovo: () => setErro(null),
  };
}
