import type { PrismaClient } from '@prisma/client'
import { normalizarChave } from '@/lib/arquivos/sharepoint/regras'
import { chaveDoNome } from './estrutura'
import { chaveDoTermo } from './identidade'

// Migração da identidade do importador antigo (spec docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md
// §6.1–6.2): chave do contrato passa de `<pasta do cliente>|nº ano` para `<sigla>|nº ano`, e o que a
// chave antiga duplicou (SUB-ITP em duas pastas; SMIT TC 52 em dois lugares) é fundido — só quando é
// seguro. O resto vai para revisão manual. Roda depois da migração das cópias (migracao-anexos.ts):
// a fusão de linhas compara os PDFs por referência.

const CAMPOS_CONTRATO = ['numeroTermo', 'descricao', 'seiCliente', 'seiProdam', 'dataInicio', 'dataVencimento', 'situacao'] as const
const CAMPOS_LINHA = [
  'numero',
  'data',
  'valor',
  'objeto',
  'proposta',
  'situacao',
  'dataInicio',
  'dataVencimento',
  'dataEnvio',
  'observacao',
  'propostaArquivoId',
  'termoArquivoId',
] as const

const vazio = (v: unknown) => v === null || v === undefined || v === ''

/** Campos vazios de quem fica, preenchidos com o valor de quem sai — mantendo o tipo de cada campo. */
function completarVazios<T extends object, C extends keyof T>(campos: readonly C[], fica: T, sai: T): Partial<Pick<T, C>> {
  const saida: Partial<Pick<T, C>> = {}
  for (const campo of campos) if (vazio(fica[campo]) && !vazio(sai[campo])) saida[campo] = sai[campo]
  return saida
}

