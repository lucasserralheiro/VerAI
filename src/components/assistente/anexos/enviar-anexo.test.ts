jest.mock('unpdf', () => ({ getDocumentProxy: jest.fn(), extractTextItems: jest.fn() }))
jest.mock('tesseract.js', () => ({ createWorker: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { extractTextItems, getDocumentProxy } from 'unpdf'
import { createWorker } from 'tesseract.js'
import { MAX_PERGUNTA } from '@/lib/assistente/conversas'
import { LIMITE_DA_PERGUNTA, arquivoDoTextoColado, enviarAnexo, ocrSeEscaneado, perguntaDoTextoColado, type EstadoAnexo } from './enviar-anexo'

const LINK = { url: 'https://r2.exemplo/put?assinado', endereco: 'r2:assistente/c1/0b1c2d3e-0000-4000-8000-000000000000.pdf', contentType: 'application/pdf' }

function fetchFalso(opcoes: { put?: number; registro?: { status: number; corpo: unknown } } = {}) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/assistente/conversas/c1/anexos/envio') return new Response(JSON.stringify(LINK), { status: 200 })
    if (url === LINK.url) return new Response(null, { status: opcoes.put ?? 200 })
    if (url === '/api/assistente/conversas/c1/anexos') {
      const r = opcoes.registro ?? { status: 200, corpo: { anexo: { id: 'a1', nome: 'p.pdf', status: 'ok', ficha: null }, texto: '**p.pdf** — proposta' } }
      return new Response(JSON.stringify(r.corpo), { status: r.status })
    }
    throw new Error(`url inesperada ${url} ${init?.method}`)
  })
}

const pdf = (nome = 'p.pdf') => new File(['%PDF-1.7'], nome, { type: 'application/pdf' })
// O jsdom não tem `Blob.arrayBuffer` (todo navegador tem).
const pdfComBytes = () => Object.assign(pdf(), { arrayBuffer: async () => new ArrayBuffer(8) })

