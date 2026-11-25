"use client";
// Os rascunhos: a gaveta dos poemas guardados e ainda não publicados, numa aba do
// próprio perfil (só o autor a vê; decisão 9). Cada um mostra o começo do poema,
// quando foi mexido e, se for citação, de quem; abre no compositor, publica ou
// apaga dali.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ConfirmacaoInline } from "@/components/ConfirmacaoInline";
import { EsqueletoDeRascunhos } from "@/components/Esqueleto";
import { IconeCitar } from "@/components/icones/IconeCitar";
import { IconeEscrever } from "@/components/icones/IconeEscrever";
import { TextoFormatado } from "@/components/TextoFormatado";
import { useEsperaMinima } from "@/hooks/useEsperaMinima";
import {
  apagarRascunho,
  buscarPoema,
  listarRascunhos,
  mensagemDeFalha,
  nomeDaForma,
  previaDoRascunho,
  publicarRascunho,
  quandoEditado,
  type Post,
  type Rascunho,
} from "@/lib/api";

// Quantos versos do começo aparecem na lista (linhas em branco entre estrofes contam).
const VERSOS_NA_PREVIA = 4;

// O poema citado por cada rascunho de citação: null enquanto carrega ou se não deu
// para buscar (o original pode ter sido apagado depois que a lista chegou).
type Citados = Record<number, Post | null>;