export async function migrarChavesDeContrato(db: PrismaClient, opcoes: { aplicar: boolean }) {
  const r = { renomeados: 0, fundidos: [] as string[], revisar: [] as string[] }
  const contratos = await db.contrato.findMany({
    where: { chaveSharepoint: { not: null } },
    select: {
      id: true,
      chaveSharepoint: true,
      createdAt: true,
      numeroTermo: true,
      descricao: true,
      seiCliente: true,
      seiProdam: true,
      dataInicio: true,
      dataVencimento: true,
      situacao: true,
      cliente: { select: { siglaLegado: true } },
      _count: { select: { itens: true, faturamentos: true, termosConfirmacao: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const porChave = new Map<string, typeof contratos>()
  for (const c of contratos) {
    const nova = `${normalizarChave(c.cliente.siglaLegado ?? '')}|${c.chaveSharepoint!.split('|').slice(1).join('|')}`
    porChave.set(nova, [...(porChave.get(nova) ?? []), c])
  }

  for (const [nova, grupo] of porChave) {
    const fica = grupo.find((c) => c.chaveSharepoint === nova) ?? grupo[0]
    for (const sai of grupo) {
      if (sai === fica) continue
      const soDaImportacao = sai._count.itens === 0 && sai._count.faturamentos === 0 && sai._count.termosConfirmacao === 0
      if (!soDaImportacao) {
        r.revisar.push(`${sai.chaveSharepoint} e ${fica.chaveSharepoint} são o mesmo contrato, mas ${sai.chaveSharepoint} tem itens, faturamentos ou termos — junte à mão`)
        continue
      }
      r.fundidos.push(`${sai.chaveSharepoint} → ${nova}`)
      if (!opcoes.aplicar) continue
      try {
        const completar = completarVazios(CAMPOS_CONTRATO, fica, sai)
        await db.$transaction([
          ...(Object.keys(completar).length > 0 ? [db.contrato.update({ where: { id: fica.id }, data: completar })] : []),
          db.historicoContrato.updateMany({ where: { contratoId: sai.id }, data: { contratoId: fica.id } }),
          db.arquivoSharepoint.updateMany({ where: { contratoId: sai.id }, data: { contratoId: fica.id } }),
          db.contrato.delete({ where: { id: sai.id } }),
        ])
      } catch (erro) {
        r.revisar.push(`${sai.chaveSharepoint}: não consegui fundir (${erro instanceof Error ? erro.message : String(erro)})`)
      }
    }
    if (fica.chaveSharepoint !== nova) {
      r.renomeados++
      if (opcoes.aplicar) await db.contrato.update({ where: { id: fica.id }, data: { chaveSharepoint: nova } })
    }
  }
  return r
}

/** Cópia de contrato criada pela importação antiga quando o casamento com o legado falhou ("TC 105/2025/SMS-1"
 *  lido como 105/2025/1): vai para o contrato do legado com o mesmo número e ano — só se ele for ÚNICO no
 *  cliente e a cópia não tiver item, faturamento nem termo. Nunca apaga contrato do legado. */
export async function fundirComLegado(db: PrismaClient, opcoes: { aplicar: boolean }) {
  const r = { fundidos: [] as string[], revisar: [] as string[] }
  const selecao = {
    id: true, clienteId: true, numeroTermo: true, chaveSharepoint: true, legacyId: true,
    descricao: true, seiCliente: true, seiProdam: true, dataInicio: true, dataVencimento: true, situacao: true,
    _count: { select: { itens: true, faturamentos: true, termosConfirmacao: true } },
  } as const
  const copias = await db.contrato.findMany({ where: { chaveSharepoint: { not: null }, legacyId: null }, select: selecao })
  const legados = await db.contrato.findMany({ where: { chaveSharepoint: null }, select: selecao })
  const usados = new Set<string>()

  for (const copia of copias) {
    const [numero, ano] = copia.chaveSharepoint!.split('|')[1].split(' ')
    if (numero === 'sn') continue
    const candidatos = legados.filter((l) => {
      if (l.clienteId !== copia.clienteId || usados.has(l.id)) return false
      const chave = chaveDoNome(l.numeroTermo ?? '')
      return chave !== null && chave.numero === numero && chave.ano === ano
    })
    if (candidatos.length === 0) continue
    if (candidatos.length > 1) {
      r.revisar.push(`${copia.chaveSharepoint}: ${candidatos.length} contratos do legado com o mesmo número (${candidatos.map((c) => c.numeroTermo).join(', ')}) — junte à mão`)
      continue
    }
    const alvo = candidatos[0]
    if (copia._count.itens + copia._count.faturamentos + copia._count.termosConfirmacao > 0) {
      r.revisar.push(`${copia.chaveSharepoint}: é o mesmo contrato que ${alvo.numeroTermo} (legado), mas tem itens, faturamentos ou termos — junte à mão`)
      continue
    }
    usados.add(alvo.id)
    r.fundidos.push(`${copia.chaveSharepoint} → ${alvo.numeroTermo}`)
    if (!opcoes.aplicar) continue
    try {
      const completar = completarVazios(CAMPOS_CONTRATO, alvo, copia)
      await db.$transaction([
        db.historicoContrato.updateMany({ where: { contratoId: copia.id }, data: { contratoId: alvo.id } }),
        db.arquivoSharepoint.updateMany({ where: { contratoId: copia.id }, data: { contratoId: alvo.id } }),
        db.contrato.delete({ where: { id: copia.id } }),
        db.contrato.update({ where: { id: alvo.id }, data: { ...completar, chaveSharepoint: copia.chaveSharepoint } }),
      ])
    } catch (erro) {
      r.revisar.push(`${copia.chaveSharepoint}: não consegui fundir (${erro instanceof Error ? erro.message : String(erro)})`)
    }
  }
  return r
}

/** Linhas do mesmo termo repetidas num contrato ligado ao SharePoint. Contrato inicial é um só (salvo PDFs
 *  diferentes → revisão); aditivo só é o mesmo com o mesmo PDF. Fica a linha do legado/digitada (senão a
 *  mais completa); só sai linha criada pela importação — e os PDFs e a pista de pasta dela passam pra que fica. */
export async function fundirLinhasDuplicadas(db: PrismaClient, opcoes: { aplicar: boolean }) {
  const r = { fundidas: [] as string[], revisar: [] as string[] }
  const linhas = await db.historicoContrato.findMany({
    where: { contrato: { chaveSharepoint: { not: null } } },
    select: {
      id: true,
      contratoId: true,
      tipo: true,
      createdAt: true,
      legacyId: true,
      chaveSharepoint: true,
      numero: true,
      data: true,
      valor: true,
      objeto: true,
      proposta: true,
      situacao: true,
      dataInicio: true,
      dataVencimento: true,
      dataEnvio: true,
      observacao: true,
      propostaArquivoId: true,
      termoArquivoId: true,
      propostaDoSharepoint: true,
      termoDoSharepoint: true,
      // Antes da sincronização as linhas do SharePoint ainda não têm referência: a cópia antiga diz
      // qual PDF é pelo nome do arquivo de origem (sai na limpeza, Task 15 do plano).
      propostaPdfNome: true,
      termoPdfNome: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const grupos = new Map<string, typeof linhas>()
  for (const l of linhas) {
    const chave = chaveDoTermo(l.tipo, l.numero)
    if (!chave) continue
    const k = `${l.contratoId}|${chave}`
    grupos.set(k, [...(grupos.get(k) ?? []), l])
  }

  const daImportacao = (l: { chaveSharepoint: string | null; legacyId: number | null }) => l.chaveSharepoint !== null && !l.legacyId
  const preenchidos = (l: Record<string, unknown>) => CAMPOS_LINHA.filter((c) => !vazio(l[c])).length
  const nome = (l: { chaveSharepoint: string | null; legacyId: number | null; id: string }) =>
    l.chaveSharepoint ?? (l.legacyId ? `linha do legado #${l.legacyId}` : `linha ${l.id}`)
  for (const grupo of grupos.values()) {
    if (grupo.length < 2 || !grupo.some(daImportacao)) continue
    const [fica, ...resto] = [...grupo].sort(
      (a, b) => Number(daImportacao(a)) - Number(daImportacao(b)) || preenchidos(b) - preenchidos(a)
    )
    for (const sai of resto) {
      if (!daImportacao(sai)) continue // nunca apaga linha do legado nem digitada
      const mesmoPdf =
        (sai.termoArquivoId !== null && sai.termoArquivoId === fica.termoArquivoId) ||
        (sai.propostaArquivoId !== null && sai.propostaArquivoId === fica.propostaArquivoId) ||
        (!!sai.termoPdfNome && sai.termoPdfNome === fica.termoPdfNome) ||
        (!!sai.propostaPdfNome && sai.propostaPdfNome === fica.propostaPdfNome)
      const pdfDiferente =
        (!!sai.termoArquivoId && !!fica.termoArquivoId && sai.termoArquivoId !== fica.termoArquivoId) ||
        (!!sai.propostaArquivoId && !!fica.propostaArquivoId && sai.propostaArquivoId !== fica.propostaArquivoId) ||
        (!!sai.termoPdfNome && !!fica.termoPdfNome && sai.termoPdfNome !== fica.termoPdfNome) ||
        (!!sai.propostaPdfNome && !!fica.propostaPdfNome && sai.propostaPdfNome !== fica.propostaPdfNome)
      if (sai.tipo === 'CONTRATO' && pdfDiferente) {
        r.revisar.push(`${nome(sai)} e ${nome(fica)}: dois contratos iniciais com PDFs diferentes — revise`)
        continue
      }
      if (sai.tipo !== 'CONTRATO' && !mesmoPdf) continue // mesmo número e conteúdo diferente: são termos diferentes
      r.fundidas.push(`${nome(sai)} → ${nome(fica)}`)
      if (!opcoes.aplicar) continue
      try {
        const completar = {
          ...completarVazios(CAMPOS_LINHA, fica, sai),
          ...(fica.chaveSharepoint === null ? { chaveSharepoint: sai.chaveSharepoint } : {}),
          ...(!fica.termoArquivoId && sai.termoArquivoId ? { termoDoSharepoint: sai.termoDoSharepoint } : {}),
          ...(!fica.propostaArquivoId && sai.propostaArquivoId ? { propostaDoSharepoint: sai.propostaDoSharepoint } : {}),
        }
        // Apaga antes de atualizar: `chaveSharepoint` é único.
        await db.$transaction([
          db.arquivoSharepoint.updateMany({ where: { historicoId: sai.id }, data: { historicoId: fica.id } }),
          db.historicoContrato.delete({ where: { id: sai.id } }),
          ...(Object.keys(completar).length > 0 ? [db.historicoContrato.update({ where: { id: fica.id }, data: completar })] : []),
        ])
      } catch (erro) {
        r.revisar.push(`${nome(sai)}: não consegui fundir (${erro instanceof Error ? erro.message : String(erro)})`)
      }
    }
  }
  return r
}
