// O título da página do caderno, no alto da folha, sem barra nem fio: a página
// já é o recipiente. `comoTitulo={false}` quando a página já tem o próprio h1.
// Numa linha só: um título longo (o nome comprido no perfil) termina em
// reticências, e o título inteiro continua no `title` e no conteúdo da página.
export function CabecalhoPagina({ titulo, comoTitulo = true }: { titulo: string; comoTitulo?: boolean }) {
  const Tag = comoTitulo ? "h1" : "p";
  return (
    <header className="px-4 pt-6 pb-3 lg:pt-10">
      <Tag title={titulo} className="min-w-0 truncate text-2xl font-bold tracking-[-0.015em]">
        {titulo}
      </Tag>
    </header>
  );
}
