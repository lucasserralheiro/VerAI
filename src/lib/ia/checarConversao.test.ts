jest.mock('ai', () => ({ generateObject: jest.fn() }))
jest.mock('./modelo', () => ({ getModel: jest.fn().mockReturnValue('modelo-fake') }))

import { generateObject } from 'ai'
import { checarConversao, correcaoEhSegura, trocaConteudoSobRotuloAmbiguo } from './checarConversao'

describe('checarConversao', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sem página pra checar devolve score null e lista vazia, sem chamar a IA', async () => {
    const resultado = await checarConversao([], '')

    expect(resultado).toEqual({ scoreExibido: null, trechosSuspeitos: [] })
    expect(generateObject).not.toHaveBeenCalled()
  })

  it('agrega o score (média) e marca a página nos trechos suspeitos', async () => {
    // `documentoAtual` é o HTML do DOCUMENTO INTEIRO — aqui, a "junção"
    // do que cada página contribuiu. Página 1 bate 100% nele (texto
    // idêntico) -> pula a IA, cobertura 1. Página 2 não bate nada ("Valor:
    // R$ 1.000" não aparece em lugar nenhum de `documentoAtual`) -> chama a
    // IA (só ela consome o mock abaixo).
    const documentoAtual = '<p>Texto da página 1</p>\n\n<p>Valor: R$ 100</p>'
    ;(generateObject as jest.Mock).mockResolvedValueOnce({
      object: { scoreConfianca: 0.6, trechosSuspeitos: [{ trecho: '<p>Valor: R$ 100</p>', motivo: 'número pode ter trocado' }] },
    })

    const resultado = await checarConversao(
      [
        { pagina: 1, textoOriginal: 'Texto da página 1', html: '<p>Texto da página 1</p>' },
        { pagina: 2, textoOriginal: 'Valor: R$ 1.000', html: '<p>Valor: R$ 100</p>' },
      ],
      documentoAtual
    )

    // O score não vem de `scoreConfianca` (o `0.6` mockado acima é ignorado
    // de propósito — ver `calcularCoberturaPagina`). Página 1: cobertura 1.
    // Página 2: cobertura 0. Média (1 + 0) / 2 = 0.5 -> 50%.
    expect(generateObject).toHaveBeenCalledTimes(1)
    expect(resultado.scoreExibido).toBe(50)
    expect(resultado.trechosSuspeitos).toEqual([
      {
        pagina: 2,
        trecho: '<p>Valor: R$ 100</p>',
        motivo: 'número pode ter trocado',
        correcaoSugerida: null,
        trechoOriginal: 'Valor: R$ 1.000',
      },
    ])
  })

  it('nunca devolve 100%, mesmo quando toda página vem com score 1', async () => {
    ;(generateObject as jest.Mock).mockResolvedValue({ object: { scoreConfianca: 1, trechosSuspeitos: [] } })

    // 'x' é curto demais pra `calcularCoberturaPagina` julgar sozinho
    // (< TAMANHO_MIN_LINHA_COBERTURA) -> não penaliza -> cobertura 1,
    // pula a IA -> 99% (nunca 100%, teto aplicado no código).
    const resultado = await checarConversao([{ pagina: 1, textoOriginal: 'x', html: 'x' }], 'x')

    expect(resultado.scoreExibido).toBe(99)
  })

  it('uma página falhando (mesmo depois de tentar de novo) não derruba a checagem inteira', async () => {
    // As duas tentativas falham — ver teste de retentativa abaixo pra
    // cobrir o caso em que a segunda dá certo.
    ;(generateObject as jest.Mock).mockRejectedValue(new Error('modelo indisponível'))

    const textoOriginalFalha =
      'Cláusula que não aparece de jeito nenhum no documento final, texto longo o bastante pra não cair no filtro de linha curta.'
    const textoOriginalOk = 'Texto que bate certinho no documento final.'
    const documentoAtual = textoOriginalOk

    const resultado = await checarConversao(
      [
        { pagina: 1, textoOriginal: textoOriginalFalha, html: '' },
        { pagina: 2, textoOriginal: textoOriginalOk, html: '' },
      ],
      documentoAtual
    )

    // Página 1: cobertura baixa -> chama a IA, falha, tenta mais uma vez,
    // falha de novo -> desiste da página (não entra na média). Página 2:
    // bate 100% em `documentoAtual` -> pula a IA, cobertura 1 -> 99% (nunca
    // 100%, ver teste acima).
    expect(generateObject).toHaveBeenCalledTimes(2)
    expect(resultado.scoreExibido).toBe(99)
  })

  it('tenta a página de novo depois de uma falha, e usa o resultado se a segunda tentativa der certo', async () => {
    // Caso real que motivou isto: o modelo às vezes devolve o JSON com uma
    // chave errada (ex. "correcaoSugida" em vez de "correcaoSugerida"),
    // falhando a validação do schema — erro não-determinístico da própria
    // geração, que a segunda tentativa costuma resolver sozinha.
    ;(generateObject as jest.Mock)
      .mockRejectedValueOnce(new Error('chave errada no JSON'))
      .mockResolvedValueOnce({
        object: { scoreConfianca: 0.5, trechosSuspeitos: [{ trecho: 'achado na 2a tentativa', motivo: 'x', correcaoSugerida: null }] },
      })

    const resultado = await checarConversao(
      [{ pagina: 1, textoOriginal: 'texto original', html: '' }],
      'achado na 2a tentativa'
    )

    expect(generateObject).toHaveBeenCalledTimes(2)
    expect(resultado.trechosSuspeitos[0].trecho).toBe('achado na 2a tentativa')
  })

  it('todas as páginas falhando (mesmo depois de tentar de novo) lança erro', async () => {
    ;(generateObject as jest.Mock).mockRejectedValue(new Error('modelo indisponível'))

    const textoOriginal = 'Texto original desta página, que não aparece no documento final de jeito nenhum.'
    const documentoAtual = 'Documento completamente diferente, sem nenhuma relação com o texto original desta página.'

    await expect(checarConversao([{ pagina: 1, textoOriginal, html: '' }], documentoAtual)).rejects.toThrow(
      'não foi possível checar nenhuma página'
    )
  })

  it('mantém correcaoSugerida quando ela aparece no texto original da página', async () => {
    ;(generateObject as jest.Mock).mockResolvedValueOnce({
      object: {
        scoreConfianca: 0.6,
        trechosSuspeitos: [
          { trecho: '<p>Valor: R$ 100</p>', motivo: 'número trocado', correcaoSugerida: '<p>Valor: R$ 1.000</p>' },
        ],
      },
    })

    const resultado = await checarConversao(
      [{ pagina: 1, textoOriginal: 'O Valor: R$ 1.000 é o total.', html: '<p>Valor: R$ 100</p>' }],
      '<p>Valor: R$ 100</p>'
    )

    expect(resultado.trechosSuspeitos[0].correcaoSugerida).toBe('<p>Valor: R$ 1.000</p>')
  })

  it('descarta correcaoSugerida que não aparece no texto original (não confia só na IA)', async () => {
    ;(generateObject as jest.Mock).mockResolvedValueOnce({
      object: {
        scoreConfianca: 0.6,
        trechosSuspeitos: [
          { trecho: '<p>Valor: R$ 100</p>', motivo: 'número trocado', correcaoSugerida: '<p>Valor: R$ 999.999</p>' },
        ],
      },
    })

    const resultado = await checarConversao(
      [{ pagina: 1, textoOriginal: 'O Valor: R$ 1.000 é o total.', html: '<p>Valor: R$ 100</p>' }],
      '<p>Valor: R$ 100</p>'
    )

    expect(resultado.trechosSuspeitos[0].correcaoSugerida).toBeNull()
  })

  it('não conta a MESMA divergência duas vezes quando duas páginas citam o mesmo trecho repetido', async () => {
    // Cláusula padrão que se repete em duas páginas do PDF (comum em
    // contrato — texto de rodapé, seção boilerplate) e continua errada nas
    // duas: sem dedupe, isso conta como 2 diferenças em vez de 1. O texto
    // original de cada página carrega um detalhe extra que NÃO está em
    // `documentoAtual`, pra forçar a cobertura abaixo do limiar e garantir
    // que a IA é chamada (em vez de pulada por bater 100%).
    const textoOriginal =
      'Cláusula padrão desatualizada. Detalhe que não bate no documento final de jeito nenhum, grande o bastante pra não cair no filtro de linha curta.'
    const documentoAtual = 'Cláusula padrão desatualizada'

    ;(generateObject as jest.Mock)
      .mockResolvedValueOnce({
        object: {
          scoreConfianca: 1,
          trechosSuspeitos: [{ trecho: 'Cláusula padrão desatualizada', motivo: 'texto não bate', correcaoSugerida: null }],
        },
      })
      .mockResolvedValueOnce({
        object: {
          scoreConfianca: 1,
          trechosSuspeitos: [{ trecho: 'Cláusula padrão desatualizada', motivo: 'texto não bate (de novo)', correcaoSugerida: null }],
        },
      })

    const resultado = await checarConversao(
      [
        { pagina: 1, textoOriginal, html: '' },
        { pagina: 8, textoOriginal, html: '' },
      ],
      documentoAtual
    )

    expect(resultado.trechosSuspeitos).toHaveLength(1)
    expect(resultado.trechosSuspeitos[0].pagina).toBe(1) // mantém a primeira ocorrência
  })

  it('pede um orçamento de tokens maior que o antigo (página com tabela grande estourava e vinha cortada no meio)', async () => {
    // Caso real: página com tabela de preços grande gerava tantos
    // `trechosSuspeitos` que a resposta batia o teto antigo (4000) e vinha
    // cortada no meio de uma string -> JSON inválido -> página descartada.
    ;(generateObject as jest.Mock).mockResolvedValueOnce({ object: { scoreConfianca: 0.5, trechosSuspeitos: [] } })

    await checarConversao([{ pagina: 1, textoOriginal: 'texto original', html: '' }], 'outro documento')

    const opcoes = (generateObject as jest.Mock).mock.calls[0][0]
    expect(opcoes.maxOutputTokens).toBeGreaterThan(4000)
  })

  it('manda o documento (repetido em toda página) ANTES do trecho único da página — prefixo igual entre chamadas habilita cache do provedor', async () => {
    // Custo real medido em produção: uma checagem de 45 páginas disparou 18
    // chamadas, cada uma reenviando o documento inteiro (~38 mil tokens) —
    // ~700 mil tokens de entrada num clique só. O provedor (DeepSeek, como a
    // maioria) cacheia por PREFIXO: só ajuda se o início do prompt for
    // idêntico entre chamadas. A parte que se repete em toda página da MESMA
    // checagem é a instrução + o documento inteiro (`markdownAlvo` é o mesmo
    // para todas); o que muda por página é só o texto original dela — por
    // isso ele tem que vir por ÚLTIMO, não no meio do prefixo compartilhado.
    ;(generateObject as jest.Mock)
      .mockResolvedValueOnce({ object: { scoreConfianca: 0.5, trechosSuspeitos: [] } })
      .mockResolvedValueOnce({ object: { scoreConfianca: 0.5, trechosSuspeitos: [] } })

    await checarConversao(
      [
        { pagina: 1, textoOriginal: 'texto da pagina 1, nao bate no documento', html: '' },
        { pagina: 2, textoOriginal: 'texto da pagina 2, tambem nao bate', html: '' },
      ],
      'DOCUMENTO_COMPARTILHADO_GRANDE'
    )

    const chamadas = (generateObject as jest.Mock).mock.calls
    expect(chamadas).toHaveLength(2)
    const prompt1 = chamadas[0][0].prompt as string
    const prompt2 = chamadas[1][0].prompt as string

    // O prefixo compartilhado (tudo até o texto único da página) é IDÊNTICO
    // nas duas chamadas — é isso que o cache de prefixo do provedor precisa
    // pra funcionar.
    const indiceTexto1 = prompt1.indexOf('texto da pagina 1')
    const prefixo1 = prompt1.slice(0, indiceTexto1)
    const indiceTexto2 = prompt2.indexOf('texto da pagina 2')
    const prefixo2 = prompt2.slice(0, indiceTexto2)
    expect(indiceTexto1).toBeGreaterThan(-1)
    expect(prefixo1).toBe(prefixo2)

    // O documento grande faz parte desse prefixo compartilhado — vem antes
    // do texto único da página, não depois.
    expect(prefixo1).toContain('DOCUMENTO_COMPARTILHADO_GRANDE')
    expect(prompt1.indexOf('DOCUMENTO_COMPARTILHADO_GRANDE')).toBeLessThan(indiceTexto1)
  })

  it('loga quanto do prompt veio do cache do provedor — evidência real de que o reordenamento (teste acima) está ECONOMIZANDO, não só habilitando', async () => {
    // Sem isto não dá pra saber se o cache de prefixo do provedor está
    // batendo de verdade (o teste acima só garante que o prompt ESTÁ no
    // formato certo pra habilitar cache — não prova que o provedor está
    // usando). Precisa do número real pra confirmar o ganho de custo.
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    ;(generateObject as jest.Mock).mockResolvedValueOnce({
      object: { scoreConfianca: 0.5, trechosSuspeitos: [] },
      usage: { inputTokens: 40000, inputTokenDetails: { cacheReadTokens: 38000 }, outputTokens: 120 },
    })

    await checarConversao([{ pagina: 3, textoOriginal: 'texto original', html: '' }], 'outro documento')

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('checagem por IA'),
      expect.objectContaining({ pagina: 3, inputTokens: 40000, cacheReadTokens: 38000, outputTokens: 120 })
    )
    consoleLogSpy.mockRestore()
  })

  it('descarta correcaoSugerida nula sem quebrar', async () => {
    ;(generateObject as jest.Mock).mockResolvedValueOnce({
      object: {
        scoreConfianca: 0.5,
        // 'x' sozinho não passaria mais no guarda-rail de `trechoExisteNoAlvo`
        // (curto demais pra confiar que é um trecho real, não alucinado) —
        // trecho tem que existir de verdade no documento-alvo pra este teste
        // continuar testando o que se propõe (correcaoSugerida nula sobrevive).
        trechosSuspeitos: [{ trecho: 'texto ambíguo aqui', motivo: 'ambíguo', correcaoSugerida: null }],
      },
    })

    const resultado = await checarConversao([{ pagina: 1, textoOriginal: 'texto original', html: '' }], 'texto ambíguo aqui')

    expect(resultado.trechosSuspeitos[0].correcaoSugerida).toBeNull()
  })
})

