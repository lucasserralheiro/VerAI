import type { Documento } from '@prisma/client'
import { prisma } from './prisma'
import { enviarEmail } from './email'

export async function dispararNotificacoes(documento: Documento): Promise<void> {
  const regras = await prisma.regraNotificacao.findMany()

  const regrasQueBatem = regras.filter((regra) => {
    if (regra.criterioTipo === 'tipoDocumento') {
      return regra.criterioValor === documento.tipo
    }
    if (regra.criterioTipo === 'palavraChaveNome') {
      return documento.nomeArquivo.toLowerCase().includes(regra.criterioValor.toLowerCase())
    }
    return false
  })

  const destinatarios = new Set<string>()
  for (const regra of regrasQueBatem) {
    const lista = Array.isArray(regra.destinatarios) ? (regra.destinatarios as unknown[]) : []
    for (const destinatario of lista) {
      if (typeof destinatario === 'string') destinatarios.add(destinatario)
    }
  }

  if (destinatarios.size === 0) return

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const link = `${appUrl}/documentos/${documento.id}`
  const assunto = `VerAI — ${documento.nomeArquivo} (${documento.status})`
  const corpo = `O documento "${documento.nomeArquivo}" terminou de processar (status: ${documento.status}).\n\nVer análise: ${link}`

  for (const destinatario of destinatarios) {
    await prisma.notificacao.create({
      data: { documentoId: documento.id, destinatario, canal: 'dashboard', lida: false },
    })
    await prisma.notificacao.create({
      data: { documentoId: documento.id, destinatario, canal: 'email', lida: false },
    })

    try {
      await enviarEmail(destinatario, assunto, corpo)
    } catch (error) {
      console.error(`[notificacao] falha ao enviar e-mail para ${destinatario}:`, error)
    }
  }
}
