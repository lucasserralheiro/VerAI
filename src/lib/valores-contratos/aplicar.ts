import type { Prisma, PrismaClient } from '@prisma/client'
import { dataBr, valorBr } from '@/lib/controles-contratos/leitura'
import { nomeDoMes } from '@/lib/controles-contratos/tipos'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { vigenciaEfetiva } from '@/lib/relatorios-clientes/regras'
import { chaveNumerica } from '@/lib/relatorios-clientes/vincular-itens'
import { numeroDoValor } from './categoria'
import { decidirLinha, type EntradaLinha, type Gravacao } from './decidir'

// Valor, vigência e assinatura com prova (spec docs/superpowers/specs/2026-09-29-valor-vigencia-contratos-design.md
// §0): junta as fontes de cada contrato, decide linha a linha (`decidirLinha`) e grava SÓ em campo vazio — a
// condição está no `where` do update, então nem uma corrida com a tela troca o que alguém digitou.

export interface ResumoValores {
  linhas: number
  valor: number
  vigencia: number
  assinatura: number
  gravacoes: { contrato: string; linha: string; campo: 'valor' | 'vigencia' | 'assinatura'; dado: string; origem: string }[]
  avisos: { contrato: string; linha: string; aviso: string }[]
}

const TIPOS = new Set(['CONTRATO', 'ADITIVO', 'PRORROGACAO'])
const EM_ELABORACAO = 'Em elaboração'

/** Identidade do termo dentro do contrato: espécie + nº. Contrato inicial = "TC0"; "TA 02", "TA 002/2025",
 *  "T.A. 02" → "TA2"; "TAP 003-2023" → "TAP3" (apostilamento não é o TA 3). Sem número → null (não casa). */
export function termoDoTexto(texto: string | null, contratoInicial = false): string | null {
  if (contratoInicial) return 'TC0'
  const t = texto ?? ''
  const especie = /^\s*TAP\b|apostil/i.test(t) ? 'TAP' : /^\s*TRA\b|rescis/i.test(t) ? 'TRA' : 'TA'
  const m = /(\d+)/.exec(t.replace(/^\D*/, ''))
  return m ? `${especie}${Number(m[1])}` : null
}

const texto = (v: { toString(): string } | null) => (v === null ? null : v.toString())
const decimal = (v: string | undefined | null) => {
  const n = v ? numeroDoValor(v) : null
  return n ? valorBr(n) : null
}

/** Só o que é único: linha duplicada no histórico ("TA 001/2025" e "TA 01") ou na planilha não casa com nada. */
function unicoPor<T>(lista: T[], chave: (t: T) => string | null): Map<string, T> {
  const contagem = new Map<string, number>()
  for (const t of lista) {
    const k = chave(t)
    if (k !== null) contagem.set(k, (contagem.get(k) ?? 0) + 1)
  }
  const mapa = new Map<string, T>()
  for (const t of lista) {
    const k = chave(t)
    if (k !== null && contagem.get(k) === 1) mapa.set(k, t)
  }
  return mapa
}

const mesmoDia = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)

/** Linha do histórico a que o controle do faturamento se refere. Pelo termo ("T.A. 02" → TA 02); quando o órgão
 *  numera diferente do controle (SVMA: "TA 185-SVMA-2025" × "T.A. 02"), pela única linha com o mesmo fim de
 *  vigência. Linha com fim diferente do controle não é a dele. */
function linhaDoTermoDoControle<L extends { id: string; dataVencimento: Date | null }>(
  controle: { termoTexto: string | null; vigenciaFim: Date | null },
  linhas: L[],
  linhaPorTermo: Map<string, L>
): L | undefined {
  const fim = controle.vigenciaFim
  const peloTermo = linhaPorTermo.get(termoDoTexto(controle.termoTexto, !controle.termoTexto)!)
  if (peloTermo) return !peloTermo.dataVencimento || !fim || mesmoDia(peloTermo.dataVencimento, fim) ? peloTermo : undefined
  const peloFim = fim ? linhas.filter((h) => h.dataVencimento && mesmoDia(h.dataVencimento, fim)) : []
  return peloFim.length === 1 ? peloFim[0] : undefined
}

