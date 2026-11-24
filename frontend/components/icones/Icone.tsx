// Base dos ícones do Verso: desenhados à mão, traço fino na cor do texto
// (currentColor), viewBox 24. São decorativos: o botão leva o rótulo.

export type PropsIcone = { className?: string };

export function Icone({
  className = "h-[1.15em] w-[1.15em]",
  children,
}: PropsIcone & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}
