# Exclusão e Mesclagem de Cliente (Plano 5/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir excluir um cliente sem documentos, e mesclar dois clientes duplicados preservando todo o histórico (documentos, análises consolidadas e de evolução).

**Architecture:** `DELETE /api/admin/clientes/[id]` bloqueia (`409`) se houver `Documento` vinculado. `POST /api/admin/clientes/[id]/mesclar` reatribui `clienteId` em massa (`Documento`, `AnaliseConsolidada`, `AnaliseEvolucao`) numa transação Prisma e apaga o cliente de origem — atômico, ou nada muda.

**Tech Stack:** Next.js 15 App Router, Prisma + PostgreSQL.

## Global Constraints

- Depende dos Planos 1-4 (`Cliente`, `AnaliseConsolidada`, `AnaliseEvolucao`) já mergeados.
- Sem testes automatizados pra rotas/páginas (mesma linha dos módulos 3-8).
- Convenção de commit: `git commit -m "tipo: descrição"` em português, terminando com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: `DELETE /api/admin/clientes/[id]`

**Files:**
- Create: `src/app/api/admin/clientes/[id]/route.ts`

**Interfaces:**
- Produces: `DELETE` → `{ ok: true }` ou `{ error }` (`409` se houver documento vinculado)

- [ ] **Step 1: Implementar**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const totalDocumentos = await prisma.documento.count({ where: { clienteId: id } })
  if (totalDocumentos > 0) {
    return NextResponse.json(
      {
        error: `cliente tem ${totalDocumentos} documento(s) vinculado(s) — mescle com outro cliente em vez de excluir`,
      },
      { status: 409 }
    )
  }

  await prisma.cliente.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verificar manualmente**

```bash
curl -X DELETE http://localhost:3000/api/admin/clientes/<idSemDocumentos> -H "Cookie: token-verai=<token>"
curl -X DELETE http://localhost:3000/api/admin/clientes/<idComDocumentos> -H "Cookie: token-verai=<token>"
```

Expected: primeiro retorna `200 { ok: true }`; segundo retorna `409` com a mensagem orientando a mesclar.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/clientes/[id]/route.ts"
git commit -m "feat: DELETE /api/admin/clientes/[id] (bloqueia se tiver documento)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `POST /api/admin/clientes/[id]/mesclar`

**Files:**
- Create: `src/app/api/admin/clientes/[id]/mesclar/route.ts`

**Interfaces:**
- Produces: `POST { destinoClienteId: string }` → `{ ok: true }` (`200`) ou `{ error }` (`400`/`404`/`409`)

