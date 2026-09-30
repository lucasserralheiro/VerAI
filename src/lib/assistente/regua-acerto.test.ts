import { avaliarCaso } from './regua-acerto'

const obs = (o: Partial<Parameters<typeof avaliarCaso>[2]>) => ({ texto: '', ferramentas: [], direta: false, naoConfirmados: [], ...o })

it('verai: exige a ferramenta, a chave no texto e zero ⚠', () => {
  const caso = { tipo: 'verai' as const, ferramenta: 'calendarioFaturamento' }
  expect(avaliarCaso(caso, '05/10/2026', obs({ texto: 'Fecha em 05/10/2026.', ferramentas: ['calendarioFaturamento'] }))).toEqual({ ok: true, motivos: [] })
  const r = avaliarCaso(caso, '05/10/2026', obs({ texto: 'Fecha em 06/10/2026.', ferramentas: ['alertas'], naoConfirmados: ['06/10/2026'] }))
  expect(r.ok).toBe(false)
  expect(r.motivos).toEqual(['não chamou calendarioFaturamento', 'chave 05/10/2026 ausente', '1 número não confirmado'])
})

it('recusa, geral, sem-dado e direta', () => {
  expect(avaliarCaso({ tipo: 'recusa' }, null, obs({ texto: 'Isso está fora do que o assistente do VerAI atende. Pergunte…' })).ok).toBe(true)
  expect(avaliarCaso({ tipo: 'recusa' }, null, obs({ texto: 'O Corinthians ganhou.' })).ok).toBe(false)
  expect(avaliarCaso({ tipo: 'geral' }, null, obs({ texto: ':::geral\nApostilamento é…\n:::' })).ok).toBe(true)
  expect(avaliarCaso({ tipo: 'geral' }, null, obs({ texto: 'Apostilamento é…' })).motivos).toEqual(['sem bloco :::geral'])
  expect(avaliarCaso({ tipo: 'sem-dado' }, null, obs({ texto: 'Não encontrei no VerAI.' })).ok).toBe(true)
  expect(avaliarCaso({ tipo: 'sem-dado' }, null, obs({ texto: 'O valor é R$ 10,00', naoConfirmados: ['R$ 10,00'] })).ok).toBe(false)
  expect(avaliarCaso({ tipo: 'direta' }, 'SMS', obs({ texto: '**SMS – Saúde**', direta: true })).ok).toBe(true)
  expect(avaliarCaso({ tipo: 'direta' }, 'SMS', obs({ texto: 'SMS', direta: false })).motivos).toEqual(['não foi resposta direta'])
})
