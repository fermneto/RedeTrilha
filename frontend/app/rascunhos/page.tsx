// Os rascunhos viraram uma aba do próprio perfil (/u/{username}?aba=rascunhos).
// A rota fica para os links antigos e redireciona para lá.

import { IrAoMeuPerfil } from "@/components/IrAoMeuPerfil";

export default function RascunhosPage() {
  return <IrAoMeuPerfil aba="rascunhos" />;
}
