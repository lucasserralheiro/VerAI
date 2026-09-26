import { TEMAS_MANUAL } from './temas'
import { MANUAL } from './index'

describe('manual da equipe', () => {
  it.each(TEMAS_MANUAL)('%s tem cabeçalho válido e cabe no teto', (tema) => {
    const t = MANUAL[tema]
    expect(t.tema).toBe(tema)
    expect(t.titulo.trim()).not.toBe('')
    expect(t.palavrasChave.length).toBeGreaterThan(0)
    expect(['rascunho', 'validado']).toContain(t.status)
    expect(t.texto.length).toBeLessThanOrEqual(3000)
    if (t.status === 'rascunho') {
      expect(t.validadoPor).toBeNull()
      expect(t.validadoEm).toBeNull()
    } else {
      expect(t.validadoPor).toBeTruthy()
      expect(t.validadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it.each(TEMAS_MANUAL)('%s: artigo de lei citado só com [confirmar] na mesma frase', (tema) => {
    const frases = MANUAL[tema].texto.split(/(?<=[.!?])\s+|\n/)
    for (const frase of frases) {
      if (/\bart(igo|\.)\s*\d/i.test(frase)) expect(frase).toContain('[confirmar]')
    }
  })

  it('não tem tema além da lista', () => {
    expect(Object.keys(MANUAL).sort()).toEqual([...TEMAS_MANUAL].sort())
  })
})
