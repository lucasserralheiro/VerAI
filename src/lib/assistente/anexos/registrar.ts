import { createHash, randomUUID } from 'node:crypto'
import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PREFIXO_R2, deleteR2, getR2 } from '@/lib/r2'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { identificarEntidades } from '../entidades'
import { semCamadaDeTexto } from '../indexacao/extrair'
import type { PaginaDeTexto } from '../indexacao/trechos'
import { ZipGrandeDemais, htmlDoAnexo, paginasDoAnexo } from './extrair'
import { fichaDoAnexo, textoDaFicha } from './ficha'
import { itensDasTabelas } from './itens'
import { FORMATOS_ANEXO, type FichaAnexo, type FormatoAnexo } from './tipos'

/** Chave do anexo no R2: sempre dentro da pasta da conversa (spec 2026-10-02-assistente-anexos). */
export const chaveDoAnexo = (conversaId: string, formato: FormatoAnexo, id: string = randomUUID()) => `assistente/${conversaId}/${id}.${formato}`

// Só `r2:assistente/<conversa>/<uuid>.<ext da lista>`: sem `/` nem `.` no id da conversa, então `..`
// e outras pastas do bucket ficam de fora.
const ENDERECO = new RegExp(
  `^r2:assistente/([A-Za-z0-9_-]{1,40})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${FORMATOS_ANEXO.join('|')})$`
)

/** Endereço que o navegador devolve depois do PUT: só vale se for da MESMA conversa. */
export function enderecoValido(endereco: string, conversaId: string): { chave: string; formato: FormatoAnexo } | null {
  const m = ENDERECO.exec(endereco)
  if (!m || m[1] !== conversaId) return null
  return { chave: endereco.slice(PREFIXO_R2.length), formato: m[2] as FormatoAnexo }
}

/** O navegador não chegou a subir o arquivo (ou o R2 não respondeu): nada é registrado. */
export class AnexoForaDoR2 extends Error {
  constructor() {
    super('arquivo não encontrado no R2')
    this.name = 'AnexoForaDoR2'
  }
}

/** Nome gravado: só o nome do arquivo, sem caminho que o navegador possa ter mandado. */
export const nomeDoArquivo = (nome: string) => nome.split(/[\\/]/).pop()!.trim()

/**
 * Lê o arquivo que o navegador subiu ao R2, grava o anexo com o texto por página e a ficha (sem IA) e
 * devolve o texto da ficha — que a rota grava como resposta direta do assistente.
 * Quem chama confere antes que a conversa é do usuário; aqui só se garante que o endereço é dela.
 */