describe('enviarAnexo', () => {
  it('pede o link, faz o PUT com o content-type assinado e registra; devolve a ficha', async () => {
    const f = fetchFalso()
    const etapas: Partial<EstadoAnexo>[] = []
    const r = await enviarAnexo(pdf(), 'c1', (e) => etapas.push(e), { fetch: f as unknown as typeof fetch, ocr: async () => null })
    expect(r).toEqual({ anexoId: 'a1', texto: '**p.pdf** — proposta' })
    expect(f.mock.calls.map((c) => c[0])).toEqual(['/api/assistente/conversas/c1/anexos/envio', LINK.url, '/api/assistente/conversas/c1/anexos'])
    expect(JSON.parse(f.mock.calls[0][1]!.body as string)).toEqual({ nome: 'p.pdf', tamanhoBytes: 8 })
    expect(f.mock.calls[1][1]).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'application/pdf' } })
    expect(JSON.parse(f.mock.calls[2][1]!.body as string)).toEqual({ endereco: LINK.endereco, nome: 'p.pdf' })
    expect(etapas.map((e) => e.etapa)).toEqual(['enviando', 'lendo', 'pronto'])
    expect(etapas.at(-1)).toEqual({ etapa: 'pronto', anexoId: 'a1' })
  })

  it('formato fora da lista: erro sem chamar fetch', async () => {
    const f = fetchFalso()
    const etapas: Partial<EstadoAnexo>[] = []
    expect(await enviarAnexo(new File(['x'], 'foto.png'), 'c1', (e) => etapas.push(e), { fetch: f as unknown as typeof fetch })).toBeNull()
    expect(f).not.toHaveBeenCalled()
    expect(etapas).toEqual([{ etapa: 'erro', erro: 'formato não aceito' }])
  })

  it('acima de 50 MB: erro sem chamar fetch', async () => {
    const f = fetchFalso()
    const grande = new File(['x'], 'grande.txt')
    Object.defineProperty(grande, 'size', { value: 50 * 1024 * 1024 + 1 })
    const etapas: Partial<EstadoAnexo>[] = []
    expect(await enviarAnexo(grande, 'c1', (e) => etapas.push(e), { fetch: f as unknown as typeof fetch })).toBeNull()
    expect(f).not.toHaveBeenCalled()
    expect(etapas).toEqual([{ etapa: 'erro', erro: 'arquivo acima de 50 MB' }])
  })

  it('PDF escaneado: passa pelo OCR com progresso e o registro leva paginasOcr', async () => {
    const f = fetchFalso()
    const etapas: Partial<EstadoAnexo>[] = []
    const ocr = jest.fn(async (_a: File, aoProgredir: (p: { pagina: number; total: number }) => void) => {
      aoProgredir({ pagina: 1, total: 2 })
      aoProgredir({ pagina: 2, total: 2 })
      return [{ pagina: 1, texto: 'TERMO ADITIVO' }, { pagina: 2, texto: 'valor' }]
    })
    await enviarAnexo(pdf(), 'c1', (e) => etapas.push(e), { fetch: f as unknown as typeof fetch, ocr })
    expect(etapas.filter((e) => e.etapa === 'ocr')).toEqual([
      { etapa: 'ocr', progresso: { pagina: 1, total: 2 } },
      { etapa: 'ocr', progresso: { pagina: 2, total: 2 } },
    ])
    expect(JSON.parse(f.mock.calls[2][1]!.body as string).paginasOcr).toEqual([{ pagina: 1, texto: 'TERMO ADITIVO' }, { pagina: 2, texto: 'valor' }])
  })

  it('OCR só para PDF: docx não chama o ocr', async () => {
    const f = fetchFalso()
    const ocr = jest.fn()
    await enviarAnexo(new File(['x'], 'a.docx'), 'c1', () => {}, { fetch: f as unknown as typeof fetch, ocr })
    expect(ocr).not.toHaveBeenCalled()
  })

  it('PUT recusado: etapa erro e nada é registrado', async () => {
    const f = fetchFalso({ put: 403 })
    const etapas: Partial<EstadoAnexo>[] = []
    expect(await enviarAnexo(pdf(), 'c1', (e) => etapas.push(e), { fetch: f as unknown as typeof fetch, ocr: async () => null })).toBeNull()
    expect(etapas.at(-1)).toEqual({ etapa: 'erro', erro: 'O armazenamento recusou "p.pdf" (403).' })
    expect(f.mock.calls.map((c) => c[0])).not.toContain('/api/assistente/conversas/c1/anexos')
  })

  it('registro recusado: mostra o erro da rota', async () => {
    const f = fetchFalso({ registro: { status: 400, corpo: { error: 'arquivo não encontrado; envie de novo' } } })
    const etapas: Partial<EstadoAnexo>[] = []
    expect(await enviarAnexo(pdf(), 'c1', (e) => etapas.push(e), { fetch: f as unknown as typeof fetch, ocr: async () => null })).toBeNull()
    expect(etapas.at(-1)).toEqual({ etapa: 'erro', erro: 'arquivo não encontrado; envie de novo' })
  })

  it('sinal abortado antes do registro: não registra e não marca erro', async () => {
    const f = fetchFalso()
    const abort = new AbortController()
    const etapas: Partial<EstadoAnexo>[] = []
    const ocr = async () => {
      abort.abort()
      return null
    }
    expect(await enviarAnexo(pdf(), 'c1', (e) => etapas.push(e), { fetch: f as unknown as typeof fetch, ocr, signal: abort.signal })).toBeNull()
    expect(f).not.toHaveBeenCalled()
    expect(etapas.some((e) => e.etapa === 'erro')).toBe(false)
  })
})

describe('texto colado', () => {
  it('vira conversa-AAAA-MM-DD-HHMM.txt no horário de Brasília, text/plain', async () => {
    const a = arquivoDoTextoColado('x', new Date('2026-10-02T13:05:00Z'))
    expect(a.name).toBe('conversa-2026-10-02-1005.txt')
    expect(a.type).toBe('text/plain')
    expect(a.size).toBe(1)
  })

  it('a pergunta é a primeira linha não vazia; sem linha curta, "Analise o texto colado."', () => {
    expect(perguntaDoTextoColado('\n\n  Confira os valores abaixo  \n' + 'x'.repeat(3000))).toBe('Confira os valores abaixo')
    expect(perguntaDoTextoColado('y'.repeat(2500))).toBe('Analise o texto colado.')
  })

  it('o limite da tela é o mesmo do servidor', () => {
    expect(LIMITE_DA_PERGUNTA).toBe(MAX_PERGUNTA)
  })
})

