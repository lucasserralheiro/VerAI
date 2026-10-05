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
import { identificarEntidades } from '@/lib/assistente/entidades'
import { termoDoAnexo, tipoDaLinha } from '@/lib/assistente/anexos/ficha'
import type { FichaAnexo } from '@/lib/assistente/anexos/tipos'
import { termoDoTexto } from '@/lib/valores-contratos/aplicar'
import { getR2 } from '@/lib/r2'
import { tabela } from './compacto'
import { data, definirFerramenta, moeda, NAO_ENCONTRADO, semAcento } from './comum'

// Compara o documento anexado com o contrato do VerAI, campo a campo. A comparação é do código; a IA
// só lê a tabela pronta. Somente leitura.

type Situacao = 'igual' | 'parecido' | 'diferente' | 'só no anexo' | 'só no VerAI'
type LinhaComparada = { campo: string; anexo: string | null; verai: string | null; situacao: Situacao }
type ItemComparado = { codigo: string; anexo: string | null; verai: string | null; situacao: Situacao }
interface SaidaComparacao {
  anexo: string
  contrato: string
  avisos: string[]
  linhas: LinhaComparada[]
  itensDivergentes?: ItemComparado[]
  itensIguais?: number
}

const CORTE_OBJETO = 200
const MAX_AVISOS_MODELO = 5
const ORDEM_DIVERGENCIA: Situacao[] = ['diferente', 'só no anexo', 'só no VerAI']

function situacaoDe(anexo: string | null, verai: string | null, igual: () => boolean): Situacao {
  if (anexo !== null && verai === null) return 'só no anexo'
  if (anexo === null && verai !== null) return 'só no VerAI'
  return igual() ? 'igual' : 'diferente'
}

const cortar = (t: string) => (t.length > CORTE_OBJETO ? `${t.slice(0, CORTE_OBJETO)}…` : t)
const normalizarTexto = (t: string) => semAcento(t).replace(/[^a-z0-9]+/g, ' ').trim()

// Vocabulário comum de TI/contratos: não prova que o objeto é o mesmo.
const GENERICAS = new Set([
  'prestacao', 'servicos', 'servico', 'tecnologia', 'informacao', 'comunicacao', 'contratacao', 'empresa', 'especializada', 'fornecimento',
  'objeto', 'presente', 'termo', 'contrato', 'prefeitura', 'municipio', 'sao', 'paulo', 'prodam', 'para', 'com', 'dos', 'das', 'pelo', 'pela',
])

/** 'igual' só com o mesmo texto normalizado; 'parecido' se >= 80% das palavras específicas (>= 4 sobrando) do menor estão no maior. */
function situacaoDoObjeto(a: string, b: string): Situacao {
  const x = normalizarTexto(a)
  const y = normalizarTexto(b)
  if (x === y) return 'igual'
  const especificas = (t: string) => new Set(t.split(' ').filter((p) => p.length >= 4 && !GENERICAS.has(p)))
  const [pa, pb] = [especificas(x), especificas(y)]
  const [menor, maior] = pa.size <= pb.size ? [pa, pb] : [pb, pa]
  if (menor.size < 4) return 'diferente'
  return [...menor].filter((p) => maior.has(p)).length / menor.size >= 0.8 ? 'parecido' : 'diferente'
}

function decimalDe(texto: string | null | undefined): Decimal | null {
  if (!texto) return null
  const r = normalizarDecimal(texto)
  return 'valor' in r ? new Decimal(r.valor) : null
}

const iguais = (a: Decimal, b: Decimal) => a.toDecimalPlaces(2).equals(b.toDecimalPlaces(2))

/** Texto ao modelo: avisos e divergências primeiro (o corte de 8.000 caracteres tira o fim). */
function compactarComparacao(saida: unknown): string {
  const s = saida as SaidaComparacao
  const partes = [`anexo: ${s.anexo}`, `contrato: ${s.contrato}`]
  if (s.avisos.length > 0) {
    const mostrados = s.avisos.slice(0, MAX_AVISOS_MODELO)
    const resto = s.avisos.length - mostrados.length
    partes.push(`avisos: ${mostrados.join('; ')}${resto > 0 ? `; … e mais ${resto}` : ''}`)
  }
  partes.push(tabela('linhas', s.linhas as unknown as Record<string, unknown>[]))
  if (s.itensDivergentes !== undefined) {
    partes.push(tabela('itensDivergentes', s.itensDivergentes as unknown as Record<string, unknown>[]))
    partes.push(`itensIguais: ${s.itensIguais ?? 0}`)
  }
  return partes.join('\n')
}

const TIPOS_TERMO = new Set(['ADITIVO', 'PRORROGACAO'])
const SELECT_LINHA = { id: true, tipo: true, numero: true, data: true, valor: true, dataInicio: true, dataVencimento: true } as const

