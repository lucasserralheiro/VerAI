import { avisoDeOrgao } from './aviso-de-orgao'
import type { ContratoParaBusca } from './localizar-contrato'

const SMT: ContratoParaBusca = {
  id: 'ct-smt',
  clienteId: 'cl-smt',
  clienteNome: 'Secretaria Municipal de Transporte',
  clienteSigla: 'SMT',
  numeroTermo: '17/SMT/2021',
  chaveSharepoint: 'SMT|17 2021',
}

describe('avisoDeOrgao', () => {
  it('órgão igual ao da chave do cadastro: sem aviso', () => {
    expect(avisoDeOrgao({ base: 17, orgao: 'SMT', ano: '2021' }, SMT)).toBeNull()
  })

  it('órgão igual à sigla do cliente quando o contrato não tem chave: sem aviso', () => {
    expect(avisoDeOrgao({ base: 17, orgao: 'SMT', ano: '2021' }, { ...SMT, chaveSharepoint: null })).toBeNull()
  })

  it('órgão citado no nº do termo: sem aviso, mesmo com outra sigla de cliente', () => {
    const contrato = { ...SMT, clienteSigla: 'OUTRA', chaveSharepoint: null, numeroTermo: '17/SMTUR/2021' }
    expect(avisoDeOrgao({ base: 17, orgao: 'SMTUR', ano: '2021' }, contrato)).toBeNull()
  })

  it('planilha SMTUR, contrato SMT (sigla só parecida): avisa, com os dois órgãos escritos', () => {
    const aviso = avisoDeOrgao({ base: 17, orgao: 'SMTUR', ano: '2021' }, SMT)
    expect(aviso).toContain('SMTUR')
    expect(aviso).toContain('SMT (Secretaria Municipal de Transporte)')
  })

  it('planilha sem órgão: avisa que o contrato saiu só do número e do ano', () => {
    const aviso = avisoDeOrgao({ base: 387, orgao: null, ano: '2024' }, SMT)
    expect(aviso).toContain('só pelo número e pelo ano (387/2024)')
  })
})
