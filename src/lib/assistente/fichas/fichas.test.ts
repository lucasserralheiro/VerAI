import { cortarEmTrechos, limparTexto } from '@/lib/assistente/indexacao/trechos'
import { juntarTrechos } from './paginas'
import { camposPorRegra } from './regras'
import { verificarCampo } from './verificar'

describe('juntarTrechos', () => {
  it('desfaz a sobreposição e devolve o texto da página', () => {
    const frases = Array.from({ length: 80 }, (_, i) => `Cláusula ${i + 1}. O contratado observará a condição número ${i + 1} deste termo.`)
    const pagina = frases.map((f, i) => (i % 5 === 4 ? `${f}\n` : `${f} `)).join('')
    const trechos = cortarEmTrechos([{ pagina: 1, texto: pagina }])
    expect(trechos.length).toBeGreaterThan(2)
    expect(juntarTrechos(trechos)).toEqual([{ pagina: 1, texto: limparTexto(pagina) }])
  })

  it('páginas separadas continuam separadas e em ordem', () => {
    const trechos = [
      { pagina: 2, ordem: 1, texto: 'segunda' },
      { pagina: 1, ordem: 0, texto: 'primeira' },
    ]
    expect(juntarTrechos(trechos)).toEqual([
      { pagina: 1, texto: 'primeira' },
      { pagina: 2, texto: 'segunda' },
    ])
  })
})

describe('camposPorRegra', () => {
  const paginas = [
    { pagina: 1, texto: 'TERMO DE CONTRATO Nº 45/SMIT/2023\nCLÁUSULA PRIMEIRA – DO OBJETO\n1.1 O objeto é a prestação de serviços de sustentação de sistemas.' },
    {
      pagina: 2,
      texto:
        'CLÁUSULA SEGUNDA – DO VALOR\nO valor total do contrato é de R$ 4.874.940,85 (quatro milhões...).\n' +
        'CLÁUSULA TERCEIRA – DO REAJUSTE\nOs preços serão reajustados após 12 (doze) meses pelo IPC-FIPE.\n' +
        'CLÁUSULA QUARTA – DA GARANTIA\nA contratada prestará garantia na modalidade caução de 5% do valor.\n' +
        'CLÁUSULA QUINTA – DO PAGAMENTO\nO pagamento será efetuado em até 30 (trinta) dias da apresentação da nota fiscal.',
    },
  ]

  it('acha índice, garantia e prazo de pagamento com página e trecho', () => {
    const c = camposPorRegra(paginas, 'CONTRATO')
    expect(c.reajusteIndice).toMatchObject({ valor: 'IPC-FIPE', pagina: 2, fonte: 'regra' })
    expect(c.reajusteIndice!.trecho).toContain('IPC-FIPE')
    expect(c.garantia).toMatchObject({ valor: 'caução, 5%', pagina: 2 })
    expect(c.prazoPagamento).toMatchObject({ valor: '30 dias', pagina: 2 })
    expect(c.valorTotal).toMatchObject({ valor: 'R$ 4.874.940,85', pagina: 2 })
    expect(c.valorTotal!.trecho).toContain('4.874.940,85')
  })

  it('IPCA-E antes de IPCA; IGP-M, ICTI', () => {
    const indice = (t: string) => camposPorRegra([{ pagina: 1, texto: t }], 'CONTRATO').reajusteIndice?.valor
    expect(indice('reajuste anual pelo IPCA-E acumulado')).toBe('IPCA-E')
    expect(indice('reajuste anual pelo IPCA acumulado')).toBe('IPCA')
    expect(indice('reajustado pelo IGP-M da FGV')).toBe('IGP-M')
    expect(indice('Índice de Custo da Tecnologia da Informação – ICTI')).toBe('ICTI')
    expect(indice('reajustado pelo IPC/FIPE')).toBe('IPC-FIPE')
    // Como está nas propostas da PRODAM: o nome por extenso entre a sigla e a FIPE.
    expect(indice('pelo IPC – Índice de Preços ao Consumidor, apurado pela FIPE, nos termos da Portaria')).toBe('IPC-FIPE')
  })

  it('texto sem nada: nenhum campo', () => {
    expect(camposPorRegra([{ pagina: 1, texto: 'Página em branco com texto qualquer.' }], 'CONTRATO')).toEqual({})
  })
})

describe('verificarCampo', () => {
  const paginas = [
    { pagina: 1, texto: 'Objeto: sustentação.' },
    { pagina: 2, texto: 'O valor total   do contrato é de R$ 1.200,00 por mês.' },
  ]

  it('trecho literal na página citada e números do valor dentro do trecho', () => {
    expect(verificarCampo({ valor: 'R$ 1.200,00', pagina: 2, trecho: 'valor total do contrato é de R$ 1.200,00', fonte: 'ia' }, paginas)).toBe(true)
  })

  it('trecho em outra página, número que não está no trecho ou IA sem trecho: descarta', () => {
    expect(verificarCampo({ valor: 'R$ 1.200,00', pagina: 1, trecho: 'R$ 1.200,00', fonte: 'ia' }, paginas)).toBe(false)
    expect(verificarCampo({ valor: 'R$ 1.300,00', pagina: 2, trecho: 'R$ 1.200,00', fonte: 'ia' }, paginas)).toBe(false)
    expect(verificarCampo({ valor: 'mensal', pagina: 2, trecho: null, fonte: 'ia' }, paginas)).toBe(false)
  })

  it('campo de regra sem trecho vale (a regra é determinística)', () => {
    expect(verificarCampo({ valor: '12 meses', pagina: null, trecho: null, fonte: 'regra' }, paginas)).toBe(true)
  })
})
