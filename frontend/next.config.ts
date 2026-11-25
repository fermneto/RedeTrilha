import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // As fontes do cartão de compartilhamento (lib/cartaoServidor.tsx) são lidas do
  // disco com process.cwd(): sem isto, a Vercel não as leva para a função.
  outputFileTracingIncludes: {
    "/**/opengraph-image": ["./assets/fontes/*.ttf"],
    "/**/twitter-image": ["./assets/fontes/*.ttf"],
  },
  // A tela Poetas virou o Acervo, que hoje é a aba Poetas do Explorar: os links antigos
  // continuam funcionando.
  // Temporário (307), e não permanente: o navegador não guarda o desvio em cache.
  async redirects() {
    return [{ source: "/usuarios", destination: "/explorar?aba=poetas", permanent: false }];
  },
};

export default nextConfig;
