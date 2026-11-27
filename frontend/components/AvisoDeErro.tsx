// A caixa de erro das telas: borda e texto na cor de destaque. `className` traz
// a margem de cada lugar; `role` só onde o aviso já era anunciado (role="alert");
// `como="div"` quando o aviso leva um botão ("tentar de novo"). `cantos="pequenos"`
// mantém os formulários que usavam o canto menor (compositor, perfil, acervo).

type Props = {
  children: React.ReactNode;
  className?: string;
  role?: "alert";
  como?: "p" | "div";
  cantos?: "pequenos";
};

export function AvisoDeErro({ children, className, role, como: Tag = "p", cantos }: Props) {
  const base = `${cantos === "pequenos" ? "rounded" : "rounded-xl"} border border-destaque p-3 text-sm text-destaque`;
  return (
    <Tag role={role} className={className ? `${className} ${base}` : base}>
      {children}
    </Tag>
  );
}
