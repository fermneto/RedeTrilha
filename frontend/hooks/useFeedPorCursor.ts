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
// vier toda filtrada, o fim continua perto e pede outra, até achar itens ou o
// feed acabar.

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

export function useFeedPorCursor(aba: Aba, buscar: (cursor: string | null) => Promise<FeedPage>, folga: number) {
  const [estado, setEstado] = useState<EstadoDaAba>(() => sessaoAtual().abas[aba] ?? abaVazia());
  const [vistos, setVistos] = useState(() => sessaoAtual().vistos);
  const [erro, setErro] = useState<string | null>(null);
  // Ref e não estado: evita dois pedidos da mesma página antes do re-render.
  const pedindo = useRef(false);
  const [pedidos, setPedidos] = useState(0);

  const itens = useMemo(() => visiveis(estado.itens, chaveDoAlvo, vistos, aba), [estado.itens, vistos, aba]);

  useEffect(() => {
    guardarSessao((sessao) => ({ ...sessao, abas: { ...sessao.abas, [aba]: estado }, vistos }));
  }, [aba, estado, vistos]);

  const carregarMais = useCallback(async () => {
    if (pedindo.current || estado.fim || erro) return;
    pedindo.current = true;
    try {
      const pagina = await buscar(estado.cursor);
      setEstado((atual) => ({
        ...atual,
        itens: juntarAoFeed(atual.itens, pagina.items),
        cursor: pagina.proximo_cursor,
        fim: pagina.proximo_cursor === null,
      }));
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para carregar os poemas"));
    } finally {
      pedindo.current = false;
      // Re-render depois do pedido: se a página veio toda filtrada, o efeito abaixo pede outra.
      setPedidos((n) => n + 1);
    }
  }, [buscar, estado.cursor, estado.fim, erro]);

  useEffect(() => {
    if (itens.length - estado.posicao.folha <= folga) carregarMais();
  }, [itens.length, estado.posicao.folha, folga, carregarMais, pedidos]);

  // A folha à vista: guarda a posição e marca o item como visto nesta aba.
  const aoMudar = useCallback(
    (posicao: PosicaoNoCaderno) => {
      setEstado((atual) =>
        atual.posicao.folha === posicao.folha && atual.posicao.lado === posicao.lado ? atual : { ...atual, posicao },
      );
      const item = itens[posicao.folha];
      if (item) setVistos((atuais) => marcarVisto(atuais, chaveDoAlvo(item), aba));
    },
    [itens, aba],
  );

  return {
    itens,
    fim: estado.fim,
    erro,
    posicao: estado.posicao,
    aoMudar,
    tentarDeNovo: () => setErro(null),
  };
}