/**
 * Linha do histórico do mesmo termo (spec 2026-10-02-assistente-anexos §6): a que tem o mesmo arquivo
 * (`linhaHistoricoId`, pelo SHA-256) ou, para aditivo/prorrogação, a ÚNICA com a mesma identidade espécie + nº
 * (`termoDoTexto`, o de valores-contratos). `null` = comparar com o contrato; `'nao-encontrada'` = é termo,
 * mas a linha não casou (compara com o contrato, com aviso).
 */
async function linhaDoTermoNoHistorico(contratoId: string, nome: string, ficha: FichaAnexo | null | undefined) {
  const tipoLinha = ficha?.tipoLinha ?? (ficha?.tipo === 'termo' ? tipoDaLinha(nome, '') : null)
  const ehTermo = tipoLinha === 'ADITIVO' || tipoLinha === 'PRORROGACAO'
  const linhaId = ficha?.linhaHistoricoId ?? null
  if (!ehTermo && !linhaId) return null
  const linhas = await prisma.historicoContrato.findMany({ where: { contratoId }, select: SELECT_LINHA })
  const peloArquivo = linhaId ? linhas.find((l) => l.id === linhaId) : undefined
  if (peloArquivo) return TIPOS_TERMO.has(peloArquivo.tipo) ? peloArquivo : null
  if (!ehTermo) return null
  const identidade = ficha?.termo ?? termoDoAnexo(nome, '')
  if (identidade && identidade !== 'TC0') {
    const casadas = linhas.filter((l) => TIPOS_TERMO.has(l.tipo) && termoDoTexto(l.numero) === identidade)
    if (casadas.length === 1) return casadas[0]
  }
  return 'nao-encontrada' as const
}

