import { repararTextosDoPdf, geradorConhecidoPorQuebrarTexto } from './repararTextoPdf'

/** Atalho: uma página, um trecho. */
const reparar = (...trechos: string[]) => repararTextosDoPdf([trechos])

describe('repararTextosDoPdf', () => {
  describe('glifo impossível em português', () => {
    it('troca pela forma que já aparece escrita no próprio documento', () => {
      const r = reparar('Apoio técnico na gestão de usuários e atribuição de licenciamento;', 'e atribuiçäo de licenciamento;')

      expect(r.textosPorPagina[0][1]).toBe('e atribuição de licenciamento;')
      expect(r.correcoes).toEqual([
        expect.objectContaining({ antes: 'atribuiçäo', depois: 'atribuição', regra: 'glifo-impossivel', pagina: 1 }),
      ])
    })

    it('resolve pela família do acento quando a palavra certa não existe em lugar nenhum do documento', () => {
      // "ş" (s com cedilha) não existe em português e a única letra com cedilha
      // que existe é "ç" — não precisa de vocabulário pra decidir.
      const r = reparar('Controles e medişões das licenşas disponibilizadas;')

      expect(r.textosPorPagina[0][0]).toBe('Controles e medições das licenças disponibilizadas;')
      expect(r.correcoes.map((c) => `${c.antes}->${c.depois}`)).toEqual(['medişões->medições', 'licenşas->licenças'])
    })

    it('reporta sem trocar o glifo que não sabe ler', () => {
      const r = reparar('valor em ¥ешь conforme')

      expect(r.textosPorPagina[0][0]).toBe('valor em ¥ешь conforme')
      expect(r.correcoes).toEqual([])
      expect(r.alertas).toEqual([expect.objectContaining({ motivo: 'glifo-desconhecido', pagina: 1 })])
    })
  })

  describe('padrão impossível em português', () => {
    it('corrige "çáo" mesmo o "á" sendo letra válida', () => {
      const r = reparar('As demandas relativas à execuçáo dos serviços')

      expect(r.textosPorPagina[0][0]).toBe('As demandas relativas à execução dos serviços')
      expect(r.correcoes[0]).toEqual(expect.objectContaining({ regra: 'padrao-impossivel', depois: 'execução' }))
    })

    it('corrige "çóes" no plural', () => {
      expect(reparar('as informaçóes prestadas').textosPorPagina[0][0]).toBe('as informações prestadas')
    })
  })

  describe('auto-consistência do documento', () => {
    it('corrige I/l quando a forma certa se repete no documento', () => {
      const r = reparar(
        'classificado como Middleware, e o respectivo Gerenciamento de Middleware',
        'Gerenciamento de Tecnologias em Camada Intermediária (MiddIeware)(GTCI)'
      )

      expect(r.textosPorPagina[0][1]).toContain('(Middleware)(GTCI)')
      expect(r.correcoes[0]).toEqual(expect.objectContaining({ regra: 'auto-consistencia', depois: 'Middleware' }))
    })

    it('não troca quando a forma candidata aparece uma vez só — uma ocorrência é outra palavra, não padrão', () => {
      const r = reparar('o produto Middleware', 'o produto MiddIeware')

      expect(r.textosPorPagina[0][1]).toBe('o produto MiddIeware')
      expect(r.correcoes).toEqual([])
    })

    it('não inventa troca de I/l em posição onde as letras não se confundem', () => {
      // "I" no começo da palavra é I mesmo — a confusão só é invisível depois
      // de minúscula (ou "l" depois de MAIÚSCULA).
      const r = reparar('lmposto lmposto lmposto', 'Imposto')

      expect(r.textosPorPagina[0][0]).toBe('lmposto lmposto lmposto')
    })
  })

  describe('trava de número — a mais importante numa proposta comercial', () => {
    it('não encosta em token com dígito, mesmo com glifo impossível dentro', () => {
      const r = reparar('total de R$ 17.2ş3,43 no mês')

      expect(r.textosPorPagina[0][0]).toBe('total de R$ 17.2ş3,43 no mês')
      expect(r.correcoes).toEqual([])
      // O token do alerta é o pedaço numérico onde o glifo caiu ("2ş3"), não o
      // número inteiro: `REGEX_TOKEN` quebra "17.2ş3,43" na pontuação.
      expect(r.alertas).toEqual([expect.objectContaining({ motivo: 'glifo-em-numero', token: '2ş3' })])
    })

    it('preserva valores, códigos de serviço e datas intactos', () => {
      const original = 'CÓD 14.071.00006.00 — BRL 334,9700 x 50,00 x 12 = BRL 200.982,00 em 1º/09/2026'

      expect(reparar(original).textosPorPagina[0][0]).toBe(original)
    })
  })

  describe('PDF são', () => {
    it('devolve o texto byte a byte igual, sem correção nenhuma', () => {
      const paginas = [
        [
          'A CONTRATADA prestará serviços de manutenção e gestão de licenças, com medições mensais.',
          'Configuração, atribuição de licenciamento e atualizações fazem parte da execução do objeto.',
        ],
        ['Fornecedores: Müller & Cia, José Muñoz, Ana D’Ávila. Valor: R$ 207.161,16.'],
      ]

      const r = repararTextosDoPdf(paginas)

      expect(r.textosPorPagina).toEqual(paginas)
      expect(r.correcoes).toEqual([])
      expect(r.alertas).toEqual([])
    })
  })

  it('numera a página a partir de 1, como o resto do pipeline', () => {
    const r = repararTextosDoPdf([['tudo certo aqui'], ['as licenşas contratadas']])

    expect(r.correcoes).toEqual([expect.objectContaining({ pagina: 2, antes: 'licenşas' })])
  })
})

describe('geradorConhecidoPorQuebrarTexto', () => {
  it('reconhece o Microsoft Print to PDF, que foi o que motivou este módulo', () => {
    expect(geradorConhecidoPorQuebrarTexto('Microsoft: Print To PDF', 'Microsoft Word')).toBe(true)
  })

  it('não acusa o Word exportando direto em PDF (esse escreve o ToUnicode certo)', () => {
    expect(geradorConhecidoPorQuebrarTexto('Microsoft® Word para Microsoft 365', 'Microsoft® Word')).toBe(false)
  })

  it('não quebra sem metadado nenhum', () => {
    expect(geradorConhecidoPorQuebrarTexto(null, undefined)).toBe(false)
  })
})
