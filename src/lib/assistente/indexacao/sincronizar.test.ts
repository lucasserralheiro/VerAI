/** @jest-environment node */
jest.mock('@/lib/prisma', () => {
  const tx = {
    indiceDocumento: { deleteMany: jest.fn(), create: jest.fn(async () => ({ id: 'i-novo' })) },
    $executeRaw: jest.fn(),
  }
  return {
    prisma: {
      indiceDocumento: { findMany: jest.fn(), deleteMany: jest.fn() },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      __tx: tx,
    },
  }
})
jest.mock('./fontes', () => ({ listarFontes: jest.fn() }))
jest.mock('./extrair', () => ({
  extrairPaginas: jest.fn(async () => [{ pagina: 1, texto: 'Termo aditivo nº 2 — reajuste pelo IPCA acumulado.' }]),
  // Mesma regra de extrair.ts, inline: o requireActual carregaria o unpdf de verdade (ESM).
  semCamadaDeTexto: (paginas: { texto: string }[]) => paginas.every((p) => p.texto.replace(/\s/g, '').length < 20),
}))

import { prisma } from '@/lib/prisma'
import { listarFontes, type FonteDocumento } from './fontes'
import { extrairPaginas } from './extrair'
import { indexarFonte, sincronizarIndice, type DepsIndexacao } from './sincronizar'

const tx = (prisma as unknown as { __tx: { indiceDocumento: { deleteMany: jest.Mock; create: jest.Mock }; $executeRaw: jest.Mock } }).__tx
const fonte = (over: Partial<FonteDocumento> = {}): FonteDocumento => ({
  origem: 'HISTORICO_TERMO',
  origemId: 'h1',
  url: 'https://b/h1.pdf',
  nomeArquivo: 'TA_02.pdf',
  tipo: 'pdf',
  clienteId: 'c1',
  contratoId: 'k1',
  textoPronto: null,
  ...over,
})
const deps: DepsIndexacao = { baixar: jest.fn(async () => Buffer.from('pdf')), versaoDoBlob: jest.fn(async () => 'v1') }

beforeEach(() => jest.clearAllMocks())

describe('indexarFonte', () => {
  it('ok: apaga o índice antigo, cria o novo e grava os trechos com tsvector', async () => {
    expect(await indexarFonte(fonte(), deps)).toBe('ok')
    expect(tx.indiceDocumento.deleteMany).toHaveBeenCalledWith({ where: { origem: 'HISTORICO_TERMO', origemId: 'h1' } })
    expect(tx.indiceDocumento.create.mock.calls[0][0].data).toMatchObject({ status: 'ok', versao: 'v1', totalTrechos: 1 })
    const sql = tx.$executeRaw.mock.calls[0][0]
    expect(sql.sql).toContain("to_tsvector('portuguese', unaccent(")
    expect(sql.values).toContain('Termo aditivo nº 2 — reajuste pelo IPCA acumulado.')
  })

  it('sem_texto: registra o estado e não grava trecho', async () => {
    ;(extrairPaginas as jest.Mock).mockResolvedValueOnce([{ pagina: 1, texto: ' ' }])
    expect(await indexarFonte(fonte(), deps)).toBe('sem_texto')
    expect(tx.$executeRaw).not.toHaveBeenCalled()
  })

  it('erro: guarda a mensagem, versão nula (pra tentar de novo) e não lança', async () => {
    ;(deps.baixar as jest.Mock).mockRejectedValueOnce(new Error('404 no blob'))
    expect(await indexarFonte(fonte(), deps)).toBe('erro')
    expect(tx.indiceDocumento.create.mock.calls[0][0].data).toMatchObject({ status: 'erro', versao: null, mensagem: '404 no blob' })
  })

  it('texto pronto: não baixa nada e versiona pelo hash', async () => {
    await indexarFonte(fonte({ origem: 'PROPOSTA_COMERCIAL_ARQUIVO', textoPronto: '<p>Proposta de serviços de rede para a secretaria</p>' }), deps)
    expect(deps.baixar).not.toHaveBeenCalled()
    expect(tx.indiceDocumento.create.mock.calls[0][0].data.versao).toMatch(/^[0-9a-f]{40}$/)
  })
})

describe('sincronizarIndice', () => {
  it('indexa o que falta, reindexa URL trocada, remove órfão e respeita o limite', async () => {
    ;(listarFontes as jest.Mock).mockResolvedValue([
      fonte({ origemId: 'novo', url: 'https://b/novo.pdf' }),
      fonte({ origemId: 'trocado', url: 'https://b/trocado-2.pdf' }),
      fonte({ origemId: 'igual', url: 'https://b/igual.pdf' }),
    ])
    ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([
      { id: 'i1', origem: 'HISTORICO_TERMO', origemId: 'trocado', url: 'https://b/trocado-1.pdf', versao: 'v1' },
      { id: 'i2', origem: 'HISTORICO_TERMO', origemId: 'igual', url: 'https://b/igual.pdf', versao: 'v1' },
      { id: 'i3', origem: 'HISTORICO_TERMO', origemId: 'apagado', url: 'https://b/x.pdf', versao: 'v1' },
    ])
    const resumo = await sincronizarIndice({ limite: 1, deps })
    expect(prisma.indiceDocumento.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['i3'] } } })
    expect(resumo).toEqual({ ok: 1, sem_texto: 0, erro: 0, removidos: 1, restantes: 1 })
    expect(deps.versaoDoBlob).toHaveBeenCalledTimes(1) // só do arquivo indexado; sem conferirVersao
  })

  it('conferirVersao: reindexa o arquivo sobrescrito no mesmo caminho', async () => {
    ;(listarFontes as jest.Mock).mockResolvedValue([fonte({ origemId: 'igual', url: 'https://b/igual.pdf' })])
    ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([
      { id: 'i2', origem: 'HISTORICO_TERMO', origemId: 'igual', url: 'https://b/igual.pdf', versao: 'v0' },
    ])
    const resumo = await sincronizarIndice({ conferirVersao: true, deps })
    expect(resumo.ok).toBe(1)
  })
})
