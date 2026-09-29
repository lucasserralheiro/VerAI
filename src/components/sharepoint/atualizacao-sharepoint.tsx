'use client'

// Linha "Documentos do SharePoint atualizados em …" da lista de clientes e da aba Documentos (spec
// docs/superpowers/specs/2026-09-28-sharepoint-atualizado-em-design.md) e das telas da biblioteca
// Documentos (`url="/api/biblioteca/atualizacao"`). Some quando a API falha — por exemplo, produção num
// deploy com a tela e ainda sem a migração.

import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { textoDaAtualizacao } from '@/lib/arquivos/sharepoint/atualizacao-texto'

const EXPLICACAO =
  'Os documentos vêm do SharePoint a cada 30 minutos. Passadas 2 horas sem atualização, algum documento novo pode ainda não estar aqui.'

export function AtualizacaoSharepoint({ className = '', url = '/api/sharepoint/atualizacao' }: { className?: string; url?: string }) {
  // undefined = ainda não sabe (ou a API falhou): não mostra nada.
  const [atualizadoEm, setAtualizadoEm] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let ativo = true
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((corpo) => {
        if (ativo && corpo && typeof corpo === 'object' && 'atualizadoEm' in corpo) setAtualizadoEm(corpo.atualizadoEm)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [url])

  if (atualizadoEm === undefined) return null
  const { texto, atrasada } = textoDaAtualizacao(atualizadoEm, new Date())
  const Icone = atrasada ? AlertCircle : RefreshCw
  return (
    <p
      title={EXPLICACAO}
      className={`flex items-center gap-1.5 text-xs ${atrasada ? 'text-orange-dark' : 'text-mid-grey'} ${className}`}
    >
      <Icone className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      {texto}
    </p>
  )
}
