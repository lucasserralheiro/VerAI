/** @jest-environment node */
import { emitirBilhete, lerBilhete, type ExecucaoAssincrona } from './execucao-assincrona'

describe('bilhete da geração assíncrona', () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    process.env = { ...OLD_ENV, CONFERE_SHARED_SECRET: 'segredo-de-teste' }
  })
  afterAll(() => {
    process.env = OLD_ENV
  })

  const execucao: ExecucaoAssincrona = {
    job: 'job-1',
    execucao: 'exec-1',
    usuarioId: 'u-1',
    contratoId: 'c-1',
    competencia: { ano: 2026, mes: 9 },
    nomes: { contrato: 'PC.pdf', levantamento: 'lev.xlsx', aditivos: [] },
    entradas: [{ papel: 'contrato', nome: 'PC.pdf', caminho: 'r2:confere-execucoes/exec-1/entrada-0.pdf' }],
    emitidoEm: 1_000,
  }

  it('volta igual para quem enviou', () => {
    expect(lerBilhete(emitirBilhete(execucao), 'u-1', 2_000)).toEqual(execucao)
  })

  it('não serve para outra pessoa', () => {
    expect(lerBilhete(emitirBilhete(execucao), 'u-2', 2_000)).toBeNull()
  })

  it('recusa bilhete alterado — a tela não troca o contrato do histórico', () => {
    const [, assinado] = emitirBilhete(execucao).split('.')
    const forjado = Buffer.from(JSON.stringify({ ...execucao, contratoId: 'outro' })).toString('base64url')
    expect(lerBilhete(`${forjado}.${assinado}`, 'u-1', 2_000)).toBeNull()
  })

  it('recusa bilhete vencido', () => {
    expect(lerBilhete(emitirBilhete(execucao), 'u-1', 1_000 + 3 * 60 * 60 * 1000)).toBeNull()
  })

  it('recusa lixo', () => {
    expect(lerBilhete('nada', 'u-1')).toBeNull()
    expect(lerBilhete('a.b.c', 'u-1')).toBeNull()
  })
})
