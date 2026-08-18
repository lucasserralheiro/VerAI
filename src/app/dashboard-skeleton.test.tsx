import { render, screen } from '@testing-library/react'
import NotificacoesPage from './notificacoes/page'
import AdminUsuariosPage from './admin/usuarios/page'
import AdminRegrasNotificacaoPage from './admin/regras-notificacao/page'

// A listagem (`/`, módulo 4) e o detalhe do documento (`/documentos/[id]`,
// módulo 5) saíram daqui — deixaram de ser esqueleto. As demais páginas
// abaixo continuam esqueleto.
describe('páginas esqueleto do dashboard', () => {
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
