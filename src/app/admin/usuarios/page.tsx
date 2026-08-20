'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2, Save, UserCog, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BTN_PRIMARY, INPUT_BASE, LINK_NAVY, LINK_DANGER } from '@/lib/ui'

interface Cliente {
  id: string
  nome: string
}

interface Usuario {
  id: string
  nome: string
  email: string
  role: string
  createdAt: string
  clientesPermitidos: Cliente[]
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  responsavel: 'Responsável',
  uploader: 'Uploader',
}

const ROLE_BADGE: Record<string, 'navy-soft' | 'alert' | 'outline'> = {
  admin: 'navy-soft',
  responsavel: 'alert',
  uploader: 'outline',
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState('uploader')
  const [edicoes, setEdicoes] = useState<Record<string, string[]>>({})

  async function carregar() {
    const [usuariosResponse, clientesResponse] = await Promise.all([
      fetch('/api/admin/usuarios'),
      fetch('/api/admin/clientes'),
    ])
    if (usuariosResponse.ok) {
      const lista: Usuario[] = await usuariosResponse.json()
      setUsuarios(lista)
      setEdicoes(Object.fromEntries(lista.map((u) => [u.id, u.clientesPermitidos.map((c) => c.id)])))
    }
    if (clientesResponse.ok) {
      setClientes(await clientesResponse.json())
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  function toggleSelecionado(lista: string[], id: string): string[] {
    return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]
  }

  async function handleCriar(event: FormEvent) {
    event.preventDefault()
    await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha, role }),
    })
    setNome('')
    setEmail('')
    setSenha('')
    setRole('uploader')
    carregar()
  }

  async function handleExcluir(id: string) {
    await fetch(`/api/admin/usuarios?id=${id}`, { method: 'DELETE' })
    carregar()
  }

  async function handleSalvarClientes(id: string) {
    await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, clientesPermitidos: edicoes[id] ?? [] }),
    })
    carregar()
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex items-center gap-2">
        <UserCog className="size-5 text-orange" strokeWidth={2.25} />
        <h1 className="text-2xl font-bold text-navy">Usuários</h1>
      </div>

      <form onSubmit={handleCriar} className="card flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Nome</span>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className={INPUT_BASE}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={INPUT_BASE}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            className={INPUT_BASE}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Perfil</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={INPUT_BASE}>
            <option value="uploader">Uploader</option>
            <option value="responsavel">Responsável</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit" className={BTN_PRIMARY}>
          <Plus className="size-3.5" strokeWidth={2.25} />
          Criar usuário
        </button>
      </form>
      <p className="text-xs text-mid-grey">
        Clientes permitidos são atribuídos depois de criar o usuário, na tabela abaixo.
      </p>

      <div className="card-flush">
        <div className="overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Clientes permitidos</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="align-top">
                  <td className="py-3 font-medium text-navy">{usuario.nome}</td>
                  <td className="py-3 text-mid-grey">{usuario.email}</td>
                  <td className="py-3">
                    <Badge variant={ROLE_BADGE[usuario.role] ?? 'outline'}>{ROLE_LABEL[usuario.role] ?? usuario.role}</Badge>
                  </td>
                  <td className="py-3">
                    {usuario.role === 'admin' ? (
                      <span className="flex items-center gap-1 text-xs text-mid-grey">
                        <ShieldCheck className="size-3.5 text-navy" strokeWidth={2.25} />
                        Todos (admin)
                      </span>
                    ) : (
                      <>
                        <div className="flex max-w-xs flex-wrap gap-x-3 gap-y-1.5">
                          {clientes.map((cliente) => (
                            <label key={cliente.id} className="flex items-center gap-1.5 text-xs text-foreground">
                              <input
                                type="checkbox"
                                checked={(edicoes[usuario.id] ?? []).includes(cliente.id)}
                                onChange={() =>
                                  setEdicoes({
                                    ...edicoes,
                                    [usuario.id]: toggleSelecionado(edicoes[usuario.id] ?? [], cliente.id),
                                  })
                                }
                                className="size-3.5 accent-orange"
                              />
                              {cliente.nome}
                            </label>
                          ))}
                        </div>
                        <button
                          onClick={() => handleSalvarClientes(usuario.id)}
                          className={`${LINK_NAVY} mt-2 text-xs`}
                        >
                          <Save className="size-3" strokeWidth={2.25} />
                          Salvar clientes
                        </button>
                      </>
                    )}
                  </td>
                  <td className="py-3">
                    <button onClick={() => handleExcluir(usuario.id)} className={LINK_DANGER}>
                      <Trash2 className="size-3.5" strokeWidth={2.25} />
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
