import type { AuthUser } from '@/lib/auth'
import { hojeEmBrasilia } from '@/lib/calendario/tipos'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { prisma } from '@/lib/prisma'
import type { FichaAnexo } from './anexos/tipos'
import { descreverContexto, interpretarRota } from './contexto-pagina'
import { identificarEntidades } from './entidades'
import { periodoDaPergunta } from './periodos'
import { duvidaDeTrabalho, TIPO_DUVIDA_DE_TRABALHO } from './tipo-pergunta'

/** Linha de contexto que vai junto da pergunta (nunca no `system`, que é fixo para o cache). */
export async function prepararContexto(entrada: {
  usuario: AuthUser
  pergunta: string
  rota: string | null
  /** `ferramentas` gravadas nas últimas respostas do assistente, da mais recente para a mais antiga. */
  recentes: unknown[]
  hoje?: Date
  /** Conversa em andamento: seus anexos entram no contexto. */
  conversaId?: string
}): Promise<string> {
  const hoje = entrada.hoje ?? new Date()
  const hojeEmBrasil = hojeEmBrasilia(hoje)
  const [tela, entidades, anexos] = await Promise.all([
    descreverContexto(interpretarRota(entrada.rota ?? ''), entrada.usuario),
    identificarEntidades({ pergunta: entrada.pergunta, usuario: entrada.usuario, recentes: entrada.recentes }),
    descreverAnexos(entrada.conversaId, entrada.usuario.id),
  ])
  return [`Hoje é ${formatarData(hojeEmBrasil.toISOString())}.`, tela?.texto, periodoDaPergunta(entrada.pergunta, hojeEmBrasil)?.texto, entidades.texto, anexos, duvidaDeTrabalho(entrada.pergunta) ? TIPO_DUVIDA_DE_TRABALHO : null].filter(Boolean).join(' ')
}

const ROTULO_TIPO: Record<string, string> = {
  proposta: 'proposta', termo: 'termo', controle: 'controle', planilha: 'planilha',
  oficio: 'ofício', email: 'e-mail', conversa: 'conversa', outro: 'documento',
}

/** O nome vem do usuário: sem quebra de linha nem marcador de citação, e curto. */
function nomeSeguro(nome: string): string {
  return nome.replace(/[\r\n]+/g, ' ').replace(/<<<|>>>/g, '').trim().slice(0, 120)
}

async function descreverAnexos(conversaId: string | undefined, usuarioId: string): Promise<string | null> {
  if (!conversaId) return null
  const anexos = await prisma.anexoAssistente.findMany({
    where: { conversaId, conversa: { usuarioId } },
    select: { id: true, nome: true, status: true, paginas: true, ficha: true },
    orderBy: { createdAt: 'asc' },
  })
  if (anexos.length === 0) return null
  const itens = anexos.map((a) => {
    const nome = nomeSeguro(a.nome)
    if (a.status !== 'ok') return `${nome} (não lido: ${a.status})`
    const tipo = (a.ficha as FichaAnexo | null)?.tipo
    const rotulo = ROTULO_TIPO[tipo ?? ''] ?? 'documento'
    return `${nome} (anexoId: ${a.id}, ${rotulo}, ${a.paginas ?? 0} páginas)`
  })
  return `Anexos desta conversa: ${itens.join('; ')}.`
}
