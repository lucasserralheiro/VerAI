import { render, screen } from '@testing-library/react'
import { CartaoAnexo } from './cartao-anexo'

const base = { id: 'l1', nome: 'proposta.pdf' }

it.each([
  [{ etapa: 'fila' as const }, 'Na fila…'],
  [{ etapa: 'enviando' as const }, 'Enviando…'],
  [{ etapa: 'ocr' as const, progresso: { pagina: 3, total: 12 } }, 'Lendo página 3 de 12 (OCR)…'],
  [{ etapa: 'ocr' as const }, 'Lendo (OCR)…'],
  [{ etapa: 'lendo' as const }, 'Lendo…'],
  [{ etapa: 'pronto' as const }, 'Pronto'],
  [{ etapa: 'erro' as const, erro: 'formato não aceito' }, 'Erro: formato não aceito'],
])('mostra o nome e o andamento (%o)', (estado, texto) => {
  render(<CartaoAnexo anexo={{ ...base, ...estado }} />)
  expect(screen.getByText('proposta.pdf')).toBeInTheDocument()
  expect(screen.getByText(texto)).toBeInTheDocument()
})

it('erro sem motivo diz só "Erro"', () => {
  render(<CartaoAnexo anexo={{ ...base, etapa: 'erro' }} />)
  expect(screen.getByText('Erro')).toBeInTheDocument()
})
