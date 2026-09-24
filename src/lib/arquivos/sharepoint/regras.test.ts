import {
  categoriaSharepoint,
  clienteDoArquivo,
  motivoIgnorar,
  mudouPorMetadado,
  normalizarChave,
  resolverCliente,
  siglaDaPasta,
  siglaNoNome,
} from './regras'

const clientes = new Map([
  ['SGM', { id: 'c-sgm', nome: 'Secretaria de Governo' }],
  ['SMS', { id: 'c-sms', nome: 'Secretaria da Saúde' }],
])

describe('normalizarChave', () => {
  it('tira acento, caixa e espaço repetido', () => {
    expect(normalizarChave('  Sub-Itaím   Paulista ')).toBe('SUB-ITAIM PAULISTA')
  })
})

describe('resolverCliente', () => {
  it('casa a pasta direto com a sigla', () => {
    expect(resolverCliente('sms', clientes, {})).toEqual({ tipo: 'cliente', clienteId: 'c-sms', nome: 'Secretaria da Saúde' })
  })
  it('usa o mapa quando a pasta não é a sigla', () => {
    expect(resolverCliente('SGM - CASA CIVIL', clientes, { 'SGM - Casa Civil': 'SGM' })).toMatchObject({ clienteId: 'c-sgm' })
  })
  it('null no mapa ignora a pasta', () => {
    expect(resolverCliente('1. PUBLICAÇÕES NO DOC', clientes, { '1. PUBLICACOES NO DOC': null })).toEqual({ tipo: 'ignorar' })
  })
  it('nunca inventa cliente', () => {
    expect(resolverCliente('SPTURIS', clientes, {})).toEqual({ tipo: 'sem-cliente' })
  })
})

describe('siglaDaPasta', () => {
  it('pasta que é a sigla, pasta do mapa e pasta ignorada', () => {
    expect(siglaDaPasta('sms', {})).toBe('SMS')
    expect(siglaDaPasta('SUB-ITAM PAULISTA', { 'SUB-ITAM PAULISTA': 'SUB-ITP' })).toBe('SUB-ITP')
    expect(siglaDaPasta('1. PUBLICAÇÕES NO DOC', { '1. PUBLICACOES NO DOC': null })).toBeNull()
  })
})

describe('motivoIgnorar — entra tudo que é documento', () => {
  const pasta = ['SMSUB', 'TC 36-SMSUB-COGEL-2022 - GeoInfra', '1) TC 36 - Contrato Inicial']
  it('WORK, planilha, .html e extensão desconhecida entram', () => {
    expect(motivoIgnorar([...pasta, 'WORK', 'Mem_Calc.xlsx'], 10)).toBeNull()
    expect(motivoIgnorar([...pasta, 'PA-SMT-250806-092 v7.1.html'], 10)).toBeNull()
    expect(motivoIgnorar([...pasta, 'email.msg'], 10)).toBeNull()
  })
  it('fica fora só lixo técnico e o que não cabe', () => {
    expect(motivoIgnorar(['.849C9593-D756-4E56-8D6E-42412F2A707B'], 10)).toBe('arquivo solto na raiz')
    expect(motivoIgnorar([...pasta, '~$_(SMS_Sustentação)_230906-103 - v1.0.docx'], 10)).toBe('oculto ou temporário')
    expect(motivoIgnorar([...pasta, '.oculto'], 10)).toBe('oculto ou temporário')
    expect(motivoIgnorar([...pasta, 'desktop.ini'], 10)).toBe('arquivo de sistema')
    expect(motivoIgnorar([...pasta, 'Thumbs.db'], 10)).toBe('arquivo de sistema')
    expect(motivoIgnorar([...pasta, 'a.pdf'], 0)).toBe('arquivo vazio')
    expect(motivoIgnorar([...pasta, 'a.pdf'], 51 * 1024 * 1024)).toBe('acima de 50 MB')
  })
})

describe('siglaNoNome', () => {
  it.each([
    ['2026.09.17 - SIURB - Sust. de TIC - Despacho.pdf', 'SIURB'],
    ['-2026.09.18 - SMDHC - Com. Dados SD-WAN - Despacho.pdf', 'SMDHC'],
    ['2026.09.14 - SMSUB - Com. Dados SSD-WAN  - Despacho.pdf', 'SMSUB'],
    ['2026.09.17 - SUB-ST - LINC. - eXTRATO.pdf', 'SUB-ST'],
  ])('%s → %s', (nome, sigla) => expect(siglaNoNome(nome)).toBe(sigla))
  it('nome sem o padrão data - sigla - assunto', () => expect(siglaNoNome('despacho.pdf')).toBeNull())
})

