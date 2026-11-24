import { Icone, type PropsIcone } from "@/components/icones/Icone";

// Coração: dois arcos no alto e as curvas descendo até a ponta. Cheio quando curtido.
export function IconeCurtir({ cheio = false, className }: PropsIcone & { cheio?: boolean }) {
  return (
    <Icone className={className}>
      <path
        d="M12 19.5C6.5 15.8 3.75 12.6 3.75 9.4A4.4 4.4 0 0 1 12 7.3A4.4 4.4 0 0 1 20.25 9.4C20.25 12.6 17.5 15.8 12 19.5Z"
        fill={cheio ? "currentColor" : "none"}
      />
    </Icone>
  );
}
