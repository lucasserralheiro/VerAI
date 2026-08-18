import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from './page'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    pushMock.mockClear()
    global.fetch = jest.fn()
  })

  it('renderiza o formulário de login', () => {
    render(<LoginPage />)
    expect(screen.getByText('VerAI — Login')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('E-mail')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Senha')).toBeInTheDocument()
  })

  it('redireciona para / após login bem-sucedido', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'admin@verai.local' } })
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'admin123' } })
    fireEvent.click(screen.getByText('Entrar'))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
  })

  it('mostra mensagem de erro quando o login falha', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'admin@verai.local' } })
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'errada' } })
    fireEvent.click(screen.getByText('Entrar'))

    await waitFor(() => expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument())
  })
})
