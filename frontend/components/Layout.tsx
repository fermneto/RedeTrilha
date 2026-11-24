import { Nav } from "@/components/Nav";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="coluna flex-1 py-10">{children}</main>
      <footer className="border-t border-borda">
        <p className="coluna py-6 text-xs text-tinta-suave">
          Verso: poemas sem limite de caracteres, para quem está começando.
        </p>
      </footer>
    </div>
  );
}
