import { chaveDoNome } from '@/lib/importacao-sharepoint/estrutura'
import { chaveExata } from '@/lib/relatorios-clientes/vincular-itens'

import type { IdentidadeDoContrato } from './identidade'

// Qual contrato do cadastro é o da planilha (docs/superpowers/specs/2026-09-25-confere-contrato-do-
// cadastro-design.md §6.2). Regra de ouro do projeto: só escolhe sozinho quando o candidato é ÚNICO —
// dois candidatos viram lista para a pessoa escolher. Quem chama passa só os contratos de clientes que
// a pessoa pode ver.

export interface ContratoParaBusca {
  id: string
  clienteId: string
  clienteNome: string
  clienteSigla: string | null
  numeroTermo: string | null
  chaveSharepoint: string | null
}

export type ResultadoDaLocalizacao =
  | { tipo: 'encontrado'; contrato: ContratoParaBusca }
  | { tipo: 'ambiguo'; candidatos: ContratoParaBusca[] }
  | { tipo: 'nenhum'; mesmoNumero: ContratoParaBusca[]; doOrgao: ContratoParaBusca[] }

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
}

/** "SMIT|52 2024" → "52 2024"; sem chave, o número e o ano do nº do termo ("031/SEME/2017" → "31 2017"). */
function numeroEAno(contrato: ContratoParaBusca): string | null {
  if (contrato.chaveSharepoint) return contrato.chaveSharepoint.split('|')[1] ?? null
  const chave = contrato.numeroTermo ? chaveDoNome(contrato.numeroTermo) : null
  return chave ? `${chave.numero} ${chave.ano}` : null
}

/** O órgão escrito na planilha é o do cliente: sigla igual; uma começando com a outra, com pelo menos
 *  3 letras ("FTMSP"/"FTM" — "SF" não casa com "SFM"); ou o nº do termo citando o órgão. */
export function siglaParecida(orgao: string, contrato: ContratoParaBusca): boolean {
  const o = normalizar(orgao)
  const sigla = normalizar(contrato.clienteSigla ?? '')
  if (sigla && sigla === o) return true
  const menor = Math.min(sigla.length, o.length)
  if (menor >= 3 && (sigla.startsWith(o) || o.startsWith(sigla))) return true
  return (chaveExata(contrato.numeroTermo) ?? '').split(' ').includes(o.toLowerCase())
}

export function localizarContrato(identidade: IdentidadeDoContrato, contratos: ContratoParaBusca[]): ResultadoDaLocalizacao {
  const alvo = `${identidade.base} ${identidade.ano}`
  const mesmoNumero = contratos.filter((c) => numeroEAno(c) === alvo)

  if (!identidade.orgao) {
    if (mesmoNumero.length === 1) return { tipo: 'encontrado', contrato: mesmoNumero[0] }
    if (mesmoNumero.length > 1) return { tipo: 'ambiguo', candidatos: mesmoNumero }
    return { tipo: 'nenhum', mesmoNumero: [], doOrgao: [] }
  }

  const orgao = identidade.orgao
  const chave = normalizar(`${orgao}|${alvo}`)
  const exatos = contratos.filter((c) => c.chaveSharepoint !== null && normalizar(c.chaveSharepoint) === chave)
  if (exatos.length === 1) return { tipo: 'encontrado', contrato: exatos[0] }
  if (exatos.length > 1) return { tipo: 'ambiguo', candidatos: exatos }

  const parecidos = mesmoNumero.filter((c) => siglaParecida(orgao, c))
  if (parecidos.length === 1) return { tipo: 'encontrado', contrato: parecidos[0] }
  if (parecidos.length > 1) return { tipo: 'ambiguo', candidatos: parecidos }

  return { tipo: 'nenhum', mesmoNumero, doOrgao: contratos.filter((c) => siglaParecida(orgao, c)) }
}
