import extras from './apelidos-clientes.json'

// Apelidos do cliente tirados do nome do cadastro (spec 2026-09-30-assistente-consultor §4.1):
// "Secretaria Municipal da Saúde" → "saude". O JSON cobre o que a regra não pega.

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const PREFIXOS = [
  /^secretaria municipal (de|da|do|das|dos) /,
  /^secretaria executiva (de|da|do|das|dos) /,
  /^secretaria (de|da|do|das|dos) /,
  /^subprefeitura (de |da |do )?/,
  /^servico funerario do municipio de sao paulo$/,
  /^(companhia|empresa|fundacao|autarquia|instituto|agencia) (de|da|do|das|dos|municipal de) /,
]

// Palavras que não dizem o assunto da pergunta: servem para achar as palavras de assunto
// (contrato pelo assunto). A resposta direta usa um conjunto próprio, mais estreito.
export const PALAVRAS_DE_LIGACAO = new Set([
  'o', 'a', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'me', 'fale', 'fala', 'sobre', 'tudo', 'cliente',
  'resumo', 'mostra', 'mostre', 'ver', 'quero', 'como', 'esta', 'ta', 'situacao', 'geral', 'secretaria', 'por', 'favor',
  'saldo', 'contrato', 'contratos', 'quanto', 'falta', 'faturar', 'vence', 'valor', 'qual', 'quais',
])

export function apelidosDoCliente(c: { nome: string; siglaLegado: string | null }): string[] {
  const nome = semAcento(c.nome.includes(' - ') ? c.nome.slice(0, c.nome.lastIndexOf(' - ')) : c.nome)
  const apelidos: string[] = []
  if (/^servico funerario/.test(nome)) apelidos.push('funerario')
  else {
    for (const p of PREFIXOS) {
      if (p.test(nome)) {
        const nucleo = nome.replace(p, '').trim()
        if (nucleo && nucleo !== nome) apelidos.push(nucleo)
        break
      }
    }
  }
  const doJson = c.siglaLegado ? ((extras as Record<string, string[]>)[c.siglaLegado] ?? []) : []
  return [...new Set([...apelidos, ...doJson.map(semAcento)])]
}