export async function registrarAnexo(e: {
  conversaId: string
  usuario: AuthUser
  endereco: string
  nome: string
  paginasOcr?: { pagina: number; texto: string }[]
}): Promise<{ anexo: { id: string; nome: string; status: string; ficha: FichaAnexo | null }; texto: string }> {
  const alvo = enderecoValido(e.endereco, e.conversaId)
  if (!alvo) throw new Error('endereço do anexo inválido')
  const resposta = await getR2(alvo.chave).catch((erro) => {
    console.error('[assistente] falha ao baixar anexo do R2', erro)
    return null
  })
  if (!resposta?.ok) throw new AnexoForaDoR2()
  const buffer = Buffer.from(await resposta.arrayBuffer())
  const nome = nomeDoArquivo(e.nome)
  const semEntidades = { clienteId: null, cliente: null, contratoId: null, contrato: null }

  // Erro de LEITURA vira anexo com status 'erro'; erro de banco (create, entidades) fica fora deste
  // caminho e propaga — não é "arquivo ilegível".
  const gravarErro = async (erro: unknown) => {
    console.error('[assistente] falha ao ler anexo', erro)
    const motivo = erro instanceof ZipGrandeDemais ? erro.message : null
    const ficha: FichaAnexo | null = motivo
      ? { ...fichaDoAnexo({ nome, formato: alvo.formato, paginas: [], itens: [], entidades: semEntidades }), avisos: [motivo] }
      : null
    const anexo = await prisma.anexoAssistente.create({
      data: {
        conversaId: e.conversaId, nome, formato: alvo.formato, tamanhoBytes: buffer.length, chaveR2: alvo.chave, status: 'erro', paginas: 0,
        ...(ficha ? { ficha: ficha as never } : {}),
      },
      select: { id: true },
    })
    return { anexo: { id: anexo.id, nome, status: 'erro', ficha }, texto: motivo ? `Não consegui ler ${nome}: ${motivo}.` : `Não consegui ler ${nome}.` }
  }

  let lido: Awaited<ReturnType<typeof paginasDoAnexo>>
  try {
    lido = await paginasDoAnexo(buffer, alvo.formato)
  } catch (erro) {
    return gravarErro(erro)
  }

  let brutas = lido.paginas
  let ocr = false
  let paginasIlegiveis: number[] = []
  if (alvo.formato === 'pdf' && semCamadaDeTexto(brutas)) {
    // PDF escaneado: o OCR roda no navegador e chega junto com o registro.
    if (e.paginasOcr?.length) {
      ocr = true
      paginasIlegiveis = e.paginasOcr.filter((p) => !p.texto.trim()).map((p) => p.pagina)
      brutas = e.paginasOcr
    } else brutas = []
  }
  const { paginas, cortado, avisos: avisosDoTeto } = dentroDoTeto(brutas)

  // Itens só com o anexo inteiro no teto; PDF grande demais para reprocessar fica sem itens.
  const totalDePaginas = alvo.formato === 'pdf' ? Math.max(lido.paginas.length, e.paginasOcr?.length ?? 0) : paginas.length
  const pularItens = paginas.length > 0 && (cortado || (alvo.formato === 'pdf' && totalDePaginas > MAX_PAGINAS_PDF_COM_ITENS))
  const avisos = [...avisosDoTeto, ...(pularItens ? ['itens não lidos (documento grande)'] : [])]

  // A ficha só afirma cliente/contrato únicos; o "provável pelo assunto" não entra.
  const ent = await identificarEntidades({ pergunta: paginas.map((p) => p.texto).join('\n').slice(0, 3000), usuario: e.usuario, recentes: [] })
  let cliente: { id: string; nome: string; sigla: string | null } | null = ent.clientes.length === 1 ? ent.clientes[0] : null
  let contrato: { id: string; numero: string } | null = ent.contratos.length === 1 ? ent.contratos[0] : null
  // Proposta não traz o nº do contrato: o mesmo arquivo (SHA-256) numa linha do histórico identifica.
  let linhaHistoricoId: string | null = null
  if (!contrato) {
    const peloArquivo = await contratoPeloArquivo(buffer, e.usuario)
    if (peloArquivo) ({ cliente, contrato, linhaHistoricoId } = peloArquivo)
  }

  let ficha: FichaAnexo
  try {
    const html = paginas.length && !pularItens ? await htmlDoAnexo(buffer, alvo.formato).catch(() => '') : ''
    const lida = fichaDoAnexo({
      nome, formato: alvo.formato, paginas, itens: itensDasTabelas(html), anexosDoEmail: lido.anexosDoEmail, paginasIlegiveis,
      entidades: {
        clienteId: cliente?.id ?? null,
        cliente: cliente ? `${cliente.sigla ? `${cliente.sigla} – ` : ''}${cliente.nome}` : null,
        contratoId: contrato?.id ?? null,
        contrato: contrato?.numero ?? null,
      },
    })
    ficha = { ...lida, avisos: [...lida.avisos, ...avisos], ...(linhaHistoricoId ? { linhaHistoricoId } : {}) }
  } catch (erro) {
    return gravarErro(erro)
  }

  const status = paginas.length ? 'ok' : 'sem_texto'
  const anexo = await prisma.anexoAssistente.create({
    data: {
      conversaId: e.conversaId, nome, formato: alvo.formato, tamanhoBytes: buffer.length, chaveR2: alvo.chave,
      status, ocr, paginas: paginas.length, ficha: ficha as never,
      paginasTexto: { create: paginas.map((p) => ({ pagina: p.pagina, texto: p.texto })) },
    },
    select: { id: true },
  })
  return { anexo: { id: anexo.id, nome, status, ficha }, texto: textoDaFicha(nome, ficha) }
}

