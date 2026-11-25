import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Três réguas com um cursor cada: os ajustes da conta.
export function IconeAjustes({ className }: PropsIcone) {
  return (
    <Icone className={className}>
      <path d="M4 7H7.25M10.75 7H20M4 12H13.25M16.75 12H20M4 17H6.25M9.75 17H20" />
      <circle cx="9" cy="7" r="1.75" />
      <circle cx="15" cy="12" r="1.75" />
      <circle cx="8" cy="17" r="1.75" />
    </Icone>
  );
}