export const compararAnexoComContrato = definirFerramenta({
  descricao:
    'Compara o documento anexado com o contrato do VerAI, campo a campo (valor, início, fim, objeto e itens). Use para "bate com o contrato?", "o que mudou?", "esse aditivo confere?". O contrato é, nesta ordem: contratoId, numero (o nº do contrato como aparece, ex. o que você achou no documento ou na conversa) ou o que a ficha do anexo identificou. A comparação é feita pelo código; a tabela devolvida é o resultado. Situações: igual, diferente, só no anexo, só no VerAI e, só no objeto, parecido: o objeto é semelhante, confira o texto. Dos itens vêm só as divergências e a contagem dos iguais.',
  entrada: z.object({
    anexoId: z.string().min(1).describe('id do anexo (vem de anexosDaConversa)'),
    contratoId: z.string().min(1).optional().describe('contrato a comparar; sem ele, o numero ou o que a ficha do anexo identificou'),
    numero: z.string().min(1).max(80).optional().describe('nº do contrato como texto, quando não há contratoId; só vale se for único entre os contratos visíveis'),
  }),
  compactar: compactarComparacao,
  async executar({ anexoId, contratoId, numero }, { usuario, hoje }) {
    const anexo = await anexoDoUsuario(anexoId, usuario)
    if (!anexo) return NAO_ENCONTRADO
    const ficha = anexo.ficha
    let alvo = contratoId
    if (!alvo && numero) {
      const ent = await identificarEntidades({ pergunta: numero, usuario, recentes: [] })
      if (ent.contratos.length !== 1) return { erro: `contrato ${numero} não encontrado (ou mais de um com esse número): passe o contratoId` }
      alvo = ent.contratos[0].id
    }
    alvo = alvo ?? ficha?.contratoId ?? undefined
    if (!alvo) return { erro: 'diga qual contrato comparar (não achei o contrato no documento)' }

    const contrato = await prisma.contrato.findUnique({ where: { id: alvo }, select: SELECT_CONTRATO })
    if (!contrato || !(await podeVerCliente(usuario, contrato.clienteId))) return NAO_ENCONTRADO
    const consolidado = (await consolidarContratos([contrato], hoje)).get(contrato.id)
    if (!consolidado) return NAO_ENCONTRADO

    const avisos: string[] = []
    const campos = ficha?.campos ?? {}
    const linhas: LinhaComparada[] = []

    // Termo aditivo/prorrogação: o lado do VerAI é a LINHA do mesmo termo no histórico, não o contrato.
    const linhaDoTermo = await linhaDoTermoNoHistorico(contrato.id, anexo.nome, ficha)
    if (linhaDoTermo === 'nao-encontrada') avisos.push('comparado com o contrato (linha do termo não encontrada)')
    const termo = linhaDoTermo && linhaDoTermo !== 'nao-encontrada' ? linhaDoTermo : null

    // Valor
    const valorFicha = campos.valorTotal?.valor ?? null
    const decFicha = decimalDe(valorFicha)
    const decVerai = termo ? (termo.valor !== null ? new Decimal(termo.valor.toString()) : null) : consolidado.valorBase ? new Decimal(consolidado.valorBase) : null
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
    const inicioVerai = dataVerai(termo ? termo.dataInicio : contrato.dataInicio)
    linhas.push({ campo: 'Início', anexo: inicioAnexo, verai: inicioVerai, situacao: situacaoDe(inicioAnexo, inicioVerai, () => inicioAnexo === inicioVerai) })
    const fimAnexo = campos.vigenciaFim?.valor ?? null
    const fimVerai = dataVerai(termo ? termo.dataVencimento : consolidado.vigenciaFim)
    linhas.push({ campo: 'Fim', anexo: fimAnexo, verai: fimVerai, situacao: situacaoDe(fimAnexo, fimVerai, () => fimAnexo === fimVerai) })
    const assinaturaAnexo = campos.assinatura?.valor ?? null
    if (termo && assinaturaAnexo !== null) {
      const assinaturaVerai = dataVerai(termo.data)
      linhas.push({
        campo: 'Assinatura', anexo: assinaturaAnexo, verai: assinaturaVerai,
        situacao: situacaoDe(assinaturaAnexo, assinaturaVerai, () => assinaturaAnexo === assinaturaVerai),
      })
    }

    // Objeto
    const objAnexo = campos.objeto?.valor?.trim() || null
    const objVerai = contrato.descricao?.trim() || null
    const situacaoObjeto = objAnexo !== null && objVerai !== null ? situacaoDoObjeto(objAnexo, objVerai) : situacaoDe(objAnexo, objVerai, () => false)
    linhas.push({
      campo: 'Objeto',
      anexo: objAnexo === null ? null : cortar(objAnexo),
      verai: objVerai === null ? null : cortar(objVerai),
      situacao: situacaoObjeto,
    })

    const nomeContrato = contrato.numeroTermo ?? contrato.id
    const saida: SaidaComparacao = {
      anexo: anexo.nome, contrato: termo ? `${nomeContrato} · ${termo.numero ?? termo.tipo}` : nomeContrato, avisos, linhas,
    }

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
        const repetidos = new Set<string>()
        const repetido = (codigo: string) => {
          if (repetidos.has(codigo)) return
          repetidos.add(codigo)
          // vira um aviso só, depois dos mais graves
        }
        const porCodigo = new Map<string, (typeof doContrato)[number]>()
        let semCodigo = 0
        for (const i of doContrato) {
          const codigo = i.descricao ? CODIGO_SERVICO.exec(i.descricao)?.[0] : undefined
          if (!codigo) semCodigo++
          else if (porCodigo.has(codigo)) repetido(codigo)
          else porCodigo.set(codigo, i)
        }
        const itens: ItemComparado[] = []
        const vistos = new Set<string>()
        let ilegiveis = 0
        const valorLegivel = (dec: Decimal | null) => {
          if (!dec) ilegiveis++
          return dec ? moeda(dec.toFixed(2)) : null
        }
        for (const a of doAnexo) {
          if (vistos.has(a.codigo)) {
            repetido(a.codigo)
            continue
          }
          vistos.add(a.codigo)
          const v = porCodigo.get(a.codigo)
          if (!v) {
            itens.push({ codigo: a.codigo, anexo: valorLegivel(decimalDe(a.unitario ?? a.total)), verai: null, situacao: 'só no anexo' })
            continue
          }
          // Unitário; sem unitário no anexo, o total.
          const usarUnitario = !!decimalDe(a.unitario) && v.valorUnitario !== null
          const decA = decimalDe(usarUnitario ? a.unitario : a.total)
          const decV = new Decimal((usarUnitario ? v.valorUnitario : v.valorTotal)!.toString())
          itens.push({
            codigo: a.codigo,
            anexo: valorLegivel(decA),
            verai: moeda(decV.toFixed(2)),
            situacao: decA && iguais(decA, decV) ? 'igual' : 'diferente',
          })
        }
        for (const [codigo, v] of porCodigo) {
          if (vistos.has(codigo)) continue
          const dec = v.valorUnitario ?? v.valorTotal
          itens.push({ codigo, anexo: null, verai: moeda(new Decimal(dec.toString()).toFixed(2)), situacao: 'só no VerAI' })
        }
        if (ilegiveis > 0) avisos.push(`${ilegiveis} item(ns) do anexo com valor ilegível`)
        if (semCodigo > 0) avisos.push(`${semCodigo} item(ns) do contrato no VerAI sem código de serviço na descrição não entraram na comparação`)
        if (repetidos.size > 0) {
          const lista = [...repetidos]
          avisos.push(`${lista.length} códigos repetidos (comparado o primeiro): ${lista.slice(0, 10).join(', ')}${lista.length > 10 ? '…' : ''}`)
        }
        saida.itensIguais = itens.filter((i) => i.situacao === 'igual').length
        saida.itensDivergentes = ORDEM_DIVERGENCIA.flatMap((s) => itens.filter((i) => i.situacao === s))
      } catch (erro) {
        console.error('[assistente] falha ao reler o anexo para comparar itens', erro)
        avisos.push('itens não comparados')
      }
    }
    return saida
  },
})
