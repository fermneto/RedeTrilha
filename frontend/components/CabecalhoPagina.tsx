// Cabeçalho fixo no topo da coluna central, com o título da página.
// `comoTitulo={false}` quando a página já tem o próprio h1 (ex.: o título do poema).
// Numa linha só: um título longo (o nome comprido no perfil) termina em reticências,
// e o título inteiro continua no `title` e no conteúdo da página.
export function CabecalhoPagina({ titulo, comoTitulo = true }: { titulo: string; comoTitulo?: boolean }) {
  const Tag = comoTitulo ? "h1" : "p";
  return (
    <header className="sticky top-0 z-10 border-b border-borda bg-papel">
      <div className="flex min-h-13 items-center px-4">
        <Tag title={titulo} className="min-w-0 truncate text-xl font-bold tracking-[-0.015em]">
          {titulo}
        </Tag>
      </div>
    </header>
  );
}
