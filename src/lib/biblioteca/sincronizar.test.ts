/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
// `servico` importa o storage (Vercel Blob) — mesmo mock do teste da sincronização da ContratosReceita.
jest.mock('@/lib/storage', () => ({ putUpload: jest.fn(), deleteUpload: jest.fn(async () => {}), getUpload: jest.fn() }))

import type { PrismaClient } from '@prisma/client'
import { sha256Hex } from '@/lib/arquivos/servico'
import { sincronizarBiblioteca } from './sincronizar'

/* eslint-disable @typescript-eslint/no-explicit-any */

const quando = new Date('2026-09-29T10:00:00Z')
const agora = new Date('2026-09-29T13:00:00Z')
const TABELA = 'TABELA DE PREÇOS PRODAM-SP/Tabela 2026 v3.0.pdf'
const LINK = 'FATURAMENTO SERVIÇOS PRODAM/Links MPLS/2026/2026.09/Links Solução/CGM 09-2026.pdf'

function fonte(arquivos: Record<string, Buffer>, data = quando) {
  return {
    listar: async () => Object.entries(arquivos).map(([caminho, c]) => ({ caminho, tamanhoBytes: c.length, modificadoEm: data })),
    ler: jest.fn(async (caminho: string) => arquivos[caminho]),
  }
}

function prismaFake(inicial: any[] = []) {
  const linhas = inicial.map((l) => ({ removidoNaOrigemEm: null, ...l }))
  let n = 0
  const casa = (l: any, where: any = {}) =>
    Object.entries(where).every(([k, v]: [string, any]) =>
      v && typeof v === 'object' && 'in' in v ? v.in.includes(l[k]) : v === null ? l[k] == null : l[k] === v
    )
  return {
    linhas,
    arquivoBiblioteca: {
      findMany: jest.fn(async ({ where }: any = {}) => linhas.filter((l) => casa(l, where))),
      create: jest.fn(async ({ data }: any) => {
        const l = { id: `ab-${++n}`, removidoNaOrigemEm: null, ...data }
        linhas.push(l)
        return l
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(linhas.find((l) => l.id === where.id), data)),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const alvo = linhas.filter((l) => casa(l, where))
        alvo.forEach((l) => Object.assign(l, data))
        return { count: alvo.length }
      }),
    },
  }
}

const registrado = (caminho: string, conteudo: Buffer, extra: any = {}) => ({
  id: `r-${caminho.length}`,
  biblioteca: 'DOCUMENTOS',
  caminho,
  area: caminho.startsWith('TABELA') ? 'TABELA_PRECOS' : 'LINKS_MPLS',
  nome: caminho.slice(caminho.lastIndexOf('/') + 1),
  extensao: 'pdf',
  tamanhoBytes: conteudo.length,
  sha256: sha256Hex(conteudo),
  modificadoEm: quando,
  ...extra,
})

const gravar = jest.fn(async (chave: string) => `r2:${chave}`)
const rodar = (prisma: any, opcoes: any) =>
  sincronizarBiblioteca(prisma as unknown as PrismaClient, { gravar, agora, ...opcoes })

beforeEach(() => jest.clearAllMocks())

it('só listagem: conta o que entraria e não grava nada', async () => {
  const prisma = prismaFake()
  const r = await rodar(prisma, { aplicar: false, fonte: fonte({ [TABELA]: Buffer.from('a') }) })
  expect(r).toMatchObject({ listados: 1, novos: 1, conferencia: null })
  expect(gravar).not.toHaveBeenCalled()
  expect(prisma.arquivoBiblioteca.create).not.toHaveBeenCalled()
})

it('arquivo novo: grava no R2 pelo conteúdo, registra com a área e confere', async () => {
  const prisma = prismaFake()
  const conteudo = Buffer.from('tabela')
  const r = await rodar(prisma, { aplicar: true, fonte: fonte({ [TABELA]: conteudo }) })
  expect(gravar).toHaveBeenCalledWith(`biblioteca-documentos/${sha256Hex(conteudo)}.pdf`, conteudo, 'application/pdf')
  expect(prisma.linhas[0]).toMatchObject({ biblioteca: 'DOCUMENTOS', caminho: TABELA, area: 'TABELA_PRECOS', chave: `r2:biblioteca-documentos/${sha256Hex(conteudo)}.pdf` })
  expect(r.novos).toBe(1)
  expect(r.conferencia).toEqual([{ area: 'TABELA_PRECOS', noSharepoint: 1, noVerai: 1, faltando: [] }])
})

it('mesmo tamanho e data: não lê o arquivo (não baixa do OneDrive) e só marca como visto', async () => {
  const conteudo = Buffer.from('igual')
  const prisma = prismaFake([registrado(TABELA, conteudo)])
  const f = fonte({ [TABELA]: conteudo })
  const r = await rodar(prisma, { aplicar: true, fonte: f })
  expect(f.ler).not.toHaveBeenCalled()
  expect(r.iguais).toBe(1)
  expect(prisma.linhas[0].vistoEm).toEqual(agora)
})

it('data mudou e conteúdo não: atualiza a data sem gravar no R2', async () => {
  const conteudo = Buffer.from('igual')
  const prisma = prismaFake([registrado(TABELA, conteudo)])
  const r = await rodar(prisma, { aplicar: true, fonte: fonte({ [TABELA]: conteudo }, new Date('2026-09-29T11:00:00Z')) })
  expect(gravar).not.toHaveBeenCalled()
  expect(r).toMatchObject({ iguais: 1, mudados: 0 })
})

