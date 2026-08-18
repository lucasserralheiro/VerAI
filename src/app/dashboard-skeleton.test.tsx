import { render, screen } from '@testing-library/react'
import AdminUsuariosPage from './admin/usuarios/page'

// Listagem (módulo 4), detalhe do documento (módulo 5) e notificações +
// regras de notificação (módulo 6) saíram daqui — deixaram de ser
// esqueleto. Só a gestão de usuários (módulo 8) continua.
describe('páginas esqueleto do dashboard', () => {
  it('renderiza a página de usuários do admin', () => {
    render(<AdminUsuariosPage />)
    expect(screen.getByText('Usuários')).toBeInTheDocument()
  })
})
