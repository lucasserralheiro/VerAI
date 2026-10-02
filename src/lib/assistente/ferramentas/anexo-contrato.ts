import Decimal from 'decimal.js'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { podeVerCliente } from '@/lib/visibilidade'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { normalizarDecimal } from '@/lib/relatorios-clientes/numero'
import { SELECT_CONTRATO } from '@/app/api/contratos/esquema'
import { anexoDoUsuario } from '@/lib/assistente/anexos/acesso'
import { htmlDoAnexo } from '@/lib/assistente/anexos/extrair'
import { CODIGO_SERVICO, itensDasTabelas } from '@/lib/assistente/anexos/itens'
import { getR2 } from '@/lib/r2'
import { data, definirFerramenta, moeda, NAO_ENCONTRADO, semAcento } from './comum'

// Compara o documento anexado com o contrato do VerAI, campo a campo. A comparação é do código; a IA
// só lê a tabela pronta. Somente leitura.

type Situacao = 'igual' | 'diferente' | 'só no anexo' | 'só no VerAI'
const CORTE_OBJETO = 200

function situacaoDe(anexo: string | null, verai: string | null, igual: () => boolean): Situacao {
  if (anexo !== null && verai === null) return 'só no anexo'
  if (anexo === null && verai !== null) return 'só no VerAI'
  return igual() ? 'igual' : 'diferente'
}

const cortar = (t: string) => (t.length > CORTE_OBJETO ? `${t.slice(0, CORTE_OBJETO)}…` : t)
const normalizarTexto = (t: string) => semAcento(t).replace(/\s+/g, ' ').trim()

/** 'igual' se um contém o outro OU se ≥ 80% das palavras de 4+ letras do menor estão no maior. */
function objetosParecidos(a: string, b: string): boolean {
  const x = normalizarTexto(a)
  const y = normalizarTexto(b)
  if (!x || !y) return false
  if (x.includes(y) || y.includes(x)) return true
  const [menor, maior] = x.length <= y.length ? [x, y] : [y, x]
  const palavras = [...new Set(menor.match(/[a-z]{4,}/g) ?? [])]
  if (palavras.length === 0) return false
  const noMaior = new Set(maior.match(/[a-z]{4,}/g) ?? [])
  return palavras.filter((p) => noMaior.has(p)).length / palavras.length >= 0.8
}

function decimalDe(texto: string | null | undefined): Decimal | null {
  if (!texto) return null
  const r = normalizarDecimal(texto)
  return 'valor' in r ? new Decimal(r.valor) : null
}

const iguais = (a: Decimal, b: Decimal) => a.toDecimalPlaces(2).equals(b.toDecimalPlaces(2))

