// Reconhece dúvida de trabalho pelo código (a IA recusava "como corrijo um PROCV?" mesmo com a regra no prompt).

const TERMOS = [
  'excel', 'planilha', 'procv', 'formula', 'celula', 'word', 'oficio', 'memorando', 'despacho', 'e-mail', 'email', 'outlook', 'sei', 'pdf',
  'minuta', 'redigir', 'redacao', 'justificativa', 'parecer', 'apostilamento', 'aditivo', 'prorrogacao', 'reajuste', 'licitacao', 'contrato administrativo',
]

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const PADRAO = new RegExp(`(?<![\p{L}\d-])(?:${TERMOS.join('|')})(?![\p{L}\d-])`, 'u')

export const TIPO_DUVIDA_DE_TRABALHO = 'Tipo da pergunta: dúvida de trabalho — se o VerAI não tiver o dado, responda dentro de :::geral; não use a frase de recusa.'

export function duvidaDeTrabalho(pergunta: string): boolean {
  return PADRAO.test(semAcento(pergunta))
}
