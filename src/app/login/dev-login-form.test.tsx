import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DevLoginForm } from './dev-login-form'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

describe('DevLoginForm', () => {
  beforeEach(() => {
    pushMock.mockClear()
    global.fetch = jest.fn()
  })

  it('renderiza o botão de acesso direto', () => {
    render(<DevLoginForm />)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('redireciona para /clientes ao entrar', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
    render(<DevLoginForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/clientes'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/dev-login',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('mostra mensagem de erro quando o acesso falha', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
    render(<DevLoginForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText('Não foi possível entrar')).toBeInTheDocument())
  })
})
