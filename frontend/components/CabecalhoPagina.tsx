import { Voltar } from "@/components/Voltar";

// O título da página do caderno, no alto da folha, sem barra nem fio: a página
// já é o recipiente. `comoTitulo={false}` quando a página já tem o próprio h1.
// Numa linha só: um título longo (o nome comprido no perfil) termina em
// reticências, e o título inteiro continua no `title` e no conteúdo da página.
// `voltar`: as páginas de publicação (poema, renga, antologia) têm a seta de
// voltar antes do título.
export function CabecalhoPagina({
  titulo,
  comoTitulo = true,
  voltar = false,
}: {
  titulo: string;
  comoTitulo?: boolean;
  voltar?: boolean;
}) {
  const Tag = comoTitulo ? "h1" : "p";
  return (
    <header className={`flex items-center gap-1 px-4 pb-3 ${voltar ? "pt-4 lg:pt-8" : "pt-6 lg:pt-10"}`}>
      {voltar && <Voltar />}
      <Tag title={titulo} className="min-w-0 truncate text-2xl font-bold tracking-[-0.015em]">
        {titulo}
      </Tag>
    </header>
  );
}