export async function aplicarValoresProvados(prisma: PrismaClient, opcoes: { aplicar: boolean; hoje?: Date }): Promise<ResumoValores> {
  const hoje = opcoes.hoje ?? new Date()
  const [contratos, historico, fichas, planilha, controles, meses] = await Promise.all([
    prisma.contrato.findMany({
      select: { id: true, chaveSharepoint: true, numeroTermo: true, dataVencimento: true, cliente: { select: { siglaLegado: true, nome: true } } },
    }),
    prisma.historicoContrato.findMany({
      select: { id: true, contratoId: true, tipo: true, numero: true, valor: true, data: true, dataInicio: true, dataVencimento: true, situacao: true, createdAt: true },
    }),
    prisma.fichaDocumento.findMany({ where: { origem: { in: ['HISTORICO_TERMO', 'HISTORICO_PROPOSTA'] } }, select: { origem: true, origemId: true, campos: true } }),
    prisma.linhaPlanilhaContratos.findMany({
      select: { linha: true, chave: true, termoTexto: true, termoNumero: true, tipoTermo: true, valor: true, inicio: true, fim: true, statusFormalizacao: true },
    }),
    prisma.controleContrato.findMany({
      where: { contratoId: { not: null }, previstoConferido: true },
      orderBy: [{ mesAno: 'desc' }, { mesMes: 'desc' }],
      select: { contratoId: true, termoTexto: true, previstoTotal: true, vigenciaInicio: true, vigenciaFim: true, mesAno: true, mesMes: true, arquivoId: true },
    }),
    // Todo controle, lido ou não: o arquivo do mês existir já diz que o faturamento cobra o contrato.
    prisma.controleContrato.findMany({ where: { contratoId: { not: null } }, select: { contratoId: true, mesAno: true, mesMes: true } }),
  ])

  const fichaTermo = new Map<string, Record<string, { valor?: string; trecho?: string | null; pagina?: number | null }>>()
  const fichaProposta = new Map<string, Record<string, { valor?: string }>>()
  for (const f of fichas) (f.origem === 'HISTORICO_TERMO' ? fichaTermo : fichaProposta).set(f.origemId, (f.campos ?? {}) as never)
  const planilhaPorChave = new Map<string, typeof planilha>()
  for (const p of planilha) if (p.chave) planilhaPorChave.set(p.chave, [...(planilhaPorChave.get(p.chave) ?? []), p])
  const controleVigente = new Map<string, (typeof controles)[number]>()
  for (const c of controles) if (!controleVigente.has(c.contratoId!)) controleVigente.set(c.contratoId!, c)
  // Controlado "agora" = controle no último mês que a pasta do faturamento tem, ou no anterior.
  const indice = (m: { mesAno: number; mesMes: number }) => m.mesAno * 12 + m.mesMes
  const ultimoMes = Math.max(0, ...meses.map(indice))
  const controleRecente = new Map<string, string>()
  for (const m of meses) {
    if (indice(m) < ultimoMes - 1 || controleRecente.has(m.contratoId!)) continue
    controleRecente.set(m.contratoId!, `${m.mesAno}-${String(m.mesMes).padStart(2, '0')}`)
  }
  const linhasDo = new Map<string, typeof historico>()
  for (const h of historico) linhasDo.set(h.contratoId, [...(linhasDo.get(h.contratoId) ?? []), h])

  const r: ResumoValores = { linhas: 0, valor: 0, vigencia: 0, assinatura: 0, gravacoes: [], avisos: [] }

  for (const c of contratos) {
    const linhas = (linhasDo.get(c.id) ?? []).filter((h) => TIPOS.has(h.tipo))
    if (linhas.length === 0) continue
    const sigla = c.cliente.siglaLegado?.toUpperCase() ?? ''
    const chave = c.chaveSharepoint ?? (sigla && chaveNumerica(c.numeroTermo) ? `${sigla}|${chaveNumerica(c.numeroTermo)}` : null)
    const rotuloContrato = `${sigla || c.cliente.nome} ${c.numeroTermo ?? '(sem número)'}`
    const planilhaPorTermo = unicoPor(chave ? (planilhaPorChave.get(chave) ?? []) : [], (p) =>
      p.termoNumero === 0 ? 'TC0' : p.termoNumero === null ? null : termoDoTexto(p.termoTexto)
    )
    const termoDaLinha = (h: (typeof linhas)[number]) => termoDoTexto(h.numero, h.tipo === 'CONTRATO')
    const linhaPorTermo = unicoPor(linhas, termoDaLinha)
    const controle = controleVigente.get(c.id)
    const linhaDoControle = controle ? linhaDoTermoDoControle(controle, linhas, linhaPorTermo) : undefined
    if (controle && !linhaDoControle) {
      const fim = controle.vigenciaFim ? ` (fim ${formatarData(controle.vigenciaFim.toISOString())})` : ''
      r.avisos.push({
        contrato: rotuloContrato,
        linha: controle.termoTexto ?? 'contrato',
        aviso: `o controle do faturamento de ${nomeDoMes(`${controle.mesAno}-${String(controle.mesMes).padStart(2, '0')}`)} fala do ${controle.termoTexto ?? 'contrato'}${fim} e nenhuma linha do histórico confere`,
      })
    }

    // Ordem para achar a linha anterior (prova da cadeia): data de assinatura, senão início, senão criação.
    const quando = (h: (typeof linhas)[number]) => (h.data ?? h.dataInicio ?? h.createdAt).getTime()
    const ordenadas = [...linhas].sort((a, b) => quando(a) - quando(b))

    const decididas = ordenadas.map((h) => {
      r.linhas++
      const termoH = termoDaLinha(h)
      const termo = fichaTermo.get(h.id)
      const p = termoH && linhaPorTermo.get(termoH)?.id === h.id ? planilhaPorTermo.get(termoH) : undefined
      const antes = ordenadas.slice(0, ordenadas.indexOf(h)).reverse().find((x) => x.valor !== null)
      const entrada: EntradaLinha = {
        tipo: h.tipo,
        atual: { valor: texto(h.valor), dataInicio: h.dataInicio, dataVencimento: h.dataVencimento, data: h.data, situacao: h.situacao },
        ficha: termo?.valorTotal?.valor ? { valor: termo.valorTotal.valor, trecho: termo.valorTotal.trecho ?? null, pagina: termo.valorTotal.pagina ?? null } : null,
        fichaFim: termo?.vigenciaFim?.valor ? dataBr(termo.vigenciaFim.valor) : null,
        proposta: decimal(fichaProposta.get(h.id)?.valorTotal?.valor),
        planilha: p
          ? {
              valor: texto(p.valor),
              inicio: p.inicio,
              fim: p.fim,
              concluida: /conclu/i.test(p.statusFormalizacao ?? ''),
              simples: /inicial|prorroga/i.test(p.tipoTermo ?? '') && !/sem\s+valor/i.test(p.tipoTermo ?? ''),
              linha: p.linha,
            }
          : null,
        controle:
          controle && linhaDoControle?.id === h.id && controle.previstoTotal
            ? {
                previsto: controle.previstoTotal.toString(),
                inicio: controle.vigenciaInicio,
                fim: controle.vigenciaFim,
                mes: `${controle.mesAno}-${String(controle.mesMes).padStart(2, '0')}`,
                arquivoId: controle.arquivoId,
              }
            : null,
        anterior: antes ? texto(antes.valor) : null,
      }
      const decisao = decidirLinha(entrada)
      for (const aviso of decisao.avisos) r.avisos.push({ contrato: rotuloContrato, linha: h.numero ?? h.tipo, aviso })
      return { h, decisao }
    })

    // Guarda do efeito: preencher o fim de uma linha antiga quando o termo mais novo está sem fim ENCERRA o
    // contrato (vigência efetiva no passado). Só vale se nada indica que ele continua — o faturamento ainda o
    // controla ou a planilha tem termo vigente; senão, nenhuma vigência do contrato é gravada nesta passada.
    const todas = linhasDo.get(c.id) ?? []
    const fimAntes = vigenciaEfetiva(c.dataVencimento, todas)
    const fimDepois = vigenciaEfetiva(
      c.dataVencimento,
      todas.map((h) => {
        const d = decididas.find((x) => x.h.id === h.id)?.decisao
        return { ...h, dataVencimento: d?.vigencia?.dado.fim ?? h.dataVencimento, situacao: d?.assinatura?.dado ?? h.situacao }
      })
    )
    if (!fimAntes && fimDepois && fimDepois.getTime() < hoje.getTime() && decididas.some((x) => x.decisao.vigencia)) {
      const recente = controleRecente.get(c.id)
      const vigenteNaPlanilha = (chave ? (planilhaPorChave.get(chave) ?? []) : []).map((p) => p.fim).filter((f): f is Date => !!f && f.getTime() >= hoje.getTime())
      if (recente || vigenteNaPlanilha.length > 0) {
        for (const x of decididas) delete x.decisao.vigencia
        const porque = recente
          ? `o faturamento ainda o controla (${nomeDoMes(recente)})`
          : `a planilha de contratos tem termo até ${formatarData(new Date(Math.max(...vigenteNaPlanilha.map((f) => f.getTime()))).toISOString())}`
        r.avisos.push({
          contrato: rotuloContrato,
          linha: 'contrato',
          aviso: `vigência não gravada: o contrato ficaria encerrado em ${formatarData(fimDepois.toISOString())}, mas ${porque} — falta o fim do termo mais novo no histórico`,
        })
      }
    }

    for (const { h, decisao } of decididas) {
      const rotuloLinha = h.numero ?? h.tipo
      const registrar = async (campo: 'valor' | 'vigencia' | 'assinatura', g: Gravacao<unknown>, mostrar: string, onde: Prisma.HistoricoContratoWhereInput, dados: Prisma.HistoricoContratoUpdateManyMutationInput) => {
        if (opcoes.aplicar) {
          const { count } = await prisma.historicoContrato.updateMany({ where: { id: h.id, ...onde }, data: dados })
          if (count === 0) return
          await prisma.origemCampoHistorico.upsert({
            where: { historicoId_campo: { historicoId: h.id, campo } },
            create: { historicoId: h.id, campo, origem: g.origem, prova: g.prova as Prisma.InputJsonValue },
            update: { origem: g.origem, prova: g.prova as Prisma.InputJsonValue, gravadoEm: new Date() },
          })
        }
        r[campo]++
        r.gravacoes.push({ contrato: rotuloContrato, linha: rotuloLinha, campo, dado: mostrar, origem: g.origem })
      }

      if (decisao.valor) await registrar('valor', decisao.valor, formatarMoeda(decisao.valor.dado), { valor: null }, { valor: decisao.valor.dado })
      if (decisao.vigencia) {
        const { inicio, fim } = decisao.vigencia.dado
        await registrar(
          'vigencia',
          decisao.vigencia,
          `${inicio ? formatarData(inicio.toISOString()) : '(início mantido)'} a ${formatarData(fim.toISOString())}`,
          { dataVencimento: null },
          { dataVencimento: fim, ...(inicio ? { dataInicio: inicio } : {}) }
        )
      }
      if (decisao.assinatura) {
        await registrar(
          'assinatura',
          decisao.assinatura,
          decisao.assinatura.dado,
          { data: null, OR: [{ situacao: null }, { situacao: '' }, { situacao: EM_ELABORACAO }] },
          { situacao: decisao.assinatura.dado }
        )
      }
    }
  }
  return r
}
