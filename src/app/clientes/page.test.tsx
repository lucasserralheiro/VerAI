import { render, screen } from '@testing-library/react'
import ClientesPage from './page'

describe('ClientesPage', () => {
  it('usa font-semibold no título (não font-bold)', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    ) as unknown as jest.Mock

    render(<ClientesPage />)
    const heading = await screen.findByRole('heading', { name: 'Clientes' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })
})
