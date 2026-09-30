import { Suspense } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import LinksDoContratoPage from './page'

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('competencia=2026-09') }))
jest.mock('@/components/relatorios-clientes/sei-link', () => ({ SeiLink: ({ numero }: { numero: string }) => <span>SEI {numero}</span> }))

const link = (codigo: string, entidade: string, situacao = 'ATIVO') => ({ codigo, situacao, kbps: 16384, redundancia: 'Sem redundância', dataAceite: '2021-12-30T00:00:00.000Z', dataCancelamento: null, entidade, endereco: 'RUA LÍBERO BADARÓ 293' })
const dados = {
  contrato: { id: 'k1', clienteId: 'c1', numeroTermo: 'TC 16/CGM/2024', seiProdam: '7010.2023/0010021-6', cliente: { nome: 'Controladoria Geral do Município', siglaLegado: 'CGM' } },
  serie: [
    { competencia: '2026-08', categoria: 'SOLUCAO', ativos: 2 },
    { competencia: '2026-09', categoria: 'SOLUCAO', ativos: 2 },
  ],
  competencias: ['2026-09', '2026-08'],
  competencia: '2026-09',
  relatorios: [
    {
      id: 'r1', arquivoId: 'a1', competencia: '2026-09', sigla: 'CGM', clienteId: 'c1', clienteNome: 'Controladoria', contratoId: 'k1', contratoTexto: '16/CGM/2024',
      categoria: 'SOLUCAO', ativos: 2, cancelados: 0, conferido: true, avisos: [], entraram: 1, sairam: 1,
      links: [link('V05604N/21', 'STIC - CONTROLADORIA'), link('V06001N/26', 'GABINETE')],
      entraramLinks: [link('V06001N/26', 'GABINETE')],
      sairamLinks: [link('V05000N/20', 'ALMOXARIFADO')],
    },
  ],
}

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(dados) })) as jest.Mock
})

async function abrir() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <LinksDoContratoPage params={Promise.resolve({ contratoId: 'k1' })} />
      </Suspense>
    )
  })
}

it('evolução, entraram/saíram e links do mês, com o PDF e a ficha do contrato', async () => {
  await abrir()
  expect(await screen.findByRole('heading', { level: 1, name: 'Links MPLS — TC 16/CGM/2024' })).toBeInTheDocument()
  expect(global.fetch).toHaveBeenCalledWith('/api/links-mpls/contrato/k1?competencia=2026-09')
  expect(screen.getByRole('link', { name: 'CGM' })).toHaveAttribute('href', '/clientes/c1/contratos/k1')
  expect(screen.getByRole('img', { name: /Barras de links ativos/ })).toBeInTheDocument()
  expect(within(screen.getByRole('table', { name: 'Links que entraram' })).getByText('V06001N/26')).toBeInTheDocument()
  expect(within(screen.getByRole('table', { name: 'Links que saíram' })).getByText('V05000N/20')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Abrir o relatório/ })).toHaveAttribute('href', '/api/biblioteca/a1')
})

it('busca por entidade filtra os links', async () => {
  await abrir()
  await screen.findByRole('table', { name: 'Links ativos' })
  fireEvent.change(screen.getByLabelText(/Buscar código, entidade ou endereço/), { target: { value: 'stic' } })
  const ativos = screen.getByRole('table', { name: 'Links ativos' })
  expect(within(ativos).getByText('V05604N/21')).toBeInTheDocument()
  expect(within(ativos).queryByText('V06001N/26')).not.toBeInTheDocument()
})
