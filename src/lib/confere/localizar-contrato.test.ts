/** @jest-environment node */
import { localizarContrato, type ContratoParaBusca } from './localizar-contrato'

function contrato(id: string, sigla: string | null, numeroTermo: string | null, chaveSharepoint: string | null): ContratoParaBusca {
  return { id, clienteId: `cl-${sigla}`, clienteNome: `Cliente ${sigla}`, clienteSigla: sigla, numeroTermo, chaveSharepoint }
}

// Recorte do cadastro de desenvolvimento (25/09/2026): números que se repetem entre clientes.
const CADASTRO = [
  contrato('pgm-15', 'PGM', 'TC 015/PGM/2024', 'PGM|15 2024'),
  contrato('smit-15', 'SMIT', 'TC 15/SMIT/2024', 'SMIT|15 2024'),
  contrato('cgm-16', 'CGM', 'TC 16/CGM/2024', 'CGM|16 2024'),
  contrato('spurb-16', 'SPURBANISMO', 'TC 16/2024', 'SPURBANISMO|16 2024'),
  contrato('ftm-94', 'FTM', 'TC 094/FTMSP/2024', 'FTM|94 2024'),
  contrato('hspm-387', 'HSPM', 'TC 387/2024/HSPM', 'HSPM|387 2024'),
  contrato('sf-10', 'SF', 'TC 010/2024', 'SF|10 2024'),
  contrato('seme-31', 'SEME', '031/SEME/2017', null),
  contrato('smit-52', 'SMIT', 'TC 52/SMIT/2024', 'SMIT|52 2024'),
]

describe('localizarContrato', () => {
  it('chave exata, com zero à esquerda, sem confundir o mesmo número de outro cliente', () => {
    expect(localizarContrato({ base: 15, orgao: 'PGM', ano: '2024' }, CADASTRO)).toEqual({ tipo: 'encontrado', contrato: CADASTRO[0] })
    expect(localizarContrato({ base: 16, orgao: 'CGM', ano: '2024' }, CADASTRO)).toEqual({ tipo: 'encontrado', contrato: CADASTRO[2] })
  })

  it('sigla parecida: FTMSP na planilha, FTM no cadastro', () => {
    expect(localizarContrato({ base: 94, orgao: 'FTMSP', ano: '2024' }, CADASTRO)).toEqual({ tipo: 'encontrado', contrato: CADASTRO[4] })
  })

  it('sigla curta não casa por prefixo (SF não é SFM)', () => {
    expect(localizarContrato({ base: 10, orgao: 'SFM', ano: '2024' }, CADASTRO)).toEqual({
      tipo: 'nenhum',
      mesmoNumero: [CADASTRO[6]],
      doOrgao: [],
    })
  })

  it('sem órgão: um só com o número e o ano', () => {
    expect(localizarContrato({ base: 387, orgao: null, ano: '2024' }, CADASTRO)).toEqual({ tipo: 'encontrado', contrato: CADASTRO[5] })
  })

  it('sem órgão e mais de um: lista para escolher', () => {
    expect(localizarContrato({ base: 16, orgao: null, ano: '2024' }, CADASTRO)).toEqual({
      tipo: 'ambiguo',
      candidatos: [CADASTRO[2], CADASTRO[3]],
    })
  })

  it('contrato do legado, sem chave do SharePoint', () => {
    expect(localizarContrato({ base: 31, orgao: 'SEME', ano: '2017' }, CADASTRO)).toEqual({ tipo: 'encontrado', contrato: CADASTRO[7] })
  })

  it('chave repetida no cadastro: não escolhe sozinho', () => {
    const duplicado = contrato('smit-52-b', 'SMIT', 'TC 52/SMIT/2024', 'SMIT|52 2024')
    expect(localizarContrato({ base: 52, orgao: 'SMIT', ano: '2024' }, [...CADASTRO, duplicado])).toEqual({
      tipo: 'ambiguo',
      candidatos: [CADASTRO[8], duplicado],
    })
  })

  it('não achou: os contratos do órgão ficam como sugestão', () => {
    expect(localizarContrato({ base: 99, orgao: 'SMIT', ano: '2026' }, CADASTRO)).toEqual({
      tipo: 'nenhum',
      mesmoNumero: [],
      doOrgao: [CADASTRO[1], CADASTRO[8]],
    })
  })
})
