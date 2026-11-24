// "aberta" (ainda aceita estrofes) ou "fechada" (virou um poema), na lista e no detalhe.
// Mesma altura nos dois estados (a fechada tem borda transparente) e inline-block,
// para sentar na linha de texto da lista sem empurrar as linhas vizinhas.
export function SeloDaRenga({ fechada }: { fechada: boolean }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-px align-[0.0625rem] text-xs leading-4 font-semibold ${
        fechada ? "border-transparent bg-borda text-tinta" : "border-destaque text-destaque"
      }`}
    >
      {fechada ? "fechada" : "aberta"}
    </span>
  );
}
