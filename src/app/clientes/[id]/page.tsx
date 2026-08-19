'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatarCompetencia, nomeCompetencia } from '@/lib/competencia'

interface Cliente {
  id: string
  nome: string
}

interface Documento {
  competenciaAno: number
  competenciaMes: number
}

interface Competencia {
  ano: number
  mes: number
  quantidade: number
}

export default function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [competencias, setCompetencias] = useState<Competencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novoAno, setNovoAno] = useState(new Date().getFullYear())
  const [novoMes, setNovoMes] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    async function carregar() {
      const [clienteResponse, documentosResponse] = await Promise.all([
        fetch(`/api/clientes/${id}`),
        fetch(`/api/documentos?clienteId=${id}`),
      ])
      if (clienteResponse.ok) setCliente(await clienteResponse.json())
      if (documentosResponse.ok) {
        const documentos: Documento[] = await documentosResponse.json()
        const porCompetencia = new Map<string, Competencia>()
        for (const doc of documentos) {
          const chave = formatarCompetencia(doc.competenciaAno, doc.competenciaMes)
          const atual = porCompetencia.get(chave)
          porCompetencia.set(chave, {
            ano: doc.competenciaAno,
            mes: doc.competenciaMes,
            quantidade: (atual?.quantidade ?? 0) + 1,
          })
        }
        setCompetencias([...porCompetencia.values()].sort((a, b) => b.ano - a.ano || b.mes - a.mes))
      }
      setCarregando(false)
    }
    carregar()
  }, [id])

  function handleNovoMes() {
    router.push(`/clientes/${id}/${formatarCompetencia(novoAno, novoMes)}`)
  }

  if (carregando) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    )
  }

  if (!cliente) {
    return (
      <main className="p-8">
        <p className="text-sm text-red-600">Cliente não encontrado ou sem acesso.</p>
      </main>
    )
  }

  return (
    <main className="space-y-6 p-8">
      <h1 className="text-xl font-semibold">{cliente.nome}</h1>

      <div className="flex items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Ano
          <input
            type="number"
            value={novoAno}
            onChange={(e) => setNovoAno(Number(e.target.value))}
            className="w-24 rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Mês
          <select
            value={novoMes}
            onChange={(e) => setNovoMes(Number(e.target.value))}
            className="rounded border p-1"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
              <option key={mes} value={mes}>
                {mes}
              </option>
            ))}
          </select>
        </label>
        <button onClick={handleNovoMes} className="rounded border px-3 py-1.5">
          Abrir mês
        </button>
      </div>

      {competencias.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento ainda. Abra um mês pra começar.</p>
      ) : (
        <ul className="space-y-2">
          {competencias.map((c) => (
            <li key={formatarCompetencia(c.ano, c.mes)}>
              <Link
                href={`/clientes/${id}/${formatarCompetencia(c.ano, c.mes)}`}
                className="flex items-center justify-between rounded border p-3 text-sm hover:bg-gray-50"
              >
                <span>{nomeCompetencia(c.ano, c.mes)}</span>
                <span className="text-muted-foreground">{c.quantidade} documento(s)</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
