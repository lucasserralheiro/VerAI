'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Network } from 'lucide-react'
import { LINK_NAVY } from '@/lib/ui'
import { MensagemErro, erroDaResposta } from '@/components/gerencias/comum'

interface Vinculo {
  gerenciaId: string
  papel: string
  nome: string
}

export default function MinhasGerenciasPage() {
  const router = useRouter()
  const [vinculos, setVinculos] = useState<Vinculo[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      const resposta = await fetch('/api/gerencias/minhas')
      if (!resposta.ok) return setErro(await erroDaResposta(resposta, 'Falha ao carregar as gerências.'))
      const lista = (await resposta.json()) as Vinculo[]
      if (lista.length === 1) return router.replace(`/gerencias/${lista[0].gerenciaId}`)
      setVinculos(lista)
    }
    carregar()
  }, [router])

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex items-center gap-2">
        <Network className="size-5 text-orange" strokeWidth={2.25} />
        <h1 className="text-2xl font-bold text-navy">Minhas gerências</h1>
      </div>
      <MensagemErro erro={erro} />
      {vinculos && vinculos.length === 0 && <p className="text-sm text-mid-grey">Você não está em nenhuma gerência.</p>}
      {vinculos && vinculos.length > 1 && (
        <ul className="card divide-y divide-line text-sm">
          {vinculos.map((v) => (
            <li key={v.gerenciaId} className="flex items-center justify-between py-2">
              <span className="text-navy">
                {v.nome} <span className="text-xs text-mid-grey">{v.papel === 'manager' ? 'Manager' : 'Usuário'}</span>
              </span>
              <Link href={`/gerencias/${v.gerenciaId}`} className={LINK_NAVY}>
                Abrir
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
