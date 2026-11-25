// As minhas antologias, privadas inclusive, são a aba "Antologias" do meu perfil;
// as públicas de todo mundo estão no Explorar, e a nova em /antologias/nova (pelo
// "Escrever"). A rota fica para os links antigos e redireciona para o perfil.

import { IrAoMeuPerfil } from "@/components/IrAoMeuPerfil";

export default function MinhasAntologiasPage() {
  return <IrAoMeuPerfil aba="antologias" />;
}
