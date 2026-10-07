import { medirConversao } from './metricas'
import { compararRodadas, pontuacao, resumirPorGerador, type MedidaArquivo } from './comparar'

const metricasLimpas = medirConversao({
  html: '<p>Texto</p>',
  paginasImagem: [],
  paginasConvertidas: [{ pagina: 1, textoOriginal: 'Texto', html: '<p>Texto</p>' }],
  correcoesDeTexto: [],
  alertasDeTexto: [],
  camadaDeTextoSuspeita: false,
  paginasComImagem: [],
})

function medida(sha256: string, mudar: Partial<MedidaArquivo['metricas'] & object> = {}, extra: Partial<MedidaArquivo> = {}): MedidaArquivo {
  return {
    sha256,
    caminho: `/x/${sha256}.pdf`,
    nome: `${sha256}.pdf`,
    gerador: 'Word',
    milissegundos: 10,
    falha: null,
    metricas: { ...metricasLimpas, ...mudar },
    htmlSha256: 'h',
    ...extra,
  }
}

describe('compararRodadas', () => {
  it('classifica cada arquivo pelo que mudou', () => {
    const base = [
      medida('piora'),
      medida('melhora', { linhasIrregulares: 3 }),
      medida('misto', { codigosGrudados: 2 }),
      medida('html'),
      medida('igual'),
    ]
    const agora = [
      medida('piora', { numerosPerdidos: 1 }),
      medida('melhora', { linhasIrregulares: 0 }),
      medida('misto', { codigosGrudados: 0, valoresSoltos: 1 }),
      medida('html', {}, { htmlSha256: 'outro' }),
      medida('igual'),
    ]
    const r = compararRodadas(base, agora)
    expect(Object.fromEntries(r.arquivos.map((a) => [a.nome, a.situacao]))).toEqual({
      'piora.pdf': 'piorou',
      'melhora.pdf': 'melhorou',
      'misto.pdf': 'misto',
      'html.pdf': 'só o HTML mudou',
      'igual.pdf': 'igual',
    })
    expect(r.arquivos[0].mudancas).toEqual([{ rotulo: 'números perdidos', antes: 0, agora: 1, melhor: false }])
    expect(r.totais.find((t) => t.rotulo === 'linhas irregulares')).toMatchObject({ antes: 3, agora: 0 })
  })

  it('acerto que diminui é piora', () => {
    const r = compararRodadas([medida('a', { linhasAritmeticaOk: 5 })], [medida('a', { linhasAritmeticaOk: 4 })])
    expect(r.arquivos[0].situacao).toBe('piorou')
  })

  it('passar a falhar é piora; deixar de falhar é melhora', () => {
    const falhou = { falha: 'passou de 120 s', metricas: null, htmlSha256: null }
    const r = compararRodadas([medida('a'), medida('b', {}, falhou)], [medida('a', {}, falhou), medida('b')])
    expect(r.arquivos.map((a) => a.situacao)).toEqual(['piorou', 'melhorou'])
    expect(r.falhasAntes).toBe(1)
    expect(r.falhasAgora).toBe(1)
  })

  it('pareia pelo conteúdo; o que não tem par só é contado', () => {
    const r = compararRodadas([medida('a'), medida('b')], [medida('a')])
    expect(r.arquivos).toHaveLength(1)
    expect(r.semPar).toBe(1)
  })
})

describe('pontuação e resumo', () => {
  it('número perdido pesa mais que palavra fora de ordem; falha pesa mais que tudo', () => {
    expect(pontuacao(medida('a', { numerosPerdidos: 1 }))).toBeGreaterThan(pontuacao(medida('b', { palavrasForaDeOrdem: 20 })))
    expect(pontuacao(medida('c', {}, { falha: 'x', metricas: null }))).toBeGreaterThan(pontuacao(medida('d', { numerosPerdidos: 50 })))
  })

  it('gerador com mais problema vem primeiro', () => {
    const resumo = resumirPorGerador([
      medida('a', {}, { gerador: 'Limpo' }),
      medida('b', { precoNaoReconhecido: 2 }, { gerador: 'Print To PDF' }),
    ])
    expect(resumo.map((g) => g.gerador)).toEqual(['Print To PDF', 'Limpo'])
    expect(resumo[0].totais['preço não reconhecido']).toBe(2)
  })
})
