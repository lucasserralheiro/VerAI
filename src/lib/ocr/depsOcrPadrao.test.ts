jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
}))

import { createWorker } from 'tesseract.js'
import { carregarDepsOcrPadrao } from './depsOcrPadrao'

describe('carregarDepsOcrPadrao — reconhecer', () => {
  // As contagens de `createWorker` abaixo são por teste — sem zerar o mock, a
  // chamada do teste anterior soma na contagem do seguinte.
  beforeEach(() => {
    ;(createWorker as jest.Mock).mockReset()
  })

  it('tenta criar um worker novo na chamada seguinte quando a criação anterior falhou — não repete o mesmo erro pra sempre', async () => {
    // Reproduz o bug real: a primeira criação do worker falha (rede, modelo
    // de português não carregou). Sem o reset, a promise rejeitada ficava
    // guardada e a SEGUNDA chamada nunca tentava `createWorker` de novo — só
    // repetia o mesmo erro, mesmo a causa original já tendo passado.
    const workerFalso = {
      recognize: jest.fn().mockResolvedValue({ data: { text: 'Texto reconhecido.', blocks: [] } }),
    }
    ;(createWorker as jest.Mock)
      .mockRejectedValueOnce(new Error('falha ao carregar o modelo de português'))
      .mockResolvedValueOnce(workerFalso)

    const { reconhecer } = await carregarDepsOcrPadrao('proposta-1')

    await expect(reconhecer('data:image/png;base64,pagina-um')).rejects.toThrow(
      'falha ao carregar o modelo de português'
    )

    const resultado = await reconhecer('data:image/png;base64,pagina-dois')

    expect(resultado.texto).toBe('Texto reconhecido.')
    // A prova do fix: createWorker foi chamado DE NOVO na segunda página, em
    // vez de reaproveitar a mesma promise rejeitada da primeira.
    expect(createWorker).toHaveBeenCalledTimes(2)
  })

  it('reaproveita o mesmo worker entre páginas quando a criação deu certo — não recria à toa', async () => {
    const workerFalso = {
      recognize: jest
        .fn()
        .mockResolvedValueOnce({ data: { text: 'Página um.', blocks: [] } })
        .mockResolvedValueOnce({ data: { text: 'Página dois.', blocks: [] } }),
    }
    ;(createWorker as jest.Mock).mockResolvedValueOnce(workerFalso)

    const { reconhecer } = await carregarDepsOcrPadrao('proposta-1')
    await reconhecer('data:image/png;base64,pagina-um')
    await reconhecer('data:image/png;base64,pagina-dois')

    expect(createWorker).toHaveBeenCalledTimes(1)
  })
})
