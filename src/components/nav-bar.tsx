'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Documentos' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/notificacoes', label: 'Notificações' },
  { href: '/admin/usuarios', label: 'Usuários' },
  { href: '/admin/clientes', label: 'Gerenciar clientes' },
  { href: '/admin/regras-notificacao', label: 'Regras de notificação' },
]

export function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [naoLidas, setNaoLidas] = useState(0)

  useEffect(() => {
    if (pathname === '/login') return
    fetch('/api/notificacoes')
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: Array<{ lida: boolean }>) => setNaoLidas(lista.filter((n) => !n.lida).length))
      .catch(() => {})
  }, [pathname])

  if (pathname === '/login') {
    return null
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-4">
        <span className="font-semibold">VerAI</span>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'text-sm text-muted-foreground hover:text-foreground',
              pathname === link.href && 'font-medium text-foreground'
            )}
          >
            {link.label}
            {link.href === '/notificacoes' && naoLidas > 0 && (
              <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">
                {naoLidas}
              </span>
            )}
          </Link>
        ))}
      </div>
      <button onClick={handleLogout} className="text-sm text-muted-foreground hover:text-foreground">
        Sair
      </button>
    </nav>
  )
}
