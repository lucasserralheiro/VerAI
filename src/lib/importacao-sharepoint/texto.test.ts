import { extrairCampos, lerData, lerValor, somarMeses } from './texto'

const contrato = `TERMO DE CONTRATO Nº 12/CGM/2023
PROCESSO SEI Nº 6067.2023/0017693-8
PROCESSO SEI PRODAM Nº 7010.2023/0007889-0
OBJETO: CONTRATAÇÃO DE SERVIÇOS DE SUSTENTAÇÃO E MELHORIAS DE TIC
CONTRATANTE: PREFEITURA DO MUNICÍPIO DE SÃO PAULO – CONTROLADORIA GERAL DO MUNICÍPIO
CONTRATADA: PRODAM-SP – S.A
VALOR DO CONTRATO: R$ 4.874.940,85 (quatro milhões...)
Contrato nº 12 /CGM/2023 (091422354) SEI 6067.2023/0017693-8 / pg. 6
CLÁUSULA V – DA VIGÊNCIA 5.1. A vigência inicial do presente instrumento é de 12 (doze) meses a parLr de 15 de outubro de 2023, data em que
Em 10/10/2023, às 14:01.
Em 11/10/2023, às 14:45.`

describe('extrairCampos', () => {
  it('contrato inicial do SEI', () => {
    const k = extrairCampos(contrato, 'CONTRATO')
    expect(k).toMatchObject({
      numeroDocumento: '12/CGM/2023',
      seiCliente: '6067.2023/0017693-8',
      seiProdam: '7010.2023/0007889-0',
      valor: '4874940.85',
      meses: 12,
      semTexto: false,
    })
    expect(k.assinaturaEm?.toISOString().slice(0, 10)).toBe('2023-10-11')
    expect(k.inicio?.toISOString().slice(0, 10)).toBe('2023-10-15')
  })

  it('prorrogação com período explícito', () => {
    const k = extrairCampos(
      'Pelo presente instrumento fica prorrogado o prazo de vigência do contrato por mais 12 meses, a contar de 18/11/2023, com término previsto em 17/11/2024. Em 17/11/2023, às 16:53.',
      'PRORROGACAO'
    )
    expect(k.inicio?.toISOString().slice(0, 10)).toBe('2023-11-18')
    expect(k.fim?.toISOString().slice(0, 10)).toBe('2024-11-17')
    expect(k.meses).toBe(12)
    expect(k.prorrogaVigencia).toBe(true)
  })

  it('"contados da sua assinatura" não inventa data', () => {
    const k = extrairCampos('CLÁUSULA QUINTA – DA VIGÊNCIA 5.1. A vigência inicial do presente instrumento será de 12 (doze) meses, contados da sua assinatura.', 'CONTRATO')
    expect(k.inicio).toBeNull()
    expect(k.inicioNaAssinatura).toBe(true)
  })

  it('PDF escaneado não devolve nada', () => {
    expect(extrairCampos('   \n  ', 'CONTRATO')).toMatchObject({ semTexto: true, valor: null, assinaturaEm: null })
  })
})

describe('auxiliares', () => {
  it('lerData', () => {
    expect(lerData('1º de fevereiro de 2023')?.toISOString().slice(0, 10)).toBe('2023-02-01')
    expect(lerData('31/02/2023')).toBeNull()
  })
  it('lerValor recusa o que não é dinheiro', () => {
    expect(lerValor('15.058,68')).toBe('15058.68')
    expect(lerValor('1.500')).toBeNull()
  })
  it('somarMeses fecha no dia anterior', () => {
    expect(somarMeses(new Date(Date.UTC(2023, 9, 15)), 12).toISOString().slice(0, 10)).toBe('2024-10-14')
  })
})
