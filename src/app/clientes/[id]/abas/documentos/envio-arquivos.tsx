'use client'

import { useState } from 'react'
import { upload } from '@vercel/blob/client'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import type { CategoriaArquivo } from '@prisma/client'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import { CATEGORIAS, sugerirCategoria } from '@/lib/arquivos/tipos'
import { caminhoTemporario } from '@/lib/arquivos/caminhos'
import { sha256DoArquivo } from '@/lib/arquivos/hash-navegador'
import { MultiFileDropzone, type ArquivoProposta } from '@/components/multi-file-dropzone'
import type { OpcaoContrato } from './tipos'

type Situacao =
  | { tipo: 'pendente' }
  | { tipo: 'enviando' }
  | { tipo: 'enviado' }
  | { tipo: 'existente'; nome: string }
  | { tipo: 'erro'; mensagem: string }

interface Classificacao {
  categoria: CategoriaArquivo
  contratoId: string
  competencia: string // AAAA-MM do <input type="month">, '' = sem competência
}

async function enviarUm(clienteId: string, file: File, c: Classificacao): Promise<Situacao> {
  const sha256 = await sha256DoArquivo(file)
  const existe = await fetch(`/api/clientes/${clienteId}/arquivos/existe?sha256=${sha256}`).then((r) => r.json())
  if (existe?.arquivo) return { tipo: 'existente', nome: existe.arquivo.nome }

  const blob = await upload(caminhoTemporario(file.name), file, {
    access: 'public',
    handleUploadUrl: '/api/arquivos/upload-token',
  })
  const [ano, mes] = c.competencia ? c.competencia.split('-').map(Number) : [null, null]
  const response = await fetch(`/api/clientes/${clienteId}/arquivos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      urlTemporaria: blob.url,
      nome: file.name,
      categoria: c.categoria,
      contratoId: c.contratoId,
      competenciaAno: ano,
      competenciaMes: mes,
    }),
  })
  const corpo = await response.json().catch(() => null)
  if (!response.ok) return { tipo: 'erro', mensagem: corpo?.error ?? 'Falha ao registrar o arquivo.' }
  return corpo.duplicado ? { tipo: 'existente', nome: corpo.arquivo.nome } : { tipo: 'enviado' }
}

export function EnvioArquivos({
  clienteId,
  contratos,
  aoConcluir,
  aoCancelar,
}: {
  clienteId: string
  contratos: OpcaoContrato[]
  aoConcluir: () => void
  aoCancelar: () => void
}) {
  const [arquivos, setArquivos] = useState<ArquivoProposta[]>([])
  const [classificacao, setClassificacao] = useState<Record<string, Classificacao>>({})
  const [situacao, setSituacao] = useState<Record<string, Situacao>>({})
  const [enviando, setEnviando] = useState(false)

  function aoMudarArquivos(novos: ArquivoProposta[]) {
    setArquivos(novos)
    setClassificacao((atual) => {
      const proximo: Record<string, Classificacao> = {}
      for (const { id, file } of novos) {
        proximo[id] = atual[id] ?? { categoria: sugerirCategoria(file.name), contratoId: '', competencia: '' }
      }
      return proximo
    })
  }

  function classificar(id: string, campo: keyof Classificacao, valor: string) {
    setClassificacao((atual) => ({ ...atual, [id]: { ...atual[id], [campo]: valor } }))
  }

  async function enviar() {
    setEnviando(true)
    let todosOk = true
    for (const { id, file } of arquivos) {
      if (situacao[id]?.tipo === 'enviado' || situacao[id]?.tipo === 'existente') continue
      setSituacao((atual) => ({ ...atual, [id]: { tipo: 'enviando' } }))
      const resultado = await enviarUm(clienteId, file, classificacao[id]).catch(
        (erro): Situacao => ({ tipo: 'erro', mensagem: erro instanceof Error ? erro.message : 'Falha no envio.' })
      )
      if (resultado.tipo === 'erro') todosOk = false
      setSituacao((atual) => ({ ...atual, [id]: resultado }))
    }
    setEnviando(false)
    if (todosOk) aoConcluir()
  }

  return (
    <div className="card space-y-4">
      <MultiFileDropzone
        arquivos={arquivos}
        onChange={aoMudarArquivos}
        accept=""
        tipoLabel="Qualquer arquivo — PDF, Excel, Word, imagem..."
        tamanhoMaximoMb={50}
        disabled={enviando}
      />

      {arquivos.map(({ id, file }) => {
        const c = classificacao[id]
        const s = situacao[id] ?? { tipo: 'pendente' }
        return (
          <fieldset key={id} role="group" aria-label={file.name} className="grid gap-2 rounded-lg border border-border-grey p-3 sm:grid-cols-4">
            <legend className="sr-only">{file.name}</legend>
            <p className="truncate text-sm font-medium text-navy sm:col-span-4">{file.name}</p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-mid-grey">Categoria</span>
              <select value={c.categoria} onChange={(e) => classificar(id, 'categoria', e.target.value)} className={INPUT_BASE} disabled={enviando}>
                {CATEGORIAS.map((cat) => (
                  <option key={cat.valor} value={cat.valor}>
                    {cat.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-mid-grey">Contrato</span>
              <select value={c.contratoId} onChange={(e) => classificar(id, 'contratoId', e.target.value)} className={INPUT_BASE} disabled={enviando}>
                <option value="">Nenhum</option>
                {contratos.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.numeroTermo ?? '(sem número)'}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-mid-grey">Competência</span>
              <input type="month" value={c.competencia} onChange={(e) => classificar(id, 'competencia', e.target.value)} className={INPUT_BASE} disabled={enviando} />
            </label>
            <div className="flex items-end text-sm">
              {s.tipo === 'enviando' && (
                <span className="flex items-center gap-1.5 text-mid-grey">
                  <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> Enviando...
                </span>
              )}
              {s.tipo === 'enviado' && (
                <span className="flex items-center gap-1.5 text-green-ok">
                  <Check className="size-4" strokeWidth={2.5} /> Enviado
                </span>
              )}
              {s.tipo === 'existente' && <span className="text-orange-dark">já está no repositório como “{s.nome}”</span>}
              {s.tipo === 'erro' && (
                <span className="flex items-center gap-1.5 text-red-crit">
                  <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
                  {s.mensagem}
                </span>
              )}
            </div>
          </fieldset>
        )
      })}

      <div className="flex gap-2">
        <button type="button" onClick={enviar} disabled={enviando || arquivos.length === 0} className={BTN_PRIMARY}>
          {`Enviar ${arquivos.length} arquivo${arquivos.length === 1 ? '' : 's'}`}
        </button>
        <button type="button" onClick={aoCancelar} disabled={enviando} className={BTN_OUTLINE}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
