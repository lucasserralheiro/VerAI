import { extrairTituloProposta } from './extrairTituloProposta'

describe('extrairTituloProposta', () => {
  it('usa o heading "Proposta Comercial" mesmo quando não é o primeiro #', () => {
    const md = '## Proposta Comercial: PC-CGM-260707-867\n\n# TERMOS E CONDIÇÕES DE CONTRATAÇÃO'
    expect(extrairTituloProposta(md, 'arquivo.pdf')).toBe('Proposta Comercial: PC-CGM-260707-867')
  })

  it('sem heading de identificação, usa o primeiro #', () => {
    expect(extrairTituloProposta('texto\n\n# Termo de Referência', 'arquivo.pdf')).toBe('Termo de Referência')
  })

  it('tira negrito do heading', () => {
    expect(extrairTituloProposta('# **Proposta Comercial: PC-1**', 'arquivo.pdf')).toBe('Proposta Comercial: PC-1')
  })

  it('cai pro nome do arquivo sem conteúdo ou sem heading', () => {
    expect(extrairTituloProposta(null, 'arquivo.pdf')).toBe('arquivo.pdf')
    expect(extrairTituloProposta('só texto', 'arquivo.pdf')).toBe('arquivo.pdf')
  })
})
