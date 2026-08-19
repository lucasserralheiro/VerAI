'use client'

import { useEffect, useState, type FormEvent } from 'react'

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
    <main className="space-y-6 p-8">
      <h1 className="text-xl font-semibold">Usuários</h1>

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
        <label className="flex flex-col gap-1">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            className="rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Perfil
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border p-1">
            <option value="uploader">Uploader</option>
            <option value="responsavel">Responsável</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit" className="rounded bg-black px-3 py-1.5 text-white">
          Criar usuário
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        Clientes permitidos são atribuídos depois de criar o usuário, na tabela abaixo.
      </p>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nome</th>
            <th>E-mail</th>
            <th>Perfil</th>
            <th>Clientes permitidos</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id} className="border-b align-top">
              <td className="py-2">{usuario.nome}</td>
              <td>{usuario.email}</td>
              <td>{usuario.role}</td>
              <td>
                {usuario.role === 'admin' ? (
                  <span className="text-xs text-muted-foreground">Todos (admin)</span>
                ) : (
                  <>
                    <div className="flex max-w-xs flex-wrap gap-2">
                      {clientes.map((cliente) => (
                        <label key={cliente.id} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={(edicoes[usuario.id] ?? []).includes(cliente.id)}
                            onChange={() =>
                              setEdicoes({
                                ...edicoes,
                                [usuario.id]: toggleSelecionado(edicoes[usuario.id] ?? [], cliente.id),
                              })
                            }
                          />
                          {cliente.nome}
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() => handleSalvarClientes(usuario.id)}
                      className="mt-1 text-blue-600 hover:underline"
                    >
                      Salvar clientes
                    </button>
                  </>
                )}
              </td>
              <td>
                <button onClick={() => handleExcluir(usuario.id)} className="text-red-600 hover:underline">
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
