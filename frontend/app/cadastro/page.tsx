"use client";
// Cadastro: cria a conta (POST /auth/registro) e já entra com as mesmas
// credenciais (POST /auth/login), para a pessoa cair direto no feed.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  cadastrar,
  entrar,
  ErroDaApi,
  salvarToken,
  SENHA_MAX,
  SENHA_MIN,
  USERNAME_FORMATO,
  USERNAME_MAX,
  USERNAME_MIN,
} from "@/lib/api";

// Os nomes batem com os campos do RegistroIn, para casar com o `loc` do 422.
type Campo = "name" | "username" | "password";
type Erros = Partial<Record<Campo, string>>;

const ORDEM: Campo[] = ["name", "username", "password"];

// Mesmas regras do backend, conferidas antes de enviar para o erro sair em português.
function validar(name: string, username: string, senha: string): Erros {
  const erros: Erros = {};
  if (!name.trim()) erros.name = "conte como quer ser chamado";
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    erros.username = `o username precisa ter de ${USERNAME_MIN} a ${USERNAME_MAX} caracteres`;
  } else if (!USERNAME_FORMATO.test(username)) {
    erros.username = "use só letras minúsculas, números e _";
  }
  // O backend conta bytes (bcrypt): acentos e emojis ocupam mais de um.
  if (senha.length < SENHA_MIN) {
    erros.password = `a senha precisa ter pelo menos ${SENHA_MIN} caracteres`;
  } else if (new TextEncoder().encode(senha).length > SENHA_MAX) {
    erros.password =
      `a senha pode ter no máximo ${SENHA_MAX} caracteres ` +
      `(${SENHA_MAX} bytes; acentos e emojis ocupam mais de um)`;
  }
  return erros;
}

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<React.ReactNode>(null);
  const [enviando, setEnviando] = useState(false);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    username: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };

  // Mostra os erros e leva o foco ao primeiro campo com problema.
  function mostrarErros(novos: Erros) {
    setErros(novos);
    const primeiro = ORDEM.find((c) => novos[c]);
    if (primeiro) refs[primeiro].current?.focus();
  }

  async function aoCadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErroGeral(null);
    const locais = validar(name, username, senha);
    if (Object.keys(locais).length > 0) {
      mostrarErros(locais);
      return;
    }
    setErros({});
    setEnviando(true);

    try {
      await cadastrar({ username, name, password: senha });
    } catch (err) {
      setEnviando(false);
      if (err instanceof ErroDaApi && err.status === 409) {
        mostrarErros({ username: "esse username já existe" });
      } else if (err instanceof ErroDaApi && err.status === 422 && Object.keys(err.campos).length > 0) {
        mostrarErros(err.campos);
      } else {
        setErroGeral(err instanceof Error ? err.message : "não deu para criar a conta");
      }
      return;
    }

    try {
      const { token } = await entrar(username, senha);
      salvarToken(token);
      router.replace("/");
    } catch {
      setEnviando(false);
      setErroGeral(
        <>
          Sua conta foi criada, mas não deu para entrar agora.{" "}
          <Link href="/login" className="underline">
            Entre com seu username e senha
          </Link>
          .
        </>,
      );
    }
  }

  const campo = "w-full rounded border border-borda bg-papel px-3 py-2 text-tinta";
  // aria-describedby junta a dica do campo (quando há) e o erro dele.
  function descricao(c: Campo, dica?: string) {
    return [dica, erros[c] && `erro-${c}`].filter(Boolean).join(" ") || undefined;
  }
  function erroDoCampo(c: Campo) {
    return (
      erros[c] && (
        <span id={`erro-${c}`} className="mt-1 block text-xs text-destaque">
          {erros[c]}
        </span>
      )
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <title>Criar conta · Verso</title>
      <h1 className="text-center text-3xl">Criar conta</h1>

      <form
        onSubmit={aoCadastrar}
        noValidate
        className="space-y-4 rounded-lg border border-borda bg-papel-alto p-6"
      >
        <label className="block text-sm">
          nome
          <input
            ref={refs.name}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            maxLength={80}
            autoComplete="name"
            aria-invalid={Boolean(erros.name)}
            aria-describedby={descricao("name")}
            className={`${campo} mt-1`}
          />
          {erroDoCampo("name")}
        </label>

        <label className="block text-sm">
          username
          <input
            ref={refs.username}
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={USERNAME_MAX}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={Boolean(erros.username)}
            aria-describedby={descricao("username", "dica-username")}
            className={`${campo} mt-1`}
          />
          <span id="dica-username" className="mt-1 block text-xs text-tinta-suave">
            Letras minúsculas, números e _, de {USERNAME_MIN} a {USERNAME_MAX} caracteres.
          </span>
          {erroDoCampo("username")}
        </label>

        <label className="block text-sm">
          senha
          <input
            ref={refs.password}
            name="password"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            autoComplete="new-password"
            aria-invalid={Boolean(erros.password)}
            aria-describedby={descricao("password", "dica-senha")}
            className={`${campo} mt-1`}
          />
          <span id="dica-senha" className="mt-1 block text-xs text-tinta-suave">
            De {SENHA_MIN} a {SENHA_MAX} caracteres.
          </span>
          {erroDoCampo("password")}
        </label>

        {/* Anuncia os erros para leitores de tela; o texto fica também ao lado de cada campo. */}
        <div aria-live="polite">
          {erroGeral && (
            <p className="rounded border border-destaque p-3 text-sm text-destaque">{erroGeral}</p>
          )}
          <span className="sr-only">{ORDEM.map((c) => erros[c]).filter(Boolean).join(". ")}</span>
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full cursor-pointer rounded bg-tinta px-4 py-2 text-sm text-papel disabled:opacity-50"
        >
          {enviando ? "criando conta..." : "Criar conta"}
        </button>
      </form>

      <p className="text-center text-sm text-tinta-suave">
        Já tem conta?{" "}
        <Link href="/login" className="text-tinta underline">
          Entre
        </Link>
      </p>
    </div>
  );
}
