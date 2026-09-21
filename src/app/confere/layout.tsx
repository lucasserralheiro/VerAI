import type { Metadata } from 'next'

// Layout aninhado só pra esta seção — sem <html>/<body> próprios (o
// RootLayout do VerAI, em src/app/layout.tsx, já cuida disso). O original
// (services/confere/frontend/src/app/layout.tsx) era o layout raiz de uma
// aplicação Next à parte; aqui ele só acrescenta o link de pular pro
// conteúdo ao redor da página em ./page.tsx.
//
// A faixa de marca do topo (ESPEC 007) e o rodapé institucional da Prodam
// (ESPEC 006) saíram: os dois vinham de o Confere ter sido uma aplicação
// solta, com marca e assinatura institucional próprias. Dentro do VerAI a
// identificação do produto é a barra lateral, e repeti-la em cima e embaixo
// só roubava altura útil da tela — em 1366×768 eram ~73 px de cabeçalho e
// ~110 px de rodapé que agora vão para o formulário e o grid de
// divergências.
export const metadata: Metadata = {
  title: 'ConfereAI · VerAI',
  description:
    'Confere o contratado. Confere o utilizado. Compara o que foi contratado com o que foi medido e gera o relatório de comprovação.',
}

export default function ConfereLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-confere-surface text-confere-navy-800 antialiased">
      {/* Primeiro focável da seção (`R-ACE-08`), por isso antes de
          `{children}`. Invisível até receber foco. */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-confere-teal-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Pular para o conteúdo
      </a>
      {children}
    </div>
  )
}