/**
 * Contrato pelo próprio arquivo: o anexo é byte a byte um `ArquivoCliente` (de cliente visível) que é PC/PA ou
 * TC/TA de linha do histórico — caso de quem baixa o PC do VerAI ou do SharePoint. Só quando dá UM contrato;
 * a linha só quando é uma.
 */
async function contratoPeloArquivo(
  buffer: Buffer,
  usuario: AuthUser
): Promise<{ cliente: { id: string; nome: string; sigla: string | null }; contrato: { id: string; numero: string }; linhaHistoricoId: string | null } | null> {
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const selecaoLinha = {
    select: { id: true, contrato: { select: { id: true, numeroTermo: true, cliente: { select: { id: true, nome: true, siglaLegado: true } } } } },
  }
  const arquivos = await prisma.arquivoCliente.findMany({
    where: { sha256, cliente: await clientesVisiveisWhere(usuario) },
    select: { linhasComoProposta: selecaoLinha, linhasComoTermo: selecaoLinha },
  })
  const linhas = new Map(arquivos.flatMap((a) => [...a.linhasComoProposta, ...a.linhasComoTermo]).map((l) => [l.id, l]))
  const contratos = new Set([...linhas.values()].map((l) => l.contrato.id))
  if (contratos.size !== 1) return null
  const [primeira] = linhas.values()
  const c = primeira.contrato
  return {
    cliente: { id: c.cliente.id, nome: c.cliente.nome, sigla: c.cliente.siglaLegado },
    contrato: { id: c.id, numero: c.numeroTermo ?? '(sem número)' },
    linhaHistoricoId: linhas.size === 1 ? primeira.id : null,
  }
}

/** Teto do que se grava de um anexo (páginas e caracteres no total). */
export const MAX_PAGINAS_ANEXO = 2_000
export const MAX_CARACTERES_ANEXO = 5_000_000
/** PDF acima disto não é reprocessado para tirar os itens das tabelas. */
const MAX_PAGINAS_PDF_COM_ITENS = 300

/**
 * Tira NUL (o Postgres recusa em `text`), descarta página em branco e corta no teto — primeiro em
 * páginas, depois em caracteres no total. Cortou → aviso na ficha.
 */
function dentroDoTeto(brutas: PaginaDeTexto[]): { paginas: PaginaDeTexto[]; cortado: boolean; avisos: string[] } {
  const limpas = brutas.map((p) => ({ pagina: p.pagina, texto: p.texto.replace(/\u0000/g, '') })).filter((p) => p.texto.trim())
  const paginas: PaginaDeTexto[] = []
  let caracteres = 0
  let cortado = false
  for (const p of limpas) {
    if (paginas.length >= MAX_PAGINAS_ANEXO || caracteres >= MAX_CARACTERES_ANEXO) { cortado = true; break }
    const resto = MAX_CARACTERES_ANEXO - caracteres
    const texto = p.texto.length > resto ? p.texto.slice(0, resto) : p.texto
    if (texto.length < p.texto.length) cortado = true
    paginas.push({ pagina: p.pagina, texto })
    caracteres += texto.length
    if (cortado) break
  }
  const avisos = cortado
    ? [`documento grande: lidas só as primeiras ${paginas.length} páginas / ${caracteres.toLocaleString('pt-BR')} caracteres`]
    : []
  return { paginas, cortado, avisos }
}

/** Remove do R2 os arquivos da conversa (best-effort; as linhas saem pelo Cascade do banco). */
export async function apagarAnexosDaConversa(conversaId: string): Promise<void> {
  const anexos = await prisma.anexoAssistente.findMany({ where: { conversaId }, select: { chaveR2: true } })
  await Promise.all(
    anexos.map((a) => deleteR2(a.chaveR2).catch((erro) => console.error('[assistente] falha ao apagar anexo do R2', a.chaveR2, erro)))
  )
}