- [ ] **Step 1: Implementar**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const destinoClienteId = body?.destinoClienteId

  if (typeof destinoClienteId !== 'string' || !destinoClienteId) {
    return NextResponse.json({ error: '"destinoClienteId" é obrigatório' }, { status: 400 })
  }
  if (destinoClienteId === id) {
    return NextResponse.json({ error: 'cliente de origem e destino não podem ser o mesmo' }, { status: 400 })
  }

  const [origem, destino] = await Promise.all([
    prisma.cliente.findUnique({ where: { id } }),
    prisma.cliente.findUnique({ where: { id: destinoClienteId } }),
  ])
  if (!origem || !destino) {
    return NextResponse.json({ error: 'cliente de origem ou destino não encontrado' }, { status: 404 })
  }

  try {
    await prisma.$transaction([
      prisma.documento.updateMany({ where: { clienteId: id }, data: { clienteId: destinoClienteId } }),
      prisma.analiseConsolidada.updateMany({ where: { clienteId: id }, data: { clienteId: destinoClienteId } }),
      prisma.analiseEvolucao.updateMany({ where: { clienteId: id }, data: { clienteId: destinoClienteId } }),
      prisma.cliente.delete({ where: { id } }),
    ])
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error:
            'o destino já tem uma análise consolidada/evolução na mesma competência que colide com a origem — resolva manualmente (apague uma das duas) antes de mesclar',
        },
        { status: 409 }
      )
    }
    throw error
  }

  return NextResponse.json({ ok: true })
}
```

Nota: a reatribuição é só de `Documento`/`AnaliseConsolidada`/`AnaliseEvolucao` — `Usuario.clientesPermitidos` não é tocado pela mesclagem (fora de escopo, seção 8 do design); se algum usuário tinha permissão só no cliente de origem, um admin reatribui manualmente em `/admin/usuarios` depois.

- [ ] **Step 2: Verificar manualmente**

Criar dois clientes de teste, subir um documento em cada, mesclar um no outro:

```bash
curl -X POST http://localhost:3000/api/admin/clientes/<origemId>/mesclar -H "Content-Type: application/json" -H "Cookie: token-verai=<token>" -d '{"destinoClienteId":"<destinoId>"}'
```

Expected: `200 { ok: true }`; `GET /api/admin/clientes` não lista mais o cliente de origem; `GET /api/documentos?clienteId=<destinoId>` mostra os documentos dos dois clientes originais.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/clientes/[id]/mesclar"
git commit -m "feat: POST /api/admin/clientes/[id]/mesclar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: UI — excluir/mesclar em `/admin/clientes`

**Files:**
- Modify: `src/app/admin/clientes/page.tsx`

**Interfaces:**
- Consumes: `DELETE /api/admin/clientes/[id]` (Task 1), `POST /api/admin/clientes/[id]/mesclar` (Task 2)

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'

interface Cliente {
  id: string
  nome: string
  createdAt: string
}

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [destinoMesclagem, setDestinoMesclagem] = useState<Record<string, string>>({})

  async function carregar() {
    const response = await fetch('/api/admin/clientes')
    if (response.ok) {
      setClientes(await response.json())
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function handleCriar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    const response = await fetch('/api/admin/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErro(body?.error ?? 'Falha ao criar cliente.')
      return
    }
    setNome('')
    carregar()
  }

  async function handleExcluir(id: string) {
    setErro(null)
    const response = await fetch(`/api/admin/clientes/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErro(body?.error ?? 'Falha ao excluir cliente.')
      return
    }
    carregar()
  }

  async function handleMesclar(id: string) {
    const destinoClienteId = destinoMesclagem[id]
    if (!destinoClienteId) return
    setErro(null)
    const response = await fetch(`/api/admin/clientes/${id}/mesclar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinoClienteId }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErro(body?.error ?? 'Falha ao mesclar cliente.')
      return
    }
    carregar()
  }

  return (
    <main className="space-y-6 p-8">
      <h1 className="text-xl font-semibold">Clientes</h1>

      <form onSubmit={handleCriar} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Nome
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="rounded border p-1"
          />
        </label>
        <button type="submit" className="rounded bg-black px-3 py-1.5 text-white">
          Criar cliente
        </button>
      </form>
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nome</th>
            <th>Criado em</th>
            <th>Mesclar com</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => (
            <tr key={cliente.id} className="border-b">
              <td className="py-2">{cliente.nome}</td>
              <td>{new Date(cliente.createdAt).toLocaleDateString('pt-BR')}</td>
              <td>
                <div className="flex items-center gap-2">
                  <select
                    value={destinoMesclagem[cliente.id] ?? ''}
                    onChange={(e) =>
                      setDestinoMesclagem({ ...destinoMesclagem, [cliente.id]: e.target.value })
                    }
                    className="rounded border p-1"
                  >
                    <option value="">Selecione...</option>
                    {clientes
                      .filter((c) => c.id !== cliente.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => handleMesclar(cliente.id)}
                    disabled={!destinoMesclagem[cliente.id]}
                    className="text-blue-600 hover:underline disabled:opacity-50"
                  >
                    Mesclar
                  </button>
                </div>
              </td>
              <td>
                <button onClick={() => handleExcluir(cliente.id)} className="text-red-600 hover:underline">
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/clientes/page.tsx
git commit -m "feat: excluir e mesclar cliente em /admin/clientes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Verificação final do plano

- [ ] `npm run build` — build limpo
- [ ] Manual: cliente sem documentos → "Excluir" funciona e some da lista
- [ ] Manual: cliente com documentos → "Excluir" mostra a mensagem de erro (409), nada é apagado
- [ ] Manual: mesclar cliente A em B → documentos de A aparecem em `/clientes/B/...`, cliente A some de `/admin/clientes`, análises consolidadas/evolução de A continuam acessíveis (agora sob B)

---

## Verificação final de todo o épico (Planos 1-5)

- [ ] `npm test` e `npm run build` limpos na ponta (todos os 5 planos aplicados em sequência)
- [ ] Fluxo completo: admin cria cliente → libera acesso a um uploader → uploader sobe 2+ documentos no mesmo cliente/mês → cada um tem sua análise individual → seleção de ambos gera análise consolidada com divergência calculada → mês seguinte com novo documento → "Comparar com mês anterior" mostra evolução real → todos os PDFs (individual, consolidado, evolução) baixam corretamente
- [ ] Nenhum número de variação/percentual no sistema inteiro vem direto da IA sem ter passado por uma função de cálculo testada (`calcularMetricasComparadas` ou `calcularEvolucao`)
