import type { PrismaClient } from '@prisma/client'
import { normalizarChave } from '@/lib/arquivos/sharepoint/regras'
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

export async function fundirLinhasDuplicadas(db: PrismaClient, opcoes: { aplicar: boolean }) {
  const r = { fundidas: [] as string[], revisar: [] as string[] }
  const linhas = await db.historicoContrato.findMany({
    where: { chaveSharepoint: { not: null } },
    select: {
      id: true,
      contratoId: true,
      tipo: true,
      createdAt: true,
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

  const preenchidos = (l: Record<string, unknown>) => CAMPOS_LINHA.filter((c) => !vazio(l[c])).length
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue
    const [fica, ...resto] = [...grupo].sort((a, b) => preenchidos(b) - preenchidos(a))
    for (const sai of resto) {
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
      // Contrato inicial é um só por contrato: duas linhas dele vindas do SharePoint são a mesma, a menos
      // que tragam PDFs diferentes. Aditivo com o mesmo número só é o mesmo termo com o mesmo PDF.
      if (sai.tipo === 'CONTRATO' && pdfDiferente) {
        r.revisar.push(`${sai.chaveSharepoint} e ${fica.chaveSharepoint}: dois contratos iniciais com PDFs diferentes — revise`)
        continue
      }
      if (sai.tipo !== 'CONTRATO' && !mesmoPdf) continue // mesmo número e conteúdo diferente: são termos diferentes
      r.fundidas.push(`${sai.chaveSharepoint} → ${fica.chaveSharepoint}`)
      if (!opcoes.aplicar) continue
      try {
        const completar = completarVazios(CAMPOS_LINHA, fica, sai)
        await db.$transaction([
          ...(Object.keys(completar).length > 0 ? [db.historicoContrato.update({ where: { id: fica.id }, data: completar })] : []),
          db.arquivoSharepoint.updateMany({ where: { historicoId: sai.id }, data: { historicoId: fica.id } }),
          db.historicoContrato.delete({ where: { id: sai.id } }),
        ])
      } catch (erro) {
        r.revisar.push(`${sai.chaveSharepoint}: não consegui fundir (${erro instanceof Error ? erro.message : String(erro)})`)
      }
    }
  }
  return r
}
