import { fireEvent, render, screen } from '@testing-library/react'

let pathname = '/clientes'
jest.mock('next/navigation', () => ({ usePathname: () => pathname }))
jest.mock('./painel-assistente', () => ({
  PainelAssistente: ({ rota, onFechar }: { rota: string; onFechar: () => void }) => (
    <div>
      painel {rota} <button onClick={onFechar}>fechar</button>
    </div>
  ),
}))

import { AssistenteFlutuante } from './assistente-flutuante'

beforeEach(() => (pathname = '/clientes'))

it('não aparece no login', () => {
  pathname = '/login'
  const { container } = render(<AssistenteFlutuante />)
  expect(container).toBeEmptyDOMElement()
})

it('abre pelo botão e fecha pelo painel', () => {
  render(<AssistenteFlutuante />)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir assistente' }))
  expect(screen.getByText('painel /clientes')).toBeInTheDocument()
  fireEvent.click(screen.getByText('fechar'))
  expect(screen.queryByText(/painel/)).not.toBeInTheDocument()
})

it('Ctrl+K alterna', () => {
  render(<AssistenteFlutuante />)
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  expect(screen.getByText('painel /clientes')).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  expect(screen.queryByText(/painel/)).not.toBeInTheDocument()
})
