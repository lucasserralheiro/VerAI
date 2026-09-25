import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import type { AuthUser } from '@/lib/auth'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { formatarSei } from '@/lib/relatorios-clientes/sei'
import type { ContratoConsolidado } from '@/lib/relatorios-clientes/contratos-consolidados'
import { SELECT_CONTRATO } from '@/app/api/contratos/esquema'

export interface ContextoFerramenta {
  usuario: AuthUser
  hoje: Date
}

export interface Ferramenta<E extends z.ZodType = z.ZodType> {
  descricao: string
  entrada: E
  executar(entrada: z.output<E>, contexto: ContextoFerramenta): Promise<unknown>
  /** Texto compacto ao modelo, quando o genérico (`compactar`) não basta. */
  compactar?(saida: unknown): string
}

export function definirFerramenta<E extends z.ZodType>(ferramenta: Ferramenta<E>): Ferramenta<E> {
  return ferramenta
}

export const LIMITE_PADRAO = 20
/** Igual para inexistente e sem permissão — não revela que o registro existe. */
export const NAO_ENCONTRADO = { erro: 'não encontrado' } as const

export const esquemaLimite = z.number().int().min(1).max(100).default(LIMITE_PADRAO).describe('quantos itens devolver (padrão 20)')
export const esquemaCompetencia = z.string().regex(/^\d{4}-\d{2}$/).describe('competência no formato AAAA-MM')

/** `undefined` = admin (sem restrição); senão o filtro `{ in: [...] }` para `clienteId`. */
export async function filtroDeClientes(usuario: AuthUser): Promise<{ in: string[] } | undefined> {
  const ids = await clienteIdsPermitidos(usuario)
  return ids === null ? undefined : { in: ids }
}

export function moeda(valor: { toString(): string } | string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return formatarMoeda(typeof valor === 'number' ? valor : valor.toString())
}

export function data(valor: Date | null | undefined): string {
  return valor ? formatarData(valor.toISOString()) : '—'
}

export function sei(valor: string | null | undefined): string | null {
  return valor?.trim() ? formatarSei(valor) : null
}

export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function competenciaTexto(ano: number | null, mes: number | null): string {
  return ano && mes ? `${String(mes).padStart(2, '0')}/${ano}` : '—'
}

export type ContratoComSelect = Prisma.ContratoGetPayload<{ select: typeof SELECT_CONTRATO }>

/** Resumo de UM contrato para a IA. Ativo, vigência, valor e saldo vêm SÓ do consolidado. */
export function resumirContrato(contrato: ContratoComSelect, consolidado: ContratoConsolidado) {
  return {
    id: contrato.id,
    numero: contrato.numeroTermo,
    descricao: contrato.descricao,
    seiCliente: sei(contrato.seiCliente),
    seiProdam: sei(contrato.seiProdam),
    situacao: contrato.situacao,
    ativo: consolidado.ativo,
    rescindido: consolidado.rescindido,
    situacaoDesatualizada: consolidado.situacaoDesatualizada,
    prorrogacaoEmAndamento: consolidado.prorrogacaoEmAndamento,
    inicio: data(contrato.dataInicio),
    fimVigencia: data(consolidado.vigenciaFim),
    vencimento: consolidado.vencimento.nivel,
    diasParaVencer: consolidado.vencimento.dias,
    valorContratado: consolidado.valorBase === null ? 'sem valor cadastrado' : moeda(consolidado.valorBase),
    faturado: moeda(consolidado.saldo.faturado),
    saldo: consolidado.saldo.saldo === null ? null : moeda(consolidado.saldo.saldo),
    percentualFaturado: consolidado.saldo.percentualFaturado === null ? null : `${consolidado.saldo.percentualFaturado}%`,
    aditivos: consolidado.resumoHistorico.aditivos,
    prorrogacoes: consolidado.resumoHistorico.prorrogacoes,
    href: `/clientes/${contrato.clienteId}/contratos/${contrato.id}`,
  }
}

export type ContratoResumido = ReturnType<typeof resumirContrato>

/** Avisos do consolidado em palavras curtas (a regra 3 da instrução cita estes textos). */
export function avisosDoContrato(c: Pick<ContratoResumido, 'vencimento' | 'situacaoDesatualizada' | 'prorrogacaoEmAndamento'>): string {
  return [
    c.vencimento === 'vencido' && 'vencido',
    c.vencimento === 'critico' && 'vence em até 30 dias',
    c.situacaoDesatualizada && 'situação desatualizada',
    c.prorrogacaoEmAndamento && 'prorrogação sem assinatura',
  ]
    .filter(Boolean)
    .join(', ')
}