describe('correcaoEhSegura', () => {
  it('aceita cópia exata', () => {
    expect(correcaoEhSegura('Valor: R$ 1.000', 'Texto: Valor: R$ 1.000 aqui')).toBe(true)
  })

  it('aceita ignorando acento/caixa/espaço extra', () => {
    expect(correcaoEhSegura('SD-WAN', 'onde diz sd-wan   no meio do texto')).toBe(true)
  })

  it('rejeita quando não aparece no texto original', () => {
    expect(correcaoEhSegura('Valor: R$ 999.999', 'Texto: Valor: R$ 1.000 aqui')).toBe(false)
  })

  it('rejeita null/vazio/curto demais', () => {
    expect(correcaoEhSegura(null, 'qualquer texto')).toBe(false)
    expect(correcaoEhSegura('', 'qualquer texto')).toBe(false)
    expect(correcaoEhSegura('a', 'a de qualquer coisa')).toBe(false)
  })

  // Caso real (proposta cmtxh3miu0000t4l80ahj2e1n): o trecho suspeito citava
  // duas linhas de título de seção só porque estavam vizinhas da linha de
  // código de serviço com o problema de verdade — a correção sugerida trazia
  // só a linha do código, sem os dois títulos. Aplicar automaticamente teria
  // apagado "<h2>C7. SD-WAN</h2>" e "<h2>C7.3. SERVIÇO...</h2>" do
  // documento; a auditoria seguinte acharia essas seções "sumidas" e
  // ofereceria correção pra reinserir — o botão "Corrigir automaticamente"
  // nunca parava de voltar.
  it('rejeita quando a correção apaga um título de seção que estava no trecho', () => {
    const trecho =
      '<h2>C7. SD-WAN</h2>\n\n<h2>C7.3. SERVIÇO DE COMUNICAÇÃO DE DADOS – SD-WAN (SOLUÇÃO: SERVIÇO E GESTÃO)</h2>\n\n<p>12.074.00005.00 - código</p>'
    const correcao = '12.074.00005.00 - código'
    const textoOriginal = 'Texto da página com 12.074.00005.00 - código no meio'

    expect(correcaoEhSegura(correcao, textoOriginal, trecho)).toBe(false)
  })

  it('aceita quando os títulos do trecho continuam (mod caixa/acento) na correção', () => {
    const trecho = '<h2>H - Produtos Customizados Por Orgão</h2>\n\n<p>resto do trecho</p>'
    const correcao = '<h2>H - Produtos Customizados Por Órgão</h2>\n\n<p>resto do trecho</p>'
    const textoOriginal = 'H - Produtos Customizados Por Órgão resto do trecho'

    expect(correcaoEhSegura(correcao, textoOriginal, trecho)).toBe(true)
  })

  it('sem trecho informado, continua só checando a ancoragem (compatibilidade)', () => {
    expect(correcaoEhSegura('Valor: R$ 1.000', 'Texto: Valor: R$ 1.000 aqui')).toBe(true)
  })

  it('título glued com parágrafo (bloco malformado da própria conversão) não trava a correção', () => {
    // Caso real, mesma proposta: "E5.5. CENTRAL DE SERVIÇOS" veio colado no
    // mesmo <h2> de um parágrafo inteiro (bug da conversão) — o trecho
    // reportado é essa tag longa demais pra ser um título de verdade, e a
    // correção separa o título curto do parágrafo. Isso é a correção
    // fazendo o trabalho certo, não apagando seção — não pode ser rejeitado.
    const trecho =
      '<h2>E5.5. CENTRAL DE SERVIÇOS Observabilidade é a capacidade de medir o estado atual de um sistema com base nos dados que ele gera, como logs, métricas e rastreamentos de requisições.</h2>'
    const correcao =
      '<h2>E5.5. CENTRAL DE SERVIÇOS</h2>\n\n<p>14.026.00003.00 - CENTRAL DE SERVIÇOS (LOTE DE 100 CHAMADOS)</p>'
    const textoOriginal = 'E5.5. CENTRAL DE SERVIÇOS\n14.026.00003.00 - CENTRAL DE SERVIÇOS (LOTE DE 100 CHAMADOS)'

    expect(correcaoEhSegura(correcao, textoOriginal, trecho)).toBe(true)
  })
})

