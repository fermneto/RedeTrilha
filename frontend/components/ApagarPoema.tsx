"use client";
// "apagar poema" do autor, na página do poema. Pede confirmação ali mesmo
// (ConfirmacaoInline): vira "apagar o poema? sim / não". O aviso do que se perde
// aparece só na confirmação.

import { ConfirmacaoInline } from "@/components/ConfirmacaoInline";
import { useAcaoAssincrona } from "@/hooks/useAcaoAssincrona";
import { apagarPoema } from "@/lib/api";

type Props = {
  postId: number;
  // Chamado depois que o backend apagou: a página sai do poema, que não existe mais.
  aoApagar: () => void;
};

export function ApagarPoema({ postId, aoApagar }: Props) {
  const { ocupado: apagando, erro, executar } = useAcaoAssincrona("não deu para apagar o poema");

  const apagar = () =>
    executar(async () => {
      await apagarPoema(postId);
      aoApagar();
    });

  return (
    // Sem recuo próprio: o rótulo fica na margem da folha, no eixo da data acima.
    <div className="pb-3">
      <ConfirmacaoInline
        pergunta="apagar o poema?"
        rotulo={apagando ? "apagando..." : "apagar poema"}
        classeDoBotao="min-h-11 cursor-pointer text-sm text-tinta-suave hover:text-tinta disabled:opacity-50"
        aoConfirmar={apagar}
        desabilitado={apagando}
      >
        <p className="text-xs">
          O poema publicado não se edita: para corrigir, apague e publique de novo. Curtidas, comentários e
          críticas nos versos, reposts e o lugar nas antologias vão junto; as citações ficam sem o original.
        </p>
      </ConfirmacaoInline>
      {erro && <p className="mt-1 text-sm text-destaque">{erro}</p>}
    </div>
  );
}
