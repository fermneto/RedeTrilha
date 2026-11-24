// Cabeçalho fixo no topo da coluna central, com o título da página.
// `comoTitulo={false}` quando a página já tem o próprio h1 (ex.: o título do poema).
// `acao`: um botão à direita que fica à vista enquanto a página rola (ex.: "Escrever" nos Rascunhos).
export function CabecalhoPagina({
  titulo,
  comoTitulo = true,
  acao,
}: {
  titulo: string;
  comoTitulo?: boolean;
  acao?: React.ReactNode;
}) {
  const Tag = comoTitulo ? "h1" : "p";
  return (
    <header className="sticky top-0 z-10 border-b border-borda bg-papel">
      <div className="flex min-h-13 items-center justify-between gap-4 px-4">
        <Tag className="text-xl font-bold tracking-[-0.015em]">{titulo}</Tag>
        {acao}
      </div>
    </header>
  );
}