export const compararAnexoComContrato = definirFerramenta({
  descricao:
    'Compara o documento anexado com o contrato do VerAI, campo a campo (valor, início, fim, objeto e itens). Use para "bate com o contrato?", "o que mudou?", "esse aditivo confere?". A comparação é feita pelo código; a tabela devolvida é o resultado.',
  entrada: z.object({
    anexoId: z.string().min(1).describe('id do anexo (vem de anexosDaConversa)'),
    contratoId: z.string().min(1).optional().describe('contrato a comparar; sem ele, o que a ficha do anexo identificou'),
  }),
  async executar({ anexoId, contratoId }, { usuario, hoje }) {
    const anexo = await anexoDoUsuario(anexoId, usuario)
    if (!anexo) return NAO_ENCONTRADO
    const ficha = anexo.ficha
    const alvo = contratoId ?? ficha?.contratoId
    if (!alvo) return { erro: 'diga qual contrato comparar (não achei o contrato no documento)' }

    const contrato = await prisma.contrato.findUnique({ where: { id: alvo }, select: SELECT_CONTRATO })
    if (!contrato || !(await podeVerCliente(usuario, contrato.clienteId))) return NAO_ENCONTRADO
    const consolidado = (await consolidarContratos([contrato], hoje)).get(contrato.id)
    if (!consolidado) return NAO_ENCONTRADO

    const avisos: string[] = []
    const campos = ficha?.campos ?? {}
    const linhas: { campo: string; anexo: string | null; verai: string | null; situacao: Situacao }[] = []

    // Valor
    const valorFicha = campos.valorTotal?.valor ?? null
    const decFicha = decimalDe(valorFicha)
    const decVerai = consolidado.valorBase ? new Decimal(consolidado.valorBase) : null
    if (valorFicha && !decFicha) avisos.push(`valor do anexo não pôde ser lido como número ("${valorFicha}")`)
    const valorAnexo = valorFicha === null ? null : decFicha ? moeda(decFicha.toFixed(2)) : valorFicha
    const valorVerai = decVerai ? moeda(decVerai.toFixed(2)) : null
    linhas.push({
      campo: 'Valor',
      anexo: valorAnexo,
      verai: valorVerai,
      situacao: situacaoDe(valorAnexo, valorVerai, () => !!decFicha && !!decVerai && iguais(decFicha, decVerai)),
    })

    // Datas (a ficha já vem em dd/mm/aaaa)
    const dataVerai = (d: Date | null | undefined) => (d ? data(d) : null)
    const inicioAnexo = campos.vigenciaInicio?.valor ?? null
    const inicioVerai = dataVerai(contrato.dataInicio)
    linhas.push({ campo: 'Início', anexo: inicioAnexo, verai: inicioVerai, situacao: situacaoDe(inicioAnexo, inicioVerai, () => inicioAnexo === inicioVerai) })
    const fimAnexo = campos.vigenciaFim?.valor ?? null
    const fimVerai = dataVerai(consolidado.vigenciaFim)
    linhas.push({ campo: 'Fim', anexo: fimAnexo, verai: fimVerai, situacao: situacaoDe(fimAnexo, fimVerai, () => fimAnexo === fimVerai) })

    // Objeto
    const objAnexo = campos.objeto?.valor?.trim() || null
    const objVerai = contrato.descricao?.trim() || null
    linhas.push({
      campo: 'Objeto',
      anexo: objAnexo === null ? null : cortar(objAnexo),
      verai: objVerai === null ? null : cortar(objVerai),
      situacao: situacaoDe(objAnexo, objVerai, () => objetosParecidos(objAnexo!, objVerai!)),
    })

    const saida: {
      anexo: string
      contrato: string
      linhas: typeof linhas
      itens?: { codigo: string; anexo: string | null; verai: string | null; situacao: Situacao }[]
      avisos: string[]
    } = { anexo: anexo.nome, contrato: contrato.numeroTermo, linhas, avisos }

    // Itens: não são gravados; relê o arquivo só quando a ficha achou itens.
    if ((ficha?.itens ?? 0) > 0) {
      try {
        const resposta = await getR2(anexo.chaveR2)
        if (!resposta?.ok) throw new Error('arquivo fora do R2')
        const html = await htmlDoAnexo(Buffer.from(await resposta.arrayBuffer()), anexo.formato as never)
        const doAnexo = itensDasTabelas(html)
        const doContrato = await prisma.itemContrato.findMany({
          where: { contratoId: contrato.id },
          select: { descricao: true, quantidade: true, valorUnitario: true, valorTotal: true },
        })
        const porCodigo = new Map<string, (typeof doContrato)[number]>()
        let semCodigo = 0
        for (const i of doContrato) {
          const codigo = i.descricao ? CODIGO_SERVICO.exec(i.descricao)?.[0] : undefined
          if (!codigo) semCodigo++
          else if (!porCodigo.has(codigo)) porCodigo.set(codigo, i)
        }
        const itens: NonNullable<typeof saida.itens> = []
        const vistos = new Set<string>()
        for (const a of doAnexo) {
          if (vistos.has(a.codigo)) continue
          vistos.add(a.codigo)
          const v = porCodigo.get(a.codigo)
          if (!v) {
            const dec = decimalDe(a.unitario ?? a.total)
            itens.push({ codigo: a.codigo, anexo: dec ? moeda(dec.toFixed(2)) : '—', verai: null, situacao: 'só no anexo' })
            continue
          }
          // Unitário; sem unitário no anexo, o total.
          const usarUnitario = !!decimalDe(a.unitario) && v.valorUnitario !== null
          const decA = decimalDe(usarUnitario ? a.unitario : a.total)
          const decV = new Decimal((usarUnitario ? v.valorUnitario : v.valorTotal)!.toString())
          itens.push({
            codigo: a.codigo,
            anexo: decA ? moeda(decA.toFixed(2)) : '—',
            verai: moeda(decV.toFixed(2)),
            situacao: decA && iguais(decA, decV) ? 'igual' : 'diferente',
          })
        }
        for (const [codigo, v] of porCodigo) {
          if (vistos.has(codigo)) continue
          const dec = v.valorUnitario ?? v.valorTotal
          itens.push({ codigo, anexo: null, verai: moeda(new Decimal(dec.toString()).toFixed(2)), situacao: 'só no VerAI' })
        }
        if (semCodigo > 0) avisos.push(`${semCodigo} item(ns) do contrato no VerAI sem código de serviço na descrição não entraram na comparação`)
        saida.itens = itens
      } catch (erro) {
        console.error('[assistente] falha ao reler o anexo para comparar itens', erro)
        avisos.push('itens não comparados')
      }
    }
    return saida
  },
})
