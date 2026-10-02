import { act, renderHook } from '@testing-library/react'

jest.mock('./enviar-anexo', () => ({ enviarAnexo: jest.fn() }))

import { enviarAnexo, type EstadoAnexo } from './enviar-anexo'
import { useAnexos } from './use-anexos'

type Chamada = {
  arquivo: File
  aoMudar: (e: Partial<EstadoAnexo>) => void
  signal: AbortSignal
  concluir: (r: { anexoId: string; texto: string } | null) => void
}

/** Cada envio fica pendente até o teste concluir — é como se vê a fila andar um por vez. */
function enviosControlados() {
  const chamadas: Chamada[] = []
  ;(enviarAnexo as jest.Mock).mockImplementation(
    (arquivo: File, _conversa: string, aoMudar: Chamada['aoMudar'], deps: { signal: AbortSignal }) =>
      new Promise((resolve) => {
        chamadas.push({ arquivo, aoMudar, signal: deps.signal, concluir: resolve })
        // Como o envio de verdade: abortado, devolve null sem registrar.
        deps.signal.addEventListener('abort', () => resolve(null))
      })
  )
  return chamadas
}

const arquivo = (nome: string) => new File(['x'], nome)

beforeEach(() => jest.clearAllMocks())

it('envia um por vez, mostra o andamento e entrega cada ficha', async () => {
  const chamadas = enviosControlados()
  const aoFicha = jest.fn()
  const { result } = renderHook(() => useAnexos({ aoFicha }))

  let promessa!: Promise<boolean>
  act(() => {
    promessa = result.current.anexar([arquivo('a.pdf'), arquivo('b.docx')], 'c1')
  })
  expect(result.current.anexos.map((a) => [a.nome, a.etapa])).toEqual([['a.pdf', 'fila'], ['b.docx', 'fila']])
  expect(chamadas).toHaveLength(1)
  expect((enviarAnexo as jest.Mock).mock.calls[0][1]).toBe('c1')

  act(() => chamadas[0].aoMudar({ etapa: 'ocr', progresso: { pagina: 1, total: 4 } }))
  expect(result.current.anexos[0]).toMatchObject({ etapa: 'ocr', progresso: { pagina: 1, total: 4 } })

  await act(async () => {
    chamadas[0].aoMudar({ etapa: 'pronto', anexoId: 'a1' })
    chamadas[0].concluir({ anexoId: 'a1', texto: 'ficha A' })
  })
  expect(aoFicha).toHaveBeenCalledWith('ficha A', 'a1')
  expect(chamadas).toHaveLength(2)
  expect(chamadas[1].arquivo.name).toBe('b.docx')

  await act(async () => {
    chamadas[1].concluir({ anexoId: 'a2', texto: 'ficha B' })
    expect(await promessa).toBe(true)
  })
  expect(aoFicha).toHaveBeenCalledTimes(2)
})

it('um anexo com erro não para a fila; o lote devolve false', async () => {
  const chamadas = enviosControlados()
  const { result } = renderHook(() => useAnexos({ aoFicha: jest.fn() }))
  let promessa!: Promise<boolean>
  act(() => {
    promessa = result.current.anexar([arquivo('a.png'), arquivo('b.txt')], 'c1')
  })
  await act(async () => {
    chamadas[0].aoMudar({ etapa: 'erro', erro: 'formato não aceito' })
    chamadas[0].concluir(null)
  })
  expect(chamadas).toHaveLength(2)
  await act(async () => {
    chamadas[1].concluir({ anexoId: 'a2', texto: 'f' })
    expect(await promessa).toBe(false)
  })
  expect(result.current.anexos.map((a) => a.etapa)).toEqual(['erro', 'fila'])
})

it('reiniciar (trocar ou nova conversa) aborta o envio em curso: nada é registrado nem vira mensagem', async () => {
  const chamadas = enviosControlados()
  const aoFicha = jest.fn()
  const { result } = renderHook(() => useAnexos({ aoFicha }))
  let promessa!: Promise<boolean>
  act(() => {
    promessa = result.current.anexar([arquivo('a.pdf'), arquivo('b.pdf')], 'c1')
  })
  const anexoAberto: EstadoAnexo = { id: 'x1', nome: 'antigo.pdf', etapa: 'pronto' }
  await act(async () => {
    result.current.reiniciar([anexoAberto])
    expect(await promessa).toBe(false)
  })
  expect(chamadas[0].signal.aborted).toBe(true)
  expect(chamadas).toHaveLength(1) // o segundo nunca saiu
  expect(aoFicha).not.toHaveBeenCalled()
  expect(result.current.anexos).toEqual([anexoAberto])

  // depois do reinício, um lote novo anda normalmente (outro AbortController)
  act(() => {
    void result.current.anexar([arquivo('c.pdf')], 'c2')
  })
  expect(chamadas).toHaveLength(2)
  expect(chamadas[1].signal.aborted).toBe(false)
  await act(async () => chamadas[1].concluir({ anexoId: 'a3', texto: 'ficha C' }))
  expect(aoFicha).toHaveBeenCalledWith('ficha C', 'a3')
})

it('fechar o painel (desmontar) aborta o envio em curso', () => {
  const chamadas = enviosControlados()
  const { result, unmount } = renderHook(() => useAnexos({ aoFicha: jest.fn() }))
  act(() => {
    void result.current.anexar([arquivo('a.pdf')], 'c1')
  })
  unmount()
  expect(chamadas[0].signal.aborted).toBe(true)
})

it('registrarFalha mostra os cartões com o erro, sem enviar', () => {
  enviosControlados()
  const { result } = renderHook(() => useAnexos({ aoFicha: jest.fn() }))
  act(() => result.current.registrarFalha([arquivo('a.pdf')], 'não foi possível criar a conversa'))
  expect(result.current.anexos).toEqual([expect.objectContaining({ nome: 'a.pdf', etapa: 'erro', erro: 'não foi possível criar a conversa' })])
  expect(enviarAnexo).not.toHaveBeenCalled()
})
