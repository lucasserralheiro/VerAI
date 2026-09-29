import { lerInformativo, precosNoPdf } from './pdf'

// Trechos copiados do PDF oficial "Tabela de Preços PRODAM-SP 2026 v3.0.pdf" e do informativo (29/09/2026).
const TRECHO =
  'A - SISTEMAS DE INFORMAÇÃO CÓDIGO DESCRIÇÃO UNIDADE PREÇO UNITÁRIO (R$) ' +
  '10.050.00065.00 ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1) HORA/HOMEM 269,00 ' +
  '10.050.00070.00 ANALISTA DE INFORMAÇÃO - ADICIONAL DE SOBREAVISO - 1/3 SOBRE/HORA HORA/HOMEM SOB DEMANDA ' +
  '12.055.00009.00 DISPONIBILIZAÇÃO DE PONTO DE ACESSO WIRELESS - PÚBLICO E CORPORATIVO (PARA CONTRATAÇÕES A PARTIR DE 10.000 AP/CLIENTE/MÊS) AP/MÊS 367,83 ' +
  '14.045.00023.00 VIRTUALIZAÇÃO DE DADOS FAIXA A - CPU TIME 1 A 120 MINUTOS E LOTE DE REGISTROS 1 A 34.000 LOTES PACOTE/MÊS 3.494,93 ' +
  '15.085.00011.00 PLATAFORMA - PDTI - PLANO G ASSINATURA/MÊS 30.063,91 OBSERVAÇÕES (1) UNIDADE DE SERVIÇOS EM NUVEM (USN) 42.696,00'

it('preço é o PRIMEIRO valor em R$ depois do código — nem número da descrição, nem o que vem nas observações', () => {
  const p = precosNoPdf(TRECHO)
  expect(p.get('10.050.00065.00')).toEqual({ preco: '269.00', sobDemanda: false })
  expect(p.get('10.050.00070.00')).toEqual({ preco: null, sobDemanda: true })
  expect(p.get('12.055.00009.00')).toEqual({ preco: '367.83', sobDemanda: false })
  expect(p.get('14.045.00023.00')).toEqual({ preco: '3494.93', sobDemanda: false })
  expect(p.get('15.085.00011.00')).toEqual({ preco: '30063.91', sobDemanda: false })
})

const INFORMATIVO =
  'Tabela de Preços dos Serviços PRODAM Última Versão publicada: 2026 v3.0 Publicação no Diário Oficial: 21/09/2026 ' +
  'Este informativo apresenta alterações ocorridas após a última versão publicada no Diário Oficial. ' +
  'ALTERAÇÃO DE PREÇOS — TID Produto com alteração de preço após a publicação da versão 2026 v3.0. ' +
  'NOVO PRODUTO — SPdf Novo produto incluído após a publicação da versão 2026 v3.0. ' +
  'RETORNO DE ITEM — ELEIÇÃO Item15.062.00008.00 - ELEIÇÃO – DISPONIBILIZAÇÃO DE INFRAESTRUTURA SISTEMA DE VOTAÇÃO Item retornado após exclusão indevida. ' +
  'Informativo Interno Considere a Tabela publicada em conjunto com este informativo até a próxima atualização no Diário Oficial.'

it('informativo: versão, data da publicação, o que mudou e códigos citados (mesmo colados em "Item")', () => {
  expect(lerInformativo(INFORMATIVO)).toEqual({
    versao: '2026 v3.0',
    publicadaEm: new Date(Date.UTC(2026, 8, 21)),
    alteracoes: [
      { tipo: 'preco', nome: 'TID' },
      { tipo: 'novo', nome: 'SPdf' },
      { tipo: 'retorno', nome: 'ELEIÇÃO' },
    ],
    codigos: ['15.062.00008.00'],
  })
})
