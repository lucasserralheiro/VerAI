'use client'

import { useEffect, useState, type FormEvent } from 'react'

interface Usuario {
  id: string
  nome: string
  email: string
  role: string
  createdAt: string
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState('uploader')

  async function carregar() {
    const response = await fetch('/api/admin/usuarios')
    if (response.ok) {
      setUsuarios(await response.json())
    }
  }

  useEffect(() => {
    carregar()
  }, [])

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

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nome</th>
            <th>E-mail</th>
            <th>Perfil</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id} className="border-b">
              <td className="py-2">{usuario.nome}</td>
              <td>{usuario.email}</td>
              <td>{usuario.role}</td>
              <td>
                <button
                  onClick={() => handleExcluir(usuario.id)}
                  className="text-red-600 hover:underline"
                >
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
