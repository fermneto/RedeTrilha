"use client";
// Do lado dos versos, dentro do caderno: "comentar estes versos" e o filtro pela
// marca de um verso mostram a página dos comentários (no celular, a seguinte).
// "comentar", no card do feed, abre a página com #comentarios: já na deles.

import { useEffect } from "react";

import { ID_DO_CAMPO_DE_COMENTARIO } from "@/components/ArvoreComentarios";
import { useFolhas } from "@/components/CadernoFolhas";

export function useIrParaComentarios(filtrar: (verso: number) => void): {
  aoComentar: (suave: boolean) => void;
  aoFiltrar: (verso: number) => void;
} {
  const { mostrar } = useFolhas();
  useEffect(() => {
    if (window.location.hash === "#comentarios") mostrar("d");
  }, []);

  return {
    aoComentar: (suave) =>
      mostrar("d", () => {
        const campo = document.getElementById(ID_DO_CAMPO_DE_COMENTARIO);
        campo?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "center" });
        campo?.focus({ preventScroll: true });
      }),
    aoFiltrar: (n) => {
      filtrar(n);
      mostrar("d", () => document.getElementById("comentarios")?.scrollIntoView({ behavior: "smooth" }));
    },
  };
}
