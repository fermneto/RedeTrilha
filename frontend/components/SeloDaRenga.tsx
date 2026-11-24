// "aberta" (ainda aceita estrofes) ou "fechada" (virou um poema), na lista e no detalhe.
export function SeloDaRenga({ fechada }: { fechada: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        fechada ? "bg-borda text-tinta" : "border border-destaque text-destaque"
      }`}
    >
      {fechada ? "fechada" : "aberta"}
    </span>
  );
}
