/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: { cliente: { findUnique: jest.fn() }, arquivoCliente: { findMany: jest.fn() } },
}))

import { prisma } from '@/lib/prisma'

import { pastasDoCliente } from './pastas'
import { PASTA_ENVIADOS, PASTA_FORA } from './tipos-cadastro'

function arquivo(id: string, nome: string, caminhos: Array<string | [string, Date]>) {
  return {
    id,
    nome,
    extensao: nome.split('.').pop(),
    categoria: 'OUTRO',
    sharepoint: caminhos.map((c) =>
      typeof c === 'string' ? { caminho: c, removidoNaOrigemEm: null } : { caminho: c[0], removidoNaOrigemEm: c[1] }
    ),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
    id: 'cl-cgm',
    nome: 'Controladoria Geral do Município',
    siglaLegado: 'CGM',
  })
})

it('cliente inexistente: null', async () => {
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null)
  await expect(pastasDoCliente('x')).resolves.toBeNull()
})

it('tira a pasta do cliente do caminho do SharePoint', async () => {
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([
    arquivo('pa', 'PA-CGM- 250912-127 v4.0.pdf', [
      'CGM/TC 16-CGM-2024 - Sustentação/3) TC 16-CGM-2024 - TA 02 - Prorrogação/PA-CGM- 250912-127 v4.0.pdf',
    ]),
    arquivo('solto', 'Ofício.pdf', ['CGM/Ofício.pdf']),
  ])
  const pastas = await pastasDoCliente('cl-cgm')
  expect(prisma.arquivoCliente.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { clienteId: 'cl-cgm', removidoEm: null } })
  )
  expect(pastas).toEqual({
    cliente: { id: 'cl-cgm', nome: 'Controladoria Geral do Município', sigla: 'CGM' },
    arquivos: [
      {
        arquivoId: 'pa',
        nome: 'PA-CGM- 250912-127 v4.0.pdf',
        extensao: 'pdf',
        categoria: 'OUTRO',
        pasta: ['TC 16-CGM-2024 - Sustentação', '3) TC 16-CGM-2024 - TA 02 - Prorrogação'],
      },
      { arquivoId: 'solto', nome: 'Ofício.pdf', extensao: 'pdf', categoria: 'OUTRO', pasta: [] },
    ],
  })
})

it('sem caminho do SharePoint: "Enviados pelo VerAI"; caminho que saiu do SharePoint: "Fora do SharePoint"', async () => {
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([
    arquivo('pc', 'PC.pdf', ['CGM/TC 16/1) Inicial/PC.pdf']),
    arquivo('enviado', 'Planilha.xlsx', []),
    arquivo('saiu', 'Antigo.pdf', [['CGM/TC 12/Antigo.pdf', new Date()]]),
  ])
  const pastas = await pastasDoCliente('cl-cgm')
  expect(pastas?.arquivos.map((a) => [a.arquivoId, a.pasta])).toEqual([
    ['pc', ['TC 16', '1) Inicial']],
    ['enviado', [PASTA_ENVIADOS]],
    ['saiu', [PASTA_FORA]],
  ])
})

it('publicação de outra pasta da biblioteca fica com o caminho inteiro; o mesmo arquivo em duas pastas aparece nas duas', async () => {
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([
    arquivo('a', 'A.pdf', ['CGM/TC 16/1) Inicial/A.pdf']),
    arquivo('b', 'B.pdf', ['CGM/TC 16/2) TA 01/B.pdf', 'CGM/TC 16/3) TA 02/B.pdf']),
    arquivo('doc', 'DOC 01-01-2026.pdf', ['1. PUBLICAÇÕES NO DOC/2026/DOC 01-01-2026.pdf']),
  ])
  const pastas = await pastasDoCliente('cl-cgm')
  expect(pastas?.arquivos.map((a) => a.pasta)).toEqual([
    ['TC 16', '1) Inicial'],
    ['TC 16', '2) TA 01'],
    ['TC 16', '3) TA 02'],
    ['1. PUBLICAÇÕES NO DOC', '2026'],
  ])
})
