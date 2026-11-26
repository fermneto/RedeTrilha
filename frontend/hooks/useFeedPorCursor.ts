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
// Com `comAviso` (o Seguindo), `avisoEm` é a folha, entre os `itens`, onde entra
// o aviso de que acabou o que é de quem a pessoa segue (o `fim_em` do backend):
// a folha do aviso fica antes de `itens[avisoEm]`, e as posições do caderno
// contam com ela.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { chaveDoAlvo, juntarAoFeed, mensagemDeFalha, type FeedPage } from "@/lib/api";
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

export function useFeedPorCursor(
  aba: Aba,
  buscar: (cursor: string | null) => Promise<FeedPage>,
  folga: number,
  comAviso: boolean,
) {
  const [estado, setEstado] = useState<EstadoDaAba>(() => sessaoAtual().abas[aba] ?? abaVazia());
  const [vistos, setVistos] = useState(() => sessaoAtual().vistos);
  const [erro, setErro] = useState<string | null>(null);
  // Ref e não estado: evita dois pedidos da mesma página antes do re-render.
  const pedindo = useRef(false);
  const [pedidos, setPedidos] = useState(0);

  const itens = useMemo(() => visiveis(estado.itens, chaveDoAlvo, vistos, aba), [estado.itens, vistos, aba]);
  const fimEm = estado.fimEm ?? null;
  const avisoEm = useMemo(
    () => (comAviso && fimEm !== null ? visiveis(estado.itens.slice(0, fimEm), chaveDoAlvo, vistos, aba).length : null),
    [comAviso, fimEm, estado.itens, vistos, aba],
  );
  const folhas = itens.length + (avisoEm === null ? 0 : 1);

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
      if (item) setVistos((atuais) => marcarVisto(atuais, chaveDoAlvo(item), aba));
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
