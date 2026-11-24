import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A tela Poetas virou o Acervo: os links antigos continuam funcionando.
  // Temporário (307), e não permanente: o navegador não guarda o desvio em cache.
  async redirects() {
    return [{ source: "/usuarios", destination: "/acervo", permanent: false }];
  },
};

export default nextConfig;