describe('trocaConteudoSobRotuloAmbiguo', () => {
  // Caso real (mesma proposta): "Gestão de faturamento" aparece 4x no
  // documento — uma vez com o texto de escopo de internet/SD-WAN (correto
  // pra essa seção), três vezes com o texto padrão de faturamento (outras
  // seções). A checagem, comparando a página do texto padrão contra o
  // DOCUMENTO INTEIRO, bateu na ocorrência ERRADA (a de internet) e sugeriu
  // sobrescrevê-la com o texto padrão — apagando os itens de escopo de
  // internet que já estavam certos ali.
  const trechoInternet =
    '<p>Gestão de faturamento</p>\n\n' +
    '<ul><li>Fornecimento de Banda de Internet, exceto para os previstos por meio das funcionalidades de SD-WAN.</li>' +
    '<li>Disponibilização de Internet para publicação de sites e aplicações.</li></ul>'
  const correcaoPadraoFaturamento =
    '<p>Gestão de faturamento</p>\n\n' +
    '<ul><li>A PRODAM recebe e analisa as faturas de contratos dos fornecedores, verifica se as características dos equipamentos ou links informados, como capacidade, tempo disponível de acordo com seus registros de incidentes, estão corretas, antes de repassar ao cliente, e ajustes são feitos pelo fornecedor caso haja divergência.</li></ul>\n\n' +
    '<p>Não faz parte do escopo do Serviço</p>'
  const documento = [
    '<h2>Seção de Internet</h2>\n\n' + trechoInternet,
    '<h2>Seção de Link Dedicado</h2>\n\n<p>Gestão de faturamento</p>\n\n' +
      '<ul><li>A PRODAM recebe e analisa as faturas de contratos dos fornecedores.</li></ul>\n\n<p>Não faz parte do escopo do Serviço</p>',
    '<h2>Seção de SD-WAN</h2>\n\n<p>Gestão de faturamento</p>\n\n' +
      '<ul><li>A PRODAM recebe e analisa as faturas de contratos dos fornecedores.</li></ul>\n\n<p>Não faz parte do escopo do Serviço</p>',
  ].join('\n\n')

  it('rejeita quando o rótulo se repete no documento e a correção joga fora quase todo o conteúdo original', () => {
    expect(trocaConteudoSobRotuloAmbiguo(trechoInternet, correcaoPadraoFaturamento, documento)).toBe(true)
  })

  it('aceita reformatação (bullet, espaçamento) sob o mesmo rótulo repetido, sem perder o conteúdo', () => {
    // Caso real: "Análise de Negócio" também se repete várias vezes no
    // documento (contrato com vários lotes de serviço parecidos) — mas essa
    // correção só reformata (tag de lista, espaçamento), mantendo o mesmo
    // conteúdo. Rótulo repetido sozinho não pode travar isso.
    const trecho =
      '<h2>Análise de Negócio</h2>\n\n' +
      '<ul><li>Métricas em tempo real para apoio a tomada de decisões estratégicas.</li>' +
      '<li>Resultado: Insights sobre o consumo de produtos ou serviços, receita e impacto financeiro de incidentes.</li></ul>\n\n' +
      '<h2>Gestão de Desempenho</h2>'
    const correcao =
      '<h2>Análise de Negócio</h2>\n\n' +
      '<p>Métricas em tempo real para apoio a tomada de decisões estratégicas.</p>\n\n' +
      '<p>Resultado: Insights sobre o consumo de produtos ou serviços, receita e impacto financeiro de incidentes.</p>\n\n' +
      '<h2>Gestão de Desempenho</h2>'
    const documentoComRepeticao = `${trecho}\n\n<hr>\n\n<h2>Análise de Negócio</h2>\n\n<p>Outra coisa completamente diferente aqui.</p>`

    expect(trocaConteudoSobRotuloAmbiguo(trecho, correcao, documentoComRepeticao)).toBe(false)
  })

  it('aceita quando o rótulo NÃO se repete no documento, mesmo com baixa preservação', () => {
    expect(trocaConteudoSobRotuloAmbiguo(trechoInternet, correcaoPadraoFaturamento, trechoInternet)).toBe(false)
  })

  it('trecho de um bloco só nunca vira "rótulo" — correção de bloco único continua liberada', () => {
    const trecho = '<p>Prazo de entrega: 30 dias</p>'
    const documentoComRepeticao = `${trecho}\n\n<p>Prazo de entrega: 30 dias (repetido em outra cláusula)</p>`

    expect(trocaConteudoSobRotuloAmbiguo(trecho, '<p>Prazo de entrega: 60 dias</p>', documentoComRepeticao)).toBe(false)
  })
})

