import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { chaveDoSei } from '@/lib/relatorios-clientes/sei'

/** Todos os links de SEI cadastrados: `{ [chave do número]: url }`. É pequeno (um por processo) e a
 *  tela inteira reaproveita: cada `SeiLink` consulta este mapa em vez de pedir um por um. */
export async function GET(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const links = await prisma.linkSei.findMany({ select: { digitos: true, url: true } })
  return NextResponse.json(Object.fromEntries(links.map((l) => [l.digitos, l.url])))
}

const esquema = z.object({
  numero: z.string().trim().min(1, 'informe o número do SEI'),
  // Vazio = remover o link cadastrado.
  url: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'o link precisa começar com http:// ou https://'),
})

/** Cadastra (ou troca) o link do processo SEI — vale pra todo lugar onde o número aparece. */
export async function PUT(request: NextRequest) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const corpo = await lerCorpo(request, esquema, { numero: 'Número do SEI', url: 'Link' })
  if ('erro' in corpo) return corpo.erro

  const chave = chaveDoSei(corpo.dados.numero)
  if (!chave) return NextResponse.json({ error: 'número do SEI inválido' }, { status: 400 })

  if (corpo.dados.url === '') {
    await prisma.linkSei.deleteMany({ where: { digitos: chave } })
    return NextResponse.json({ chave, url: null })
  }
  const salvo = await prisma.linkSei.upsert({
    where: { digitos: chave },
    create: { digitos: chave, url: corpo.dados.url },
    update: { url: corpo.dados.url },
    select: { digitos: true, url: true },
  })
  return NextResponse.json({ chave: salvo.digitos, url: salvo.url })
}