export function ListaDeRascunhos() {
  const router = useRouter();
  const [rascunhos, setRascunhos] = useState<Rascunho[] | null>(null);
  const [citados, setCitados] = useState<Citados>({});
  const [erro, setErro] = useState<string | null>(null);
  // O esqueleto fica pelo menos 500 ms; a gaveta entra depois.
  const esperando = useEsperaMinima(rascunhos === null && !erro);

  useEffect(() => {
    listarRascunhos()
      .then((pagina) => setRascunhos(pagina.items))
      .catch((e) => setErro(mensagemDeFalha(e, "não deu para carregar os rascunhos")));
  }, []);

  // "citação de quem": busca cada poema citado uma vez só (apagar um rascunho
  // da lista não busca de novo os que ficaram).
  const idsCitados = [...new Set((rascunhos ?? []).flatMap((r) => (r.repost_de_id === null ? [] : [r.repost_de_id])))]
    .sort((a, b) => a - b)
    .join(",");
  useEffect(() => {
    if (!idsCitados) return;
    for (const id of idsCitados.split(",").map(Number)) {
      if (id in citados) continue;
      buscarPoema(id)
        .then((poema) => setCitados((atuais) => ({ ...atuais, [id]: poema })))
        .catch(() => setCitados((atuais) => ({ ...atuais, [id]: null })));
    }
  }, [idsCitados]);

  function tirarDaLista(id: number) {
    setRascunhos((atuais) => (atuais ?? []).filter((r) => r.id !== id));
  }

  return (
    <div>
      <p className="border-b border-borda px-4 py-3 text-sm text-tinta-suave">
        Poemas guardados e ainda não publicados. Só você vê.
      </p>
      {erro && <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>}
      {esperando && <EsqueletoDeRascunhos quantos={3} />}
      {!esperando && rascunhos?.length === 0 && <GavetaVazia />}
      {!esperando && rascunhos && rascunhos.length > 0 && (
        <ul className="surgir">
          {rascunhos.map((rascunho) => (
            <ItemDoRascunho
              key={rascunho.id}
              rascunho={rascunho}
              citado={rascunho.repost_de_id === null ? undefined : citados[rascunho.repost_de_id]}
              aoApagar={() => tirarDaLista(rascunho.id)}
              aoPublicar={(poema) => router.push(`/poema/${poema.id}`)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// Nenhum rascunho, seja no primeiro uso ou depois de apagar todos: o convite a escrever.
function GavetaVazia() {
  return (
    <div className="surgir px-4 py-12 text-center">
      <p className="font-serifada text-xl italic">A gaveta está vazia.</p>
      <p className="mx-auto mt-2 max-w-[42ch] text-sm text-tinta-suave">
        No compositor, &ldquo;salvar rascunho&rdquo; guarda o poema sem publicar. Ele espera aqui até você
        publicar.
      </p>
      <Link
        href="/escrever"
        className="realce mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-borda px-5 text-sm font-semibold"
      >
        <IconeEscrever className="h-[18px] w-[18px]" />
        Começar um poema
      </Link>
    </div>
  );
}

type PropsDoItem = {
  rascunho: Rascunho;
  // undefined: não é citação; null: o original não está mais lá (ou ainda carrega).
  citado: Post | null | undefined;
  aoApagar: () => void;
  aoPublicar: (poema: Post) => void;
};

function ItemDoRascunho({ rascunho, citado, aoApagar, aoPublicar }: PropsDoItem) {
  const { previa, versos, cortado } = previaDoRascunho(rascunho.texto, VERSOS_NA_PREVIA);
  const caminho = `/escrever?rascunho=${rascunho.id}`;
  const citacao = rascunho.repost_de_id !== null || rascunho.repost_removido;
  const nome = rascunho.titulo ?? previa.split("\n")[0];

  return (
    <li className="border-b border-borda px-4 pt-4 pb-2">
      <p className="flex flex-wrap gap-x-2 text-[0.8125rem] text-tinta-suave">
        <span>
          editado <time dateTime={rascunho.updated_at}>{quandoEditado(rascunho.updated_at)}</time>
        </span>
        <span aria-hidden="true">·</span>
        <span>{versos === 1 ? "1 verso" : `${versos} versos`}</span>
        {rascunho.forma && (
          <>
            <span aria-hidden="true">·</span>
            <span className="italic">{nomeDaForma(rascunho.forma)}</span>
          </>
        )}
      </p>
      {citacao && <CitacaoDe rascunho={rascunho} citado={citado} />}

      {/* O manuscrito todo leva ao compositor; para o teclado, o "abrir no compositor" abaixo. */}
      <Link href={caminho} tabIndex={-1} aria-hidden="true" className="group mt-3 block">
        {rascunho.titulo && <p className="poema-titulo group-hover:underline">{rascunho.titulo}</p>}
        <p className={`poema-corpo ${rascunho.titulo ? "mt-2" : ""}`}>
          <TextoFormatado texto={previa} />
        </p>
        {cortado && <p className="poema-corpo text-tinta-suave">…</p>}
      </Link>

      <AcoesDoRascunho
        rascunho={rascunho}
        nome={nome}
        caminho={caminho}
        aoApagar={aoApagar}
        aoPublicar={aoPublicar}
      />
    </li>
  );
}

function CitacaoDe({ rascunho, citado }: { rascunho: Rascunho; citado: Post | null | undefined }) {
  const apagado = rascunho.repost_removido || (rascunho.repost_de_id !== null && citado === null);
  return (
    <p className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-tinta-suave">
      <IconeCitar className="h-4 w-4 shrink-0" />
      {apagado ? (
        <span>citação de um poema que foi apagado</span>
      ) : citado ? (
        <span className="min-w-0 truncate">
          citação de{" "}
          <Link href={`/poema/${citado.id}`} className="font-semibold text-tinta hover:underline">
            {citado.autor.name}
          </Link>
          {citado.titulo && <span className="font-serifada italic">, {citado.titulo}</span>}
        </span>
      ) : (
        <span>citação</span>
      )}
    </p>
  );
}

type Acao = "publicar" | "apagar";

const PERGUNTAS: Record<Acao, { pergunta: string; aviso: string }> = {
  publicar: {
    pergunta: "publicar agora?",
    aviso: "O poema publicado não se edita: para corrigir, só apagando e publicando de novo.",
  },
  apagar: { pergunta: "apagar o rascunho?", aviso: "Não dá para desfazer." },
};

// "abrir no compositor", "publicar" e "apagar". Publicar e apagar pedem confirmação
// ali mesmo (ConfirmacaoInline), como o apagar poema: "sim / não", com o foco no
// "não"; Esc ou clique fora cancelam.
function AcoesDoRascunho({
  rascunho,
  nome,
  caminho,
  aoApagar,
  aoPublicar,
}: Omit<PropsDoItem, "citado"> & { nome: string; caminho: string }) {
  const [fazendo, setFazendo] = useState<Acao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(acao: Acao) {
    setFazendo(acao);
    setErro(null);
    try {
      if (acao === "publicar") {
        aoPublicar(await publicarRascunho(rascunho.id));
      } else {
        await apagarRascunho(rascunho.id);
        aoApagar();
      }
    } catch (e) {
      setErro(mensagemDeFalha(e, `não deu para ${acao} o rascunho`));
      setFazendo(null);
    }
  }

  const secundario =
    "realce flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm text-tinta-suave hover:text-tinta disabled:cursor-default disabled:opacity-50";
  return (
    <div className="mt-1">
      <div className="-ml-3 flex flex-wrap items-center gap-x-1">
        <Link
          href={caminho}
          aria-label={`abrir no compositor: ${nome}`}
          className="realce flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-destaque"
        >
          abrir no compositor
        </Link>
        {(["publicar", "apagar"] as const).map((acao) => (
          <ConfirmacaoInline
            key={acao}
            pergunta={PERGUNTAS[acao].pergunta}
            rotulo={fazendo === acao ? (acao === "publicar" ? "publicando..." : "apagando...") : acao}
            classeDoBotao={secundario}
            aoConfirmar={() => confirmar(acao)}
            desabilitado={fazendo !== null}
          >
            <p className="-mt-2 pb-2 text-xs">{PERGUNTAS[acao].aviso}</p>
          </ConfirmacaoInline>
        ))}
      </div>
      {erro && <p className="pb-2 text-sm text-destaque">{erro}</p>}
    </div>
  );
}