describe('checarConversao — troca de conteúdo entre ocorrências do mesmo rótulo', () => {
  it('descarta a correção que sobrescreveria a seção certa com o texto de outra seção', async () => {
    const trechoInternet =
      '<p>Gestão de faturamento</p>\n\n' +
      '<ul><li>Fornecimento de Banda de Internet, exceto para os previstos por meio das funcionalidades de SD-WAN.</li>' +
      '<li>Disponibilização de Internet para publicação de sites e aplicações.</li></ul>'
    const correcaoPadraoFaturamento =
      '<p>Gestão de faturamento</p>\n\n' +
      '<ul><li>A PRODAM recebe e analisa as faturas de contratos dos fornecedores, verifica se as características dos equipamentos ou links informados, como capacidade, tempo disponível de acordo com seus registros de incidentes, estão corretas, antes de repassar ao cliente, e ajustes são feitos pelo fornecedor caso haja divergência.</li></ul>\n\n' +
      '<p>Não faz parte do escopo do Serviço</p>'
    const textoOriginalPagina =
      'Gestão de faturamento\n• A PRODAM recebe e analisa as faturas de contratos dos fornecedores, verifica se as características dos equipamentos ou links informados, como capacidade, tempo disponível de acordo com seus registros de incidentes, estão corretas, antes de repassar ao cliente, e ajustes são feitos pelo fornecedor caso haja divergência.\nNão faz parte do escopo do Serviço'
    const documentoFinal = [
      '<h2>Seção de Internet</h2>\n\n' + trechoInternet,
      '<h2>Seção de Link Dedicado</h2>\n\n<p>Gestão de faturamento</p>\n\n' +
        '<ul><li>A PRODAM recebe e analisa as faturas de contratos dos fornecedores.</li></ul>\n\n<p>Não faz parte do escopo do Serviço</p>',
    ].join('\n\n')

    ;(generateObject as jest.Mock).mockResolvedValueOnce({
      object: {
        scoreConfianca: 0.7,
        trechosSuspeitos: [{ trecho: trechoInternet, motivo: 'texto de faturamento não bate', correcaoSugerida: correcaoPadraoFaturamento }],
      },
    })

    const resultado = await checarConversao([{ pagina: 5, textoOriginal: textoOriginalPagina, html: '' }], documentoFinal)

    expect(resultado.trechosSuspeitos[0].correcaoSugerida).toBeNull()
    expect(resultado.trechosSuspeitos[0].correcaoDescartada).toBe(true)
  })
})

