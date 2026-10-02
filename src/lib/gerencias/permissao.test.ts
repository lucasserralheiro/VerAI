import { decidirEdicao, decidirMudancaNaEquipe, podeVerDetalheGerencia } from './permissao'

describe('decidirEdicao', () => {
  const base = { ehAdmin: false, membroDaGerenciaDoCliente: false, liberadoNoModeloAntigo: false }
  it('admin edita qualquer cliente', () => expect(decidirEdicao({ ...base, ehAdmin: true })).toBe(true))
  it('membro da gerência dona edita', () => expect(decidirEdicao({ ...base, membroDaGerenciaDoCliente: true })).toBe(true))
  it('quem não é da gerência não edita', () => expect(decidirEdicao(base)).toBe(false))
  it('na transição, liberado do jeito antigo ainda edita', () =>
    expect(decidirEdicao({ ...base, liberadoNoModeloAntigo: true })).toBe(true))
})

describe('podeVerDetalheGerencia', () => {
  it('admin vê qualquer uma', () => expect(podeVerDetalheGerencia(true, [], 'g1')).toBe(true))
  it('membro vê a sua', () => expect(podeVerDetalheGerencia(false, [{ gerenciaId: 'g1', papel: 'usuario' }], 'g1')).toBe(true))
  it('de fora não vê', () => expect(podeVerDetalheGerencia(false, [{ gerenciaId: 'g2', papel: 'manager' }], 'g1')).toBe(false))
})

describe('decidirMudancaNaEquipe', () => {
  const manager = [{ gerenciaId: 'g1', papel: 'manager' as const }]
  const s = (x: Partial<Parameters<typeof decidirMudancaNaEquipe>[0]>) =>
    decidirMudancaNaEquipe({ ehAdmin: false, vinculos: manager, gerenciaId: 'g1', papelAtual: null, papelNovo: 'usuario', ...x })

  it('admin faz qualquer mudança, inclusive nomear manager', () =>
    expect(s({ ehAdmin: true, vinculos: [], papelNovo: 'manager' })).toEqual({ ok: true }))
  it('manager põe usuário', () => expect(s({})).toEqual({ ok: true }))
  it('manager tira usuário', () => expect(s({ papelAtual: 'usuario', papelNovo: null })).toEqual({ ok: true }))
  it('manager não nomeia manager', () =>
    expect(s({ papelNovo: 'manager' })).toEqual({ ok: false, motivo: 'Só o administrador nomeia ou tira manager.' }))
  it('manager não tira manager', () =>
    expect(s({ papelAtual: 'manager', papelNovo: null })).toEqual({ ok: false, motivo: 'Só o administrador nomeia ou tira manager.' }))
  it('usuário da gerência não mexe na equipe', () =>
    expect(s({ vinculos: [{ gerenciaId: 'g1', papel: 'usuario' }] })).toEqual({
      ok: false,
      motivo: 'Só o manager desta gerência ou o administrador mexe na equipe.',
    }))
  it('manager de outra gerência não mexe', () =>
    expect(s({ gerenciaId: 'g2' }).ok).toBe(false))
})
