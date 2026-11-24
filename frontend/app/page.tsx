import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Feed</h1>
      <p className="text-tinta-suave">
        Aqui nasce o feed com os poemas de quem você segue (feature do núcleo).
        Enquanto isso, veja o slice de exemplo em{" "}
        <Link href="/usuarios" className="underline">
          /usuarios
        </Link>
        .
      </p>
      <article className="rounded-lg border border-borda bg-papel-alto p-6">
        <h2 className="poema-titulo">Prova de leitura</h2>
        <p className="poema-corpo mt-4">
          {"Este é só um ensaio de página:\naqui o verso respira,\n\n    e a quebra de linha fica onde o poeta quis."}
        </p>
      </article>
    </div>
  );
}
