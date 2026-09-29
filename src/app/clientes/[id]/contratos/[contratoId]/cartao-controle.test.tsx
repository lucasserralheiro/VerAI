import { render, screen } from '@testing-library/react'
import { CartaoControle } from './cartao-controle'

const controle = {
  arquivoId: 'ab1',
  mes: '2026-08',
  sigla: 'CGM',
  contratoTexto: 'CO 16/CGM/2024',
  contratoId: 'k1',
  clienteId: 'c1',
  clienteNome: null,
  termoTexto: 'T.A. 02',
  vigenciaTexto: '15/10/2025 à 14/10/2026',
  vigenciaInicio: null,
  vigenciaFim: null,
  previsto: '6110655.80',
  faturado: '5049644.59',
  saldoCalculado: '1061011.21',
  saldoDocumento: '1061011.21',
  percentual: 82.6,
  ultimoFaturado: 'AGO/2026',
  conferido: true,
  avisos: ['vigência com datas trocadas no documento: x'],
}
const responder = (ok: boolean, corpo: unknown) => {
  global.fetch = jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(corpo) })) as jest.Mock
}

it('mostra mês do controle, termo, vigência, previsto, faturado com %, saldo, meses e avisos', async () => {
  responder(true, {
    controle,
    linhas: [
      { tipo: 'previsto', rotulo: 'MÊS 1', valor: '100' },
      { tipo: 'faturado', rotulo: 'OUT/25-16DD', valor: '210974.73' },
    ],
  })
  render(<CartaoControle contratoId="k1" />)
  expect(await screen.findByText(/Controle de ago\/2026/)).toBeInTheDocument()
  expect(screen.getByText(/T\.A\. 02/)).toBeInTheDocument()
  expect(screen.getByText('R$ 6.110.655,80')).toBeInTheDocument()
  expect(screen.getByText('R$ 5.049.644,59')).toBeInTheDocument()
  expect(screen.getByText('82,6%')).toBeInTheDocument()
  expect(screen.getByText('R$ 1.061.011,21')).toBeInTheDocument()
  expect(screen.getByText('OUT/25-16DD')).toBeInTheDocument()
  expect(screen.getByText(/datas trocadas/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /abrir o controle/i })).toHaveAttribute('href', '/api/biblioteca/ab1')
  expect(global.fetch).toHaveBeenCalledWith('/api/contratos/k1/controle')
})

it('sem controle: não mostra nada', async () => {
  responder(false, { error: 'sem controle' })
  const { container } = render(<CartaoControle contratoId="k1" />)
  await new Promise((r) => setTimeout(r, 0))
  expect(container).toBeEmptyDOMElement()
})

it('leitura não conferida: avisa e não mostra números', async () => {
  responder(true, { controle: { ...controle, conferido: false, previsto: null, faturado: null, percentual: null, saldoCalculado: null }, linhas: [] })
  render(<CartaoControle contratoId="k1" />)
  expect(await screen.findByText(/leitura não conferida/i)).toBeInTheDocument()
  expect(screen.queryByText('R$ 6.110.655,80')).not.toBeInTheDocument()
})

it('saldo do documento diferente do calculado aparece como aviso', async () => {
  responder(true, { controle: { ...controle, saldoDocumento: '9237.00', avisos: [] }, linhas: [] })
  render(<CartaoControle contratoId="k1" />)
  expect(await screen.findByText(/o controle informa saldo de R\$ 9\.237,00/)).toBeInTheDocument()
})
