'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PainelAssistente } from './painel-assistente'

export function AssistenteFlutuante() {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAberto((v) => !v)
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  if (pathname === '/login') return null

  return (
    <>
      {!aberto && (
        <button
          type="button"
          aria-label="Abrir assistente"
          title="Assistente VerAI (Ctrl+K)"
          onClick={() => setAberto(true)}
          className={cn(
            'fixed right-6 z-40 flex size-12 items-center justify-center rounded-full bg-navy shadow-lg shadow-navy/30 transition-transform hover:scale-105',
            // No ConfereAI os botões de download ficam no canto inferior direito.
            pathname.startsWith('/confere') ? 'bottom-24' : 'bottom-6'
          )}
        >
          <Sparkles className="size-5 text-orange" aria-hidden />
        </button>
      )}
      {aberto && <PainelAssistente rota={pathname} onFechar={() => setAberto(false)} />}
    </>
  )
}
