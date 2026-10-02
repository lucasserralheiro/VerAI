import { randomUUID } from 'node:crypto'
import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PREFIXO_R2, deleteR2, getR2 } from '@/lib/r2'
import { identificarEntidades } from '../entidades'
import { semCamadaDeTexto } from '../indexacao/extrair'
import { htmlDoAnexo, paginasDoAnexo } from './extrair'
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
  try {
    const lido = await paginasDoAnexo(buffer, alvo.formato)
    let paginas = lido.paginas
    let ocr = false
    let paginasIlegiveis: number[] = []
    if (alvo.formato === 'pdf' && semCamadaDeTexto(paginas)) {
      // PDF escaneado: o OCR roda no navegador e chega junto com o registro.
      if (e.paginasOcr?.length) {
        ocr = true
        paginasIlegiveis = e.paginasOcr.filter((p) => !p.texto.trim()).map((p) => p.pagina)
        paginas = e.paginasOcr.filter((p) => p.texto.trim()).map((p) => ({ pagina: p.pagina, texto: p.texto }))
      } else paginas = []
    }
    const html = paginas.length ? await htmlDoAnexo(buffer, alvo.formato).catch(() => '') : ''
    // A ficha só afirma cliente/contrato únicos; o "provável pelo assunto" não entra.
    const ent = await identificarEntidades({ pergunta: paginas.map((p) => p.texto).join('\n').slice(0, 3000), usuario: e.usuario, recentes: [] })
    const cliente = ent.clientes.length === 1 ? ent.clientes[0] : null
    const contrato = ent.contratos.length === 1 ? ent.contratos[0] : null
    const ficha = fichaDoAnexo({
      nome, formato: alvo.formato, paginas, itens: itensDasTabelas(html), anexosDoEmail: lido.anexosDoEmail, paginasIlegiveis,
      entidades: {
        clienteId: cliente?.id ?? null,
        cliente: cliente ? `${cliente.sigla ? `${cliente.sigla} – ` : ''}${cliente.nome}` : null,
        contratoId: contrato?.id ?? null,
        contrato: contrato?.numero ?? null,
      },
    })
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
  } catch (erro) {
    console.error('[assistente] falha ao ler anexo', erro)
    const anexo = await prisma.anexoAssistente.create({
      data: { conversaId: e.conversaId, nome, formato: alvo.formato, tamanhoBytes: buffer.length, chaveR2: alvo.chave, status: 'erro' },
      select: { id: true },
    })
    return { anexo: { id: anexo.id, nome, status: 'erro', ficha: null }, texto: `Não consegui ler ${nome}.` }
  }
}

/** Remove do R2 os arquivos da conversa (best-effort; as linhas saem pelo Cascade do banco). */
export async function apagarAnexosDaConversa(conversaId: string): Promise<void> {
  const anexos = await prisma.anexoAssistente.findMany({ where: { conversaId }, select: { chaveR2: true } })
  await Promise.all(
    anexos.map((a) => deleteR2(a.chaveR2).catch((erro) => console.error('[assistente] falha ao apagar anexo do R2', a.chaveR2, erro)))
  )
}
