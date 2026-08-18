import { render, screen } from '@testing-library/react'
import DocumentoDetalhePage from './documentos/[id]/page'
import NotificacoesPage from './notificacoes/page'
import AdminUsuariosPage from './admin/usuarios/page'
import AdminRegrasNotificacaoPage from './admin/regras-notificacao/page'

// A listagem de documentos (`/`) saiu daqui — deixou de ser esqueleto no
// módulo 4. As demais páginas abaixo continuam esqueleto.
describe('páginas esqueleto do dashboard', () => {
  it('renderiza a página de detalhe do documento com o id da rota', async () => {
    const element = await DocumentoDetalhePage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)
    expect(screen.getByText('Documento doc-1')).toBeInTheDocument()
  })

  it('renderiza a página de notificações', () => {
    render(<NotificacoesPage />)
    expect(screen.getByText('Notificações')).toBeInTheDocument()
  })

  it('renderiza a página de usuários do admin', () => {
    render(<AdminUsuariosPage />)
    expect(screen.getByText('Usuários')).toBeInTheDocument()
  })

  it('renderiza a página de regras de notificação do admin', () => {
    render(<AdminRegrasNotificacaoPage />)
    expect(screen.getByText('Regras de notificação')).toBeInTheDocument()
  })
})
