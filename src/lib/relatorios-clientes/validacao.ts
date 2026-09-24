/**
 * Pré-processadores zod compartilhados pelas rotas de "Relatórios dos clientes"
 * (Tasks 3–8). Convenção de todos os opcionais: campo ausente (`undefined`)
 * continua ausente — o Prisma ignora e o update parcial não apaga nada —,
 * enquanto texto vazio/só espaço vira `null` (apaga o valor).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizarDecimal } from './numero'

export { normalizarDecimal }

const OBRIGATORIO = 'campo obrigatório'

function aparar(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor
}

function aparOuNull(valor: unknown): unknown {
  const aparado = aparar(valor)
  return aparado === '' ? null : aparado
}

export const textoOpcional = z.preprocess(aparOuNull, z.string().nullable().optional())

export const textoObrigatorio = z.preprocess(
  aparar,
  z.string({ error: OBRIGATORIO }).min(1, OBRIGATORIO)
)

export const emailOpcional = z.preprocess(aparOuNull, z.email('e-mail inválido').nullable().optional())

export const booleanoOpcional = z.preprocess(
  (valor) => (valor === 'true' ? true : valor === 'false' ? false : aparOuNull(valor)),
  z.boolean().nullable().optional()
)

const numeroOuTexto = z.union([z.string(), z.number()], { error: 'valor numérico inválido' })

export const decimalOpcional = numeroOuTexto
  .nullable()
  .optional()
  .transform((bruto, ctx) => {
    if (bruto === undefined || bruto === null) return bruto
    if (typeof bruto === 'string' && bruto.trim() === '') return null
    const resultado = normalizarDecimal(bruto)
    if ('erro' in resultado) {
      ctx.addIssue({ code: 'custom', message: resultado.erro })
      return z.NEVER
    }
    return resultado.valor
  })

export const decimalObrigatorio = z
  .union([z.string(), z.number()], {
    error: (issue) => (issue.input === undefined || issue.input === null ? OBRIGATORIO : 'valor numérico inválido'),
  })
  .transform((bruto, ctx) => {
    if (typeof bruto === 'string' && bruto.trim() === '') {
      ctx.addIssue({ code: 'custom', message: OBRIGATORIO })
      return z.NEVER
    }
    const resultado = normalizarDecimal(bruto)
    if ('erro' in resultado) {
      ctx.addIssue({ code: 'custom', message: resultado.erro })
      return z.NEVER
    }
    return resultado.valor
  })

/** Inteiro obrigatório dentro de `[min, max]` (ano de competência, mês 1–12...). Aceita número ou
 *  texto (`" 12 "`), porque campo de formulário chega como string. Para opcional, `.optional()`. */
export function inteiroEntre(min: number, max: number) {
  const foraDaFaixa = `deve ser um número inteiro entre ${min} e ${max}`
  return z
    .union([z.string(), z.number()], {
      error: (issue) => (issue.input === undefined || issue.input === null ? OBRIGATORIO : foraDaFaixa),
    })
    .transform((bruto, ctx) => {
      const texto = typeof bruto === 'string' ? bruto.trim() : String(bruto)
      if (texto === '') {
        ctx.addIssue({ code: 'custom', message: OBRIGATORIO })
        return z.NEVER
      }
      const numero = Number(texto)
      if (!/^-?\d+$/.test(texto) || numero < min || numero > max) {
        ctx.addIssue({ code: 'custom', message: foraDaFaixa })
        return z.NEVER
      }
      return numero
    })
}

/** `AAAA-MM-DD` → `Date` à meia-noite UTC; rejeita data inexistente (`2026-02-30`). */
export const dataOpcional = z
  .string({ error: 'data inválida (use AAAA-MM-DD)' })
  .nullable()
  .optional()
  .transform((bruto, ctx) => {
    if (bruto === undefined || bruto === null) return bruto
    const texto = bruto.trim()
    if (texto === '') return null
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
    if (partes) {
      const [ano, mes, dia] = partes.slice(1).map(Number)
      const data = new Date(Date.UTC(ano, mes - 1, dia))
      if (data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia) {
        return data
      }
    }
    ctx.addIssue({ code: 'custom', message: 'data inválida (use AAAA-MM-DD)' })
    return z.NEVER
  })

/** Como `dataOpcional`, mas ausente/vazio é erro ("campo obrigatório"). */
export const dataObrigatoria = z
  .string({ error: (issue) => (issue.input === undefined || issue.input === null ? OBRIGATORIO : 'data inválida (use AAAA-MM-DD)') })
  .transform((bruto, ctx) => {
    if (bruto.trim() === '') {
      ctx.addIssue({ code: 'custom', message: OBRIGATORIO })
      return z.NEVER
    }
    const lida = dataOpcional.safeParse(bruto)
    if (!lida.success || !lida.data) {
      ctx.addIssue({ code: 'custom', message: 'data inválida (use AAAA-MM-DD)' })
      return z.NEVER
    }
    return lida.data
  })

const mensagensEmPortugues = z.locales.pt().localeError

/**
 * Lê o JSON do corpo e valida com o schema. Em erro, devolve a resposta 400
 * pronta, com a primeira mensagem do zod (`"campo: mensagem"`) em português.
 * `rotulos` troca o nome técnico do campo pelo rótulo que o usuário vê na tela
 * (`{ dataFim: 'Fim da vigência' }`); campo sem rótulo sai com o nome técnico.
 */
export async function lerCorpo<S extends z.ZodType>(
  request: Request,
  schema: S,
  rotulos: Record<string, string> = {}
): Promise<{ dados: z.output<S> } | { erro: NextResponse }> {
  let corpo: unknown
  try {
    corpo = await request.json()
  } catch {
    return { erro: NextResponse.json({ error: 'corpo da requisição inválido' }, { status: 400 }) }
  }

  const resultado = schema.safeParse(corpo, { error: mensagensEmPortugues })
  if (!resultado.success) {
    const [primeiro] = resultado.error.issues
    const caminho = primeiro.path.join('.')
    const campo = rotulos[caminho] ?? caminho
    const mensagem = campo ? `${campo}: ${primeiro.message}` : primeiro.message
    return { erro: NextResponse.json({ error: mensagem }, { status: 400 }) }
  }
  return { dados: resultado.data }
}
