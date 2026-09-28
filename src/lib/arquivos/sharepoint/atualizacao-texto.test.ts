import { textoDaAtualizacao } from './atualizacao-texto'

const AS_10_30 = '2026-09-28T13:30:00.000Z' // 10:30 em São Paulo
const depois = (minutos: number) => new Date(Date.parse(AS_10_30) + minutos * 60 * 1000)

describe('textoDaAtualizacao', () => {
  it('data e hora de São Paulo, sem vírgula', () => {
    expect(textoDaAtualizacao(AS_10_30, depois(5))).toEqual({
      texto: 'Documentos do SharePoint atualizados em 28/09/2026 10:30',
      atrasada: false,
    })
  })

  it('2 horas exatas ainda não é atraso', () => {
    expect(textoDaAtualizacao(AS_10_30, depois(120)).atrasada).toBe(false)
  })

  it('passou de 2 horas: avisa', () => {
    expect(textoDaAtualizacao(AS_10_30, depois(121))).toEqual({
      texto: 'Documentos do SharePoint atualizados em 28/09/2026 10:30 — atualização atrasada',
      atrasada: true,
    })
  })

  it('banco nunca sincronizado', () => {
    expect(textoDaAtualizacao(null, depois(0))).toEqual({ texto: 'Ainda não sincronizado com o SharePoint', atrasada: true })
  })

  it('meia-noite sai 00, não 24', () => {
    expect(textoDaAtualizacao('2026-09-29T03:05:00.000Z', new Date('2026-09-29T03:10:00.000Z')).texto).toBe(
      'Documentos do SharePoint atualizados em 29/09/2026 00:05'
    )
  })
})
