import { compactar, cortarPorLinha, emLinha, MAX_CARACTERES_MODELO, tabela } from './compacto'

describe('compactar', () => {
  it('objeto vira linhas chave: valor, sem vazios, sem href, true vira sim', () => {
    expect(compactar({ nome: 'SMIT', sigla: null, endereco: '', ativo: true, rescindido: false, fim: '—', obs: undefined, tags: [], href: '/x' })).toBe(
      'nome: SMIT\nativo: sim'
    )
  })

  it('lista de objetos vira tabela com cabeçalho uma vez; coluna sem valor some; célula vazia fica vazia', () => {
    const texto = compactar({
      total: 3,
      contratos: [
        { numero: 'TC 1/2023', id: 'k1', saldo: 'R$ 1,00', obs: null, href: '/a' },
        { numero: 'TC 2/2023', id: 'k2', saldo: null, obs: null, href: '/b' },
      ],
    })
    expect(texto).toBe('contratos (total 3, mostrando 2):\nnumero|id|saldo\nTC 1/2023|k1|R$ 1,00\nTC 2/2023|k2|')
  })

  it('"|" e quebra de linha dentro do valor não quebram a tabela', () => {
    expect(tabela('itens', [{ d: 'a | b\nc' }])).toBe('itens (total 1, mostrando 1):\nd\na / b c')
  })

  it('objeto e lista dentro da célula ficam numa linha', () => {
    expect(emLinha({ data: '01/01/2026', posicao: 'SMIT', vazio: null })).toBe('data 01/01/2026 · posicao SMIT')
    expect(emLinha([{ numero: '1', valor: 'R$ 2' }, { numero: '3' }])).toBe('numero 1 · valor R$ 2; numero 3')
  })

  it('total só vira cabeçalho quando há uma lista só; lista vazia some e o total fica', () => {
    expect(compactar({ total: 0, clientes: [] })).toBe('total: 0')
  })

  it('texto e número soltos', () => {
    expect(compactar('ok')).toBe('ok')
    expect(compactar({ dias: 0 })).toBe('dias: 0')
  })
})

describe('cortarPorLinha', () => {
  it('abaixo do teto não mexe', () => {
    const texto = 'a\n'.repeat(100)
    expect(cortarPorLinha(texto)).toBe(texto)
  })

  it('acima do teto corta em linha inteira e avisa quantas ficaram', () => {
    const linhas = Array.from({ length: 1000 }, (_, i) => `linha ${String(i).padStart(4, '0')}|${'x'.repeat(20)}`)
    const cortado = cortarPorLinha(linhas.join('\n'))
    expect(cortado.length).toBeLessThanOrEqual(MAX_CARACTERES_MODELO)
    const partes = cortado.split('\n')
    expect(linhas).toContain(partes.at(-2))
    expect(partes.at(-1)).toMatch(/^… mostrando \d+ de 1000 linhas\. Para ver o resto, use filtro ou limite menor\.$/)
  })

  it('uma linha só maior que o teto é cortada no tamanho', () => {
    expect(cortarPorLinha('x'.repeat(20_000)).length).toBeLessThanOrEqual(MAX_CARACTERES_MODELO)
  })
})