describe('clienteDoArquivo', () => {
  const roteadas = ['1. PUBLICAÇÕES NO DOC']
  it('pasta de roteamento: cliente pela sigla no nome', () => {
    const r = clienteDoArquivo(['1. PUBLICAÇÕES NO DOC', '2026.09.17 - SMS - Arbitragem - Despacho.pdf'], clientes, {}, roteadas)
    expect(r).toEqual({ resolucao: { tipo: 'cliente', clienteId: 'c-sms', nome: 'Secretaria da Saúde' }, roteadoPeloNome: true, rotulo: '1. PUBLICAÇÕES NO DOC → SMS' })
  })
  it('sigla do nome que não é cliente não cria nada', () => {
    const r = clienteDoArquivo(['1. PUBLICAÇÕES NO DOC', '2026.09.17 - SUB-ST - LINC. - eXTRATO.pdf'], clientes, {}, roteadas)
    expect(r.resolucao).toEqual({ tipo: 'sem-cliente' })
    expect(r.rotulo).toBe('1. PUBLICAÇÕES NO DOC → SUB-ST')
  })
  it('pasta comum: cliente pela primeira pasta', () => {
    expect(clienteDoArquivo(['SMS', 'TC 1', 'a.pdf'], clientes, {}, roteadas)).toMatchObject({ roteadoPeloNome: false, rotulo: 'SMS' })
  })
})

describe('categoriaSharepoint', () => {
  it('pelo papel na pasta do termo', () => {
    expect(categoriaSharepoint('TC 1-2023.pdf', { papel: 'termo', inicial: true, publicacao: false })).toBe('TERMO_CONTRATO')
    expect(categoriaSharepoint('SF TA 02 ao TC 37-2019.pdf', { papel: 'termo', inicial: false, publicacao: false })).toBe('TERMO_ADITIVO')
    expect(categoriaSharepoint('Proposta PC-SF-220901-112.pdf', { papel: 'proposta', inicial: true, publicacao: false })).toBe('PROPOSTA_COMERCIAL')
    expect(categoriaSharepoint('PA-SF-220814-106 v3.0.pdf', { papel: 'proposta', inicial: false, publicacao: false })).toBe('PROPOSTA_ADITIVO')
  })
  it('publicação do DOC — pela pasta ou pelo nome', () => {
    expect(categoriaSharepoint('2026.09.17 - SMS - Arbitragem - Despacho.pdf', { papel: 'outro', inicial: false, publicacao: true })).toBe('PUBLICACAO_DOC')
    expect(categoriaSharepoint('DOC 2022-12-16 - SMSUB - Despacho.pdf', { papel: 'outro', inicial: true, publicacao: false })).toBe('PUBLICACAO_DOC')
  })
  it('demais: sugestão pelo nome; planilha sem padrão vira PLANILHA', () => {
    expect(categoriaSharepoint('SMSUB_Levantamento_TC 36.xlsx', { papel: 'outro', inicial: false, publicacao: false })).toBe('MEDICAO')
    expect(categoriaSharepoint('Mem_Calc. (SMSUB_Acesso à Rede) v1.2.xlsx', { papel: 'outro', inicial: false, publicacao: false })).toBe('PLANILHA')
    expect(categoriaSharepoint('ORDEM DE INÍCIO N° 002.pdf', { papel: 'outro', inicial: true, publicacao: false })).toBe('OUTRO')
  })
})

describe('mudouPorMetadado', () => {
  const base = { tamanhoBytes: 10, modificadoEm: new Date('2026-09-24T10:00:00Z') }
  it('tolera 2 s de diferença na data', () => {
    expect(mudouPorMetadado(base, { tamanhoBytes: 10, modificadoEm: new Date('2026-09-24T10:00:01Z') })).toBe(false)
    expect(mudouPorMetadado(base, { tamanhoBytes: 10, modificadoEm: new Date('2026-09-24T10:05:00Z') })).toBe(true)
    expect(mudouPorMetadado(base, { tamanhoBytes: 11, modificadoEm: base.modificadoEm })).toBe(true)
  })
})
