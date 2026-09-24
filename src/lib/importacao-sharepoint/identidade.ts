import { chaveExata } from '@/lib/relatorios-clientes/vincular-itens'
import type { TipoTermo } from './estrutura'

// Qual linha do histórico é cada pasta de termo do SharePoint — sem depender do caminho da pasta
// (spec docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §3.3). Mover o contrato para
// "Contratos Finalizados", mudar o rótulo, renomear "TA XX" para "TA 03" ou ter a mesma pasta em dois
// lugares nunca pode criar linha duplicada. Regra pura: sem banco.

export interface PastaDeTermo {
  /** Caminho da pasta do termo (ou `<pasta do contrato>#inicial`). */
  pasta: string
  tipo: TipoTermo
  numero: string | null
  /** Caminhos dos arquivos da pasta, inclusive WORK/. */
  arquivos: string[]
  /** SHA-256 desses arquivos. */
  hashes: string[]
}

export interface GrupoDeTermo {
  pastas: PastaDeTermo[]
  tipo: TipoTermo
  numero: string | null
}

export interface LinhaConhecida {
  id: string
  tipo: string
  numero: string | null
  /** Caminhos de arquivo do SharePoint já ligados à linha (estado da sincronização). */
  caminhos: string[]
  /** Pasta gravada em `chaveSharepoint` pelo importador antigo (`<contrato>|<pasta>`). */
  pastaAntiga: string | null
  /** Conteúdos já ligados à linha (estado da sincronização + colunas PC/PA–TC/TA). */
  hashes: string[]
}

/** Contrato inicial é um só por contrato; os demais pelo número tolerante. Sem número (ou "XX") não
 *  tem chave — só se acha por caminho ou conteúdo. */
export function chaveDoTermo(tipo: string, numero: string | null): string | null {
  if (tipo === 'CONTRATO') return 'CONTRATO'
  if (!numero || /\bXX\b/i.test(numero)) return null
  const chave = chaveExata(numero)
  return chave ? `T:${chave}` : null
}

function algumEmComum(a: string[], b: string[]): boolean {
  const conjunto = new Set(a)
  return b.some((item) => conjunto.has(item))
}

/** Passo 1: pastas com a mesma chave são o mesmo termo só se dividem ao menos um arquivo por conteúdo. */
export function agruparTermos(pastas: PastaDeTermo[]): { grupos: GrupoDeTermo[]; avisos: string[] } {
  const grupos: GrupoDeTermo[] = []
  const avisos: string[] = []
  for (const pasta of pastas) {
    const chave = chaveDoTermo(pasta.tipo, pasta.numero)
    if (chave !== null) {
      const mesmaChave = grupos.filter((g) => chaveDoTermo(g.tipo, g.numero) === chave)
      const junto = mesmaChave.find((g) => algumEmComum(g.pastas.flatMap((p) => p.hashes), pasta.hashes))
      if (junto) {
        junto.pastas.push(pasta)
        continue
      }
      if (mesmaChave.length > 0) {
        avisos.push(`duas pastas com o mesmo termo (${pasta.numero ?? 'contrato inicial'}) e nenhum arquivo em comum — ${pasta.pasta} fica como linha separada, revise`)
      }
    }
    grupos.push({ pastas: [pasta], tipo: pasta.tipo, numero: pasta.numero })
  }
  return { grupos, avisos }
}

/** Passos 2–5, em rodadas sobre todos os grupos: mesmo caminho → mesmo tipo e número → mesmo conteúdo
 *  → linha nova. Só casa quando o candidato é ÚNICO entre as linhas ainda não reivindicadas. */
export function resolverLinhas(grupos: GrupoDeTermo[], linhas: LinhaConhecida[]): Array<string | null> {
  const resultado: Array<string | null> = grupos.map(() => null)
  const reivindicadas = new Set<string>()
  const livres = linhas.filter((l) => l.tipo !== 'PROSPECCAO')

  function rodada(criterio: (grupo: GrupoDeTermo, linha: LinhaConhecida) => boolean) {
    grupos.forEach((grupo, i) => {
      if (resultado[i] !== null) return
      const candidatas = livres.filter((l) => !reivindicadas.has(l.id) && criterio(grupo, l))
      if (candidatas.length !== 1) return
      resultado[i] = candidatas[0].id
      reivindicadas.add(candidatas[0].id)
    })
  }

  // 2) Mesmo caminho: algum arquivo da pasta já aponta pra linha, ou a chave antiga guarda a pasta.
  rodada((g, l) => {
    const pastas = new Set(g.pastas.map((p) => p.pasta))
    return algumEmComum(l.caminhos, g.pastas.flatMap((p) => p.arquivos)) || (l.pastaAntiga !== null && pastas.has(l.pastaAntiga))
  })
  // 3) Mesmo tipo e número.
  rodada((g, l) => {
    const chave = chaveDoTermo(g.tipo, g.numero)
    if (chave === null) return false
    return chave === 'CONTRATO' ? l.tipo === 'CONTRATO' : l.tipo !== 'CONTRATO' && chaveDoTermo(l.tipo, l.numero) === chave
  })
  // 4) Mesmo conteúdo (depois do número: o mesmo PA aparece repetido em TA 02 e TA 03).
  rodada((g, l) => algumEmComum(l.hashes, g.pastas.flatMap((p) => p.hashes)))

  return resultado
}