describe('ocrSeEscaneado', () => {
  const pagina = { getViewport: () => ({ width: 10, height: 10 }), render: () => ({ promise: Promise.resolve() }) }
  const documento = (paginas: number) => ({ numPages: paginas, getPage: jest.fn(async () => pagina), destroy: jest.fn() })
  const contexto = { getImageData: () => ({ data: new Uint8ClampedArray(400), width: 10, height: 10 }), putImageData: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contexto as never)
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,x')
  })

  it('PDF com camada de texto: null, sem tesseract (e o documento é liberado)', async () => {
    const doc = documento(1)
    ;(getDocumentProxy as jest.Mock).mockResolvedValue(doc)
    ;(extractTextItems as jest.Mock).mockResolvedValue({ items: [[{ str: 'Termo de contrato de prestação de serviços' }]] })
    expect(await ocrSeEscaneado(pdfComBytes(), () => {})).toBeNull()
    expect(createWorker).not.toHaveBeenCalled()
    expect(doc.destroy).toHaveBeenCalled()
  })

  it('página só com espaços e quebras (muitos) continua sem camada de texto: dispara o OCR', async () => {
    ;(getDocumentProxy as jest.Mock).mockResolvedValue(documento(1))
    ;(extractTextItems as jest.Mock).mockResolvedValue({ items: [[{ str: ' '.repeat(40) }, { str: '\n\n\t\r\n'.repeat(10) }, { str: '12' }]] })
    const worker = { recognize: jest.fn().mockResolvedValue({ data: { text: 'texto' } }), terminate: jest.fn().mockResolvedValue(undefined) }
    ;(createWorker as jest.Mock).mockResolvedValue(worker)
    expect(await ocrSeEscaneado(pdfComBytes(), () => {})).toEqual([{ pagina: 1, texto: 'texto' }])
    expect(createWorker).toHaveBeenCalled()
  })

  it('texto real cheio de "s" tem camada de texto: não dispara o OCR', async () => {
    ;(getDocumentProxy as jest.Mock).mockResolvedValue(documento(1))
    ;(extractTextItems as jest.Mock).mockResolvedValue({ items: [[{ str: 'sessões sucessivas assinadas' }]] })
    expect(await ocrSeEscaneado(pdfComBytes(), () => {})).toBeNull()
    expect(createWorker).not.toHaveBeenCalled()
  })

  it('escaneado: reconhece página a página com progresso e encerra o worker', async () => {
    ;(getDocumentProxy as jest.Mock).mockResolvedValue(documento(2))
    ;(extractTextItems as jest.Mock).mockResolvedValue({ items: [[{ str: '  ' }], []] })
    const worker = {
      recognize: jest.fn().mockResolvedValueOnce({ data: { text: ' Página um ' } }).mockResolvedValueOnce({ data: { text: 'Página dois' } }),
      terminate: jest.fn().mockResolvedValue(undefined),
    }
    ;(createWorker as jest.Mock).mockResolvedValue(worker)
    const progresso: unknown[] = []
    expect(await ocrSeEscaneado(pdfComBytes(), (p) => progresso.push(p))).toEqual([
      { pagina: 1, texto: 'Página um' },
      { pagina: 2, texto: 'Página dois' },
    ])
    expect(createWorker).toHaveBeenCalledWith('por')
    expect(progresso).toEqual([{ pagina: 1, total: 2 }, { pagina: 2, total: 2 }])
    expect(worker.terminate).toHaveBeenCalled()
  })

  it('abortado no meio: encerra o worker e rejeita', async () => {
    ;(getDocumentProxy as jest.Mock).mockResolvedValue(documento(3))
    ;(extractTextItems as jest.Mock).mockResolvedValue({ items: [[], [], []] })
    const abort = new AbortController()
    const worker = {
      recognize: jest.fn(async () => {
        abort.abort()
        return { data: { text: 'p' } }
      }),
      terminate: jest.fn().mockResolvedValue(undefined),
    }
    ;(createWorker as jest.Mock).mockResolvedValue(worker)
    await expect(ocrSeEscaneado(pdfComBytes(), () => {}, abort.signal)).rejects.toThrow()
    expect(worker.recognize).toHaveBeenCalledTimes(1)
    expect(worker.terminate).toHaveBeenCalled()
  })

  it('abortado durante o recognize (o terminate do tesseract não rejeita o job): rejeita mesmo assim, libera worker e documento', async () => {
    const doc = documento(2)
    ;(getDocumentProxy as jest.Mock).mockResolvedValue(doc)
    ;(extractTextItems as jest.Mock).mockResolvedValue({ items: [[], []] })
    const abort = new AbortController()
    const worker = {
      recognize: jest.fn(() => {
        setTimeout(() => abort.abort(), 0)
        return new Promise(() => {}) // nunca resolve
      }),
      terminate: jest.fn().mockResolvedValue(undefined),
    }
    ;(createWorker as jest.Mock).mockResolvedValue(worker)
    await expect(ocrSeEscaneado(pdfComBytes(), () => {}, abort.signal)).rejects.toThrow('cancelado')
    expect(worker.terminate).toHaveBeenCalled()
    expect(doc.destroy).toHaveBeenCalled()
  })
})
