import { textoDaOrigem } from './texto-origem'

it('valor lido do termo, com as provas', () => {
  expect(textoDaOrigem('valor', 'TERMO+EXTENSO+PLANILHA+CONTROLE', { pagina: 2, planilhaLinha: 245, controleMes: '2026-08' })).toBe(
    'Preenchido automaticamente: lido do termo (pág. 2); confere com o valor por extenso, a planilha de contratos (linha 245) e o controle do faturamento de ago/2026'
  )
  expect(textoDaOrigem('valor', 'TERMO+CADEIA', { pagina: 1 })).toBe('Preenchido automaticamente: lido do termo (pág. 1); confere com o valor do termo anterior')
})

it('valor sem leitura do termo: planilha igual ao controle', () => {
  expect(textoDaOrigem('valor', 'PLANILHA+CONTROLE', { planilhaLinha: 12, controleMes: '2026-07' })).toBe(
    'Preenchido automaticamente: valor da planilha de contratos (linha 12); confere com o controle do faturamento de jul/2026'
  )
})

it('vigência', () => {
  expect(textoDaOrigem('vigencia', 'CONTROLE', { mes: '2026-08', arquivoId: 'a' })).toBe(
    'Preenchido automaticamente: vigência do controle do faturamento de ago/2026'
  )
  expect(textoDaOrigem('vigencia', 'PLANILHA+TERMO', { planilhaLinha: 7 })).toBe(
    'Preenchido automaticamente: vigência da planilha de contratos (linha 7); confere com o termo'
  )
  expect(textoDaOrigem('vigencia', 'CONTROLE+PLANILHA+TERMO', { mes: '2026-08', planilhaLinha: 7 })).toBe(
    'Preenchido automaticamente: vigência do controle do faturamento de ago/2026; confere com a planilha de contratos (linha 7) e o termo'
  )
})

it('assinatura', () => {
  expect(textoDaOrigem('assinatura', 'CONTROLE', { mes: '2026-08' })).toBe('Preenchido automaticamente: o termo está em uso no controle do faturamento de ago/2026')
  expect(textoDaOrigem('assinatura', 'PLANILHA', { planilhaLinha: 3 })).toBe(
    'Preenchido automaticamente: a planilha de contratos dá a contratação como concluída (linha 3)'
  )
})
