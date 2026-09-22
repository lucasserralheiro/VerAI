import { fireEvent, render, screen } from '@testing-library/react'
import { AbaDocumentos } from './aba-documentos'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

function mockDocumentos(documentos: Array<{ competenciaAno: number; competenciaMes: number; status: string }>) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(documentos.map((d, i) => ({ id: `d${i}`, ...d }))),
    })
  ) as jest.Mock
}

describe('AbaDocumentos', () => {
  beforeEach(() => mockPush.mockClear())

  it('agrupa os documentos por competência, mais recente primeiro', async () => {
    mockDocumentos([
      { competenciaAno: 2025, competenciaMes: 1, status: 'concluido' },
      { competenciaAno: 2025, competenciaMes: 3, status: 'erro' },
      { competenciaAno: 2025, competenciaMes: 3, status: 'concluido' },
    ])
    render(<AbaDocumentos clienteId="c1" />)

    expect(await screen.findByText('2 competências registradas')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/clientes/c1/2025-03', '/clientes/c1/2025-01'])
    expect(screen.getByText('2 documentos')).toBeInTheDocument()
    expect(screen.getByText('1 erro')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/documentos?clienteId=c1')
  })

  it('"Nova competência" abre o seletor e navega pra competência escolhida', async () => {
    mockDocumentos([{ competenciaAno: 2025, competenciaMes: 1, status: 'concluido' }])
    render(<AbaDocumentos clienteId="c1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Nova competência' }))
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir competência' }))

    expect(mockPush).toHaveBeenCalledWith('/clientes/c1/2026-07')
  })

  it('sem documentos, o seletor já abre sozinho', async () => {
    mockDocumentos([])
    render(<AbaDocumentos clienteId="c1" />)
    expect(await screen.findByRole('button', { name: 'Abrir competência' })).toBeInTheDocument()
  })
})
