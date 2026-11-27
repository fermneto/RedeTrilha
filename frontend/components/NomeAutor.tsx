import Link from "next/link";

import { SeloConsagrado } from "@/components/SeloConsagrado";
import type { User } from "@/lib/api";

// Nome do autor com link para o perfil e, se for consagrado, o selo logo depois.
// Usado no feed, nas citações, nos comentários e na coluna direita.
export function NomeAutor({ usuario, className = "font-bold" }: { usuario: User; className?: string }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1">
      <Link href={`/u/${usuario.username}`} className={`truncate hover:underline ${className}`}>
        {usuario.name}
      </Link>
      <SeloConsagrado usuario={usuario} />
    </span>
  );
}
