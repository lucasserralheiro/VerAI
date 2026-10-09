import { chaveExata } from '@/lib/relatorios-clientes/vincular-itens'

import { siglaComparavel, type IdentidadeDoContrato } from './identidade'
import type { ContratoParaBusca } from './localizar-contrato'

// Quando o sistema escolhe o contrato sozinho, a pessoa precisa ver **o que a planilha disse** ao lado
// **do que foi escolhido** — senão uma escolha por semelhança parece uma leitura certa. A regra de
// `localizarContrato` aceita sigla parecida ("FTMSP" → "FTM", "SMCG" → "SMC"), e é isso mesmo que
// resolve os levantamentos reais; mas a mesma regra casa "SMTUR" com "SMT", que são órgãos diferentes
// (verificado na tela em 08/10/2026). A regra não muda; este aviso é o que impede o engano calado.

/** A sigla da chave do SharePoint ("SMIT|52 2024" → "SMIT"), comparável com o órgão lido. */
function siglaDaChave(contrato: ContratoParaBusca): string | null {
  return contrato.chaveSharepoint ? siglaComparavel(contrato.chaveSharepoint.split('|')[0]) : null
}

/** O órgão que a planilha escreveu é exatamente o do contrato: sigla da chave, sigla do cliente ou o
 *  órgão citado no próprio nº do termo ("17/SMTUR/2021"). */
function orgaoConfere(orgao: string, contrato: ContratoParaBusca): boolean {
  if (siglaDaChave(contrato) === orgao) return true
  if (siglaComparavel(contrato.clienteSigla ?? '') === orgao) return true
  return (chaveExata(contrato.numeroTermo) ?? '').split(' ').includes(orgao.toLowerCase())
}

/** Texto para a tela quando o contrato achado sozinho **não é igual** ao que a planilha diz; `null`
 *  quando o órgão é o mesmo. Duas situações:
 *  - a planilha cita um órgão e o contrato é de outra sigla (escolhido por ser parecida);
 *  - a planilha não cita órgão nenhum (nem na referência, nem no título) e o contrato saiu só do
 *    número e do ano. */
export function avisoDeOrgao(identidade: IdentidadeDoContrato, contrato: ContratoParaBusca): string | null {
  const numeroEAno = `${identidade.base}/${identidade.ano}`
  if (!identidade.orgao) {
    return `A planilha não cita o órgão do contrato: ele foi escolhido só pelo número e pelo ano (${numeroEAno}). Confira se é o do órgão certo antes de gerar o relatório.`
  }
  if (orgaoConfere(identidade.orgao, contrato)) return null
  const doContrato = siglaDaChave(contrato) ?? (contrato.clienteSigla ? siglaComparavel(contrato.clienteSigla) : null)
  const qual = doContrato ? `${doContrato} (${contrato.clienteNome})` : contrato.clienteNome
  return `A planilha cita o órgão ${identidade.orgao}, e o contrato do cadastro é de ${qual}. O sistema o escolheu porque as siglas são parecidas, não porque são iguais. Confira se é o mesmo órgão antes de gerar o relatório.`
}