describe('checarConversao — pula a IA quando a página já bate quase 100% no documento inteiro', () => {
  // Isolado do resto do arquivo: sem isto, `not.toHaveBeenCalled()` abaixo
  // veria as chamadas acumuladas dos describes anteriores (o mock não é
  // limpo entre describes-irmãos, só dentro do `beforeEach` de cada um).
  beforeEach(() => jest.clearAllMocks())

  it('não chama a IA pra uma página cujo texto original já está inteiro no documento atual', async () => {
    const textoOriginal = 'Cláusula 12. O prazo de vigência é de 24 (vinte e quatro) meses, contado da assinatura.'
    // Documento atual contém a página igualzinha, só com outro conteúdo ao
    // redor (o resto do documento, sem relação com esta página).
    const documentoAtual = `Introdução qualquer.\n\n${textoOriginal}\n\nOutra cláusula qualquer.`

    const resultado = await checarConversao([{ pagina: 3, textoOriginal, html: '' }], documentoAtual)

    expect(generateObject).not.toHaveBeenCalled()
    expect(resultado.trechosSuspeitos).toEqual([])
    expect(resultado.scoreExibido).toBe(99) // cobertura 1, teto de 99 continua valendo
  })

  it('chama a IA normalmente quando a página NÃO bate quase 100% com o documento atual', async () => {
    ;(generateObject as jest.Mock).mockResolvedValueOnce({
      object: { scoreConfianca: 0.5, trechosSuspeitos: [] },
    })

    const resultado = await checarConversao(
      [{ pagina: 3, textoOriginal: 'Texto que sumiu do documento final inteiramente, nada bate aqui.', html: '' }],
      'Documento final sem relação nenhuma com o texto original desta página.'
    )

    expect(generateObject).toHaveBeenCalledTimes(1)
    expect(resultado.trechosSuspeitos).toEqual([])
  })
})
