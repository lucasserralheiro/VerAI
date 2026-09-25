import { prisma } from '@/lib/prisma'

import { PASTA_ENVIADOS, PASTA_FORA, type ArquivoNaPasta, type PastasDoCliente } from './tipos-cadastro'

// As pastas do cliente para a janela "Pastas do cliente" do ConfereAI
// (docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md §3.5): o caminho que a sincronização
// do SharePoint já guarda em `ArquivoSharepoint.caminho`, sem a pasta do próprio cliente. É só uma
// vista — nada aqui cria pasta nem guarda caminho (a decisão de 23/09/2026, nenhuma árvore de pastas
// paralela no VerAI, continua valendo).

function pastasDoCaminho(caminho: string): string[] {
  return caminho.split('/').filter(Boolean).slice(0, -1)
}

export async function pastasDoCliente(clienteId: string): Promise<PastasDoCliente | null> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nome: true, siglaLegado: true },
  })
  if (!cliente) return null
  const arquivos = await prisma.arquivoCliente.findMany({
    where: { clienteId, removidoEm: null },
    select: {
      id: true,
      nome: true,
      extensao: true,
      categoria: true,
      sharepoint: { select: { caminho: true, removidoNaOrigemEm: true } },
    },
    orderBy: { nome: 'asc' },
  })

  // A pasta do cliente é a primeira pasta que mais aparece nos caminhos ("CGM"). Publicação roteada de
  // outra pasta da biblioteca ("1. PUBLICAÇÕES NO DOC") fica com o caminho inteiro.
  const vezes = new Map<string, number>()
  for (const arquivo of arquivos) {
    for (const { caminho } of arquivo.sharepoint) {
      const primeira = caminho.split('/').filter(Boolean)[0]
      if (primeira) vezes.set(primeira, (vezes.get(primeira) ?? 0) + 1)
    }
  }
  const raiz = [...vezes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const lista: ArquivoNaPasta[] = []
  for (const arquivo of arquivos) {
    const base = { arquivoId: arquivo.id, nome: arquivo.nome, extensao: arquivo.extensao, categoria: arquivo.categoria }
    const noSharepoint = arquivo.sharepoint.filter((sp) => !sp.removidoNaOrigemEm)
    if (noSharepoint.length === 0) {
      lista.push({ ...base, pasta: [arquivo.sharepoint.length > 0 ? PASTA_FORA : PASTA_ENVIADOS] })
      continue
    }
    for (const { caminho } of noSharepoint) {
      const pastas = pastasDoCaminho(caminho)
      lista.push({ ...base, pasta: pastas[0] === raiz ? pastas.slice(1) : pastas })
    }
  }
  return { cliente: { id: cliente.id, nome: cliente.nome, sigla: cliente.siglaLegado }, arquivos: lista }
}
