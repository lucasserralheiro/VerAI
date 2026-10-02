import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { clientesVisiveisWhere } from '@/lib/visibilidade'
import { exigirUsuario, verificarAcessoCliente, type ModoAcesso } from '@/lib/relatorios-clientes/acesso'
import { chaveExata } from '@/lib/relatorios-clientes/vincular-itens'
import { chaveDoSei } from '@/lib/relatorios-clientes/sei'

/** Item importado sem contrato não tem cliente pra checar: vê (e reconcilia) quem é admin ou
 *  enxerga ao menos um cliente. */
export async function podeVerItensSemContrato(usuario: AuthUser): Promise<boolean> {
  if (usuario.role === 'admin') return true
  return (await prisma.cliente.count({ where: await clientesVisiveisWhere(usuario) })) > 0
}

export const CONTRATO_NAO_ENCONTRADO = 'contrato não encontrado'

/** Autentica, acha o contrato e checa acesso pelo cliente dele (401 → 404 → 403). Usado pelas
 *  rotas `/api/contratos/[id]/...`. */
export async function carregarContratoComAcesso(request: NextRequest, id: string, modo: ModoAcesso = 'ver') {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const contrato = await prisma.contrato.findUnique({ where: { id }, select: { id: true, clienteId: true } })
  if (!contrato) return { erro: NextResponse.json({ error: CONTRATO_NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, contrato.clienteId, modo)
  return negado ? { erro: negado } : { usuario: autenticado.usuario, contrato }
}

/** 400 pronto quando o contrato informado não existe ou é de outro cliente; `null` quando pode.
 *  Usado por termo de confirmação e faturamento, que apontam pra um contrato do próprio cliente. */
export async function contratoForaDoCliente(contratoId: string, clienteId: string): Promise<NextResponse | null> {
  const contrato = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { clienteId: true } })
  if (contrato?.clienteId === clienteId) return null
  const mensagem = contrato ? 'Contrato: não pertence a este cliente' : 'Contrato: não encontrado'
  return NextResponse.json({ error: mensagem }, { status: 400 })
}

/** 409 pronto quando o cliente já tem OUTRO contrato com o mesmo nº do termo — pela mesma chave
 *  tolerante do vínculo de itens (`chaveExata`: "031/SEME/2017" = "31/seme/2017"). Dois contratos com
 *  o mesmo número ficam indistinguíveis nos seletores (faturamento, termo) e os itens do legado
 *  viram "ambíguos" e não se ligam a nenhum. `null` quando pode. */
export async function numeroTermoRepetido(
  clienteId: string,
  numeroTermo: string,
  ignorarContratoId?: string
): Promise<NextResponse | null> {
  const chave = chaveExata(numeroTermo)
  if (!chave) return null
  const doCliente =
    (await prisma.contrato.findMany({ where: { clienteId }, select: { id: true, numeroTermo: true } })) ?? []
  const igual = doCliente.find((c) => c.id !== ignorarContratoId && chaveExata(c.numeroTermo) === chave)
  if (!igual) return null
  return NextResponse.json(
    { error: `Nº do termo: este cliente já tem o contrato "${igual.numeroTermo}" com o mesmo número` },
    { status: 409 }
  )
}

/** "Link do SEI" do contrato = link do processo SEI DO CLIENTE (decisão do usuário, 23/09/2026): vai
 *  pra tabela de links por número (`LinkSei`), a mesma do ícone de corrente do `SeiLink`. Só quando a
 *  requisição manda `linkSei` de propósito (a tela do contrato não manda mais — o link se cadastra no
 *  próprio número); aí atualiza o link daquele número. */
export async function gravarLinkSeiDoCliente(seiCliente: string | null | undefined, url: string | null | undefined) {
  const digitos = chaveDoSei(seiCliente)
  const link = url?.trim()
  if (!digitos || !link || !/^https?:\/\//i.test(link)) return
  await prisma.linkSei.upsert({ where: { digitos }, create: { digitos, url: link }, update: { url: link } })
}
