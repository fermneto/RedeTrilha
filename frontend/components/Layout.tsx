import { ColunaDireita } from "@/components/ColunaDireita";
import { Nav } from "@/components/Nav";

// Três colunas: navegação à esquerda (só ícones até xl; barra inferior no celular),
// a coluna de leitura com ~600 px no meio e a coluna "Descobrir" à direita (de 1100 px).
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1265px] justify-center">
      <Nav />
      <main className="min-h-dvh w-full min-w-0 max-w-[600px] border-borda pb-[calc(3.25rem+env(safe-area-inset-bottom))] sm:border-x sm:pb-0">
        {children}
      </main>
      <ColunaDireita />
    </div>
  );
}