it('conteúdo mudou: grava de novo e o leitor da área recebe o arquivo como mudado', async () => {
  const prisma = prismaFake([registrado(TABELA, Buffer.from('v1'))])
  const leitor = jest.fn(async () => 'tabela: lida')
  const r = await rodar(prisma, {
    aplicar: true,
    fonte: fonte({ [TABELA]: Buffer.from('v2 maior') }),
    leitores: { TABELA_PRECOS: leitor },
  })
  expect(r.mudados).toBe(1)
  expect(leitor).toHaveBeenCalledWith(expect.objectContaining({ mudados: [prisma.linhas[0].id], todos: [expect.objectContaining({ caminho: TABELA })] }))
  expect(r.leituras).toEqual(['tabela: lida'])
})

it('sumiu da pasta: remoção lógica e o leitor da área roda', async () => {
  const prisma = prismaFake([registrado(TABELA, Buffer.from('a')), registrado(LINK, Buffer.from('b'))])
  const leitor = jest.fn(async () => 'tabela: nada')
  const r = await rodar(prisma, { aplicar: true, fonte: fonte({ [LINK]: Buffer.from('b') }), leitores: { TABELA_PRECOS: leitor } })
  expect(r.removidos).toBe(1)
  expect(prisma.linhas.find((l) => l.caminho === TABELA).removidoNaOrigemEm).toEqual(agora)
  expect(leitor).toHaveBeenCalled()
})

it('listagem curta (menos da metade): remoção suspensa, nada sai', async () => {
  const prisma = prismaFake([registrado(TABELA, Buffer.from('a')), registrado(LINK, Buffer.from('b')), registrado('CALENDÁRIO FATURAMENTO/c.pdf', Buffer.from('c'))])
  const r = await rodar(prisma, { aplicar: true, fonte: fonte({ [LINK]: Buffer.from('b') }) })
  expect(r.remocaoSuspensa).toMatch(/remoção suspensa/)
  expect(r.removidos).toBe(0)
  expect(prisma.linhas.every((l) => l.removidoNaOrigemEm === null)).toBe(true)
})

it('falha ao gravar um arquivo não para os outros e aparece na conferência', async () => {
  const prisma = prismaFake()
  const gravarFalhando = jest.fn(async (chave: string, conteudo: Buffer) => {
    if (conteudo.toString() === 'ruim') throw new Error('R2 fora')
    return `r2:${chave}`
  })
  const r = await sincronizarBiblioteca(prisma as any, {
    aplicar: true,
    agora,
    gravar: gravarFalhando,
    fonte: fonte({ [TABELA]: Buffer.from('ruim'), [LINK]: Buffer.from('bom') }),
  })
  expect(r.falhas).toEqual([{ caminho: TABELA, motivo: 'R2 fora' }])
  expect(r.conferencia).toContainEqual({ area: 'TABELA_PRECOS', noSharepoint: 1, noVerai: 0, faltando: [TABELA] })
})

it('leitor que lança vira linha do log, o resto segue', async () => {
  const prisma = prismaFake()
  const r = await rodar(prisma, {
    aplicar: true,
    fonte: fonte({ [TABELA]: Buffer.from('a') }),
    leitores: {
      TABELA_PRECOS: async () => {
        throw new Error('planilha quebrada')
      },
    },
  })
  expect(r.leituras).toEqual(['TABELA_PRECOS: leitura falhou — planilha quebrada'])
  expect(r.conferencia?.[0].faltando).toEqual([])
})

it('--reler: o leitor roda mesmo sem nada mudado', async () => {
  const conteudo = Buffer.from('igual')
  const prisma = prismaFake([registrado(TABELA, conteudo)])
  const leitor = jest.fn(async () => 'relido')
  await rodar(prisma, { aplicar: true, fonte: fonte({ [TABELA]: conteudo }), leitores: { TABELA_PRECOS: leitor }, relerAreas: ['TABELA_PRECOS'] })
  expect(leitor).toHaveBeenCalledWith(expect.objectContaining({ mudados: [] }))
})

it('regra de área mudou: corrige a área do arquivo já registrado e o leitor da área nova roda', async () => {
  const CONTROLE = 'FATURAMENTO SERVIÇOS PRODAM/Controles de Contratos/08.2026/CGM - CO-16-CGM-2024 - 2026.08.pdf'
  const conteudo = Buffer.from('c')
  const prisma = prismaFake([registrado(CONTROLE, conteudo, { area: 'LINKS_MPLS' })])
  const leitor = jest.fn(async () => 'controles: 1')
  await rodar(prisma, { aplicar: true, fonte: fonte({ [CONTROLE]: conteudo }), leitores: { CONTROLES_CONTRATOS: leitor } })
  expect(prisma.linhas[0].area).toBe('CONTROLES_CONTRATOS')
  expect(leitor).toHaveBeenCalledWith(expect.objectContaining({ releitura: false }))
})

it('--reler avisa o leitor que é releitura', async () => {
  const conteudo = Buffer.from('igual')
  const prisma = prismaFake([registrado(TABELA, conteudo)])
  const leitor = jest.fn(async () => 'relido')
  await rodar(prisma, { aplicar: true, fonte: fonte({ [TABELA]: conteudo }), leitores: { TABELA_PRECOS: leitor }, relerAreas: ['TABELA_PRECOS'] })
  expect(leitor).toHaveBeenCalledWith(expect.objectContaining({ releitura: true }))
})

it('arquivo temporário do Office e desktop.ini ficam de fora', async () => {
  const prisma = prismaFake()
  const r = await rodar(prisma, {
    aplicar: true,
    fonte: fonte({ [TABELA]: Buffer.from('a'), 'TABELA DE PREÇOS PRODAM-SP/~$Memória.xlsx': Buffer.from('t'), 'TABELA DE PREÇOS PRODAM-SP/desktop.ini': Buffer.from('d') }),
  })
  expect(r).toMatchObject({ listados: 1, ignorados: 2 })
})
