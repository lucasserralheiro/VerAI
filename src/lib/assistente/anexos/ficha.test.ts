import { fichaDoAnexo, textoDaFicha, tipoDoDocumento } from './ficha'

const sem = { clienteId: null, cliente: null, contratoId: null, contrato: null }

it.each([
  ['PC 012-2025 SMS.pdf', 'PROPOSTA COMERCIAL', 'pdf', 'proposta'],
  ['TA 03.pdf', 'TERMO ADITIVO Nº 03 AO TERMO DE CONTRATO', 'pdf', 'termo'],
  ['Controle 08.2026.pdf', 'CONTROLE DE CONTRATOS previsto faturado saldo', 'pdf', 'controle'],
  ['itens.xlsx', 'qualquer', 'xlsx', 'planilha'],
  ['Ofício 123.docx', 'OFÍCIO Nº 123/2026 Senhor Diretor', 'docx', 'oficio'],
  ['msg.eml', '', 'eml', 'email'],
  ['conversa-2026-10-02-1000.txt', '01/10/2026 09:12 - Ana: oi\n01/10/2026 09:13 - Lucas: oi', 'txt', 'conversa'],
  ['x.pdf', 'texto sem pista', 'pdf', 'outro'],
] as const)('%s → %s', (nome, texto, formato, tipo) => {
  expect(tipoDoDocumento(nome, texto, formato)).toBe(tipo)
})

it('ficha de proposta: campos por regra, itens, cliente/contrato e sugestões', () => {
  const f = fichaDoAnexo({
    nome: 'PC 012-2025.pdf', formato: 'pdf',
    paginas: [{ pagina: 1, texto: 'PROPOSTA COMERCIAL\nObjeto: prestação de serviços de tecnologia\nValor total: R$ 18.530,00\nVigência de 12 (doze) meses' }],
    itens: [
      { codigo: '10.050.00067.00', descricao: 'Analista', quantidade: '120', unitario: '150.25', total: '18030.00', linha: 1 },
      { codigo: '14.052.00001.00', descricao: 'TID', quantidade: '1000', unitario: '0.50', total: '500.00', linha: 2 },
    ],
    entidades: { clienteId: 'c1', cliente: 'SMS – Secretaria Municipal da Saúde', contratoId: 'k1', contrato: 'TC 105/2025' },
  })
  expect(f).toMatchObject({ tipo: 'proposta', clienteId: 'c1', contratoId: 'k1', itens: 2, somaItens: '18530.00' })
  expect(f.campos.valorTotal).toEqual({ valor: 'R$ 18.530,00', pagina: 1 })
  expect(f.sugestoes).toEqual(['Os preços estão certos?', 'Bate com o contrato TC 105/2025?', 'Resuma os riscos e prazos.'])
  const t = textoDaFicha('PC 012-2025.pdf', f)
  expect(t).toContain('**PC 012-2025.pdf** — proposta comercial · SMS – Secretaria Municipal da Saúde · TC 105/2025')
  expect(t).toContain('- valor: R$ 18.530,00 (p. 1)')
})

it('ficha de conversa e de PDF sem texto', () => {
  const c = fichaDoAnexo({ nome: 'conversa.txt', formato: 'txt', paginas: [{ pagina: null, texto: '01/10/2026 09:12 - Ana: oi\n02/10/2026 08:00 - Lucas: ok' }], itens: [], entidades: sem })
  expect(c.conversa).toEqual({ participantes: ['Ana', 'Lucas'], inicio: '01/10/2026 09:12', fim: '02/10/2026 08:00', mensagens: 2 })
  expect(c.sugestoes[0]).toBe('O que foi combinado e quem ficou de fazer o quê?')
  const s = fichaDoAnexo({ nome: 'scan.pdf', formato: 'pdf', paginas: [], itens: [], entidades: sem, paginasIlegiveis: [2] })
  expect(s.avisos).toContain('página 2 ilegível')
})

it('e-mail colado: "(texto colado)" não é participante', () => {
  const f = fichaDoAnexo({
    nome: 'conversa.txt', formato: 'txt', itens: [], entidades: sem,
    paginas: [{ pagina: null, texto: 'segue abaixo\nDe: Ana <a@x.com>\nEnviado: 01/10/2026 09:12\nAssunto: oi\n\nolá' }],
  })
  expect(f.conversa?.participantes).toEqual(['Ana <a@x.com>'])
  expect(f.conversa?.participantes).not.toContain('(texto colado)')
})
