'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'

interface LinhaPrevia {
  linha: number
  descricao: string | null
  quantidade: string | null
  valorUnitario: string | null
  valorTotal: string
}

interface Previa {
  linhas: LinhaPrevia[]
  erros: Array<{ linha: number; mensagem: string }>
  itensExistentes: number
}

/** Importação em lote de itens por planilha: escolhe o arquivo → confere a prévia → confirma.
 *  Nada é gravado antes da confirmação, e uma planilha com qualquer erro não pode ser confirmada. */
export function ImportarPlanilhaItens({ contratoId, aoImportar }: { contratoId: string; aoImportar: () => Promise<void> }) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(confirmar: boolean) {
    if (!arquivo) return
    setErro(null)
    setEnviando(true)
    try {
      const corpo = new FormData()
      corpo.set('arquivo', arquivo)
      if (confirmar) corpo.set('confirmar', '1')
      const response = await fetch(`/api/contratos/${contratoId}/itens/importar`, { method: 'POST', body: corpo })
      const resposta = await response.json().catch(() => null)
      if (!response.ok) {
        setErro(resposta?.error ?? 'Falha ao importar a planilha.')
        return
      }
      if (resposta.confirmado) {
        setPrevia(null)
        setArquivo(null)
        await aoImportar()
      } else {
        setPrevia(resposta)
      }
    } catch {
      setErro('Falha de conexão ao importar a planilha.')
    } finally {
      setEnviando(false)
    }
  }

  function handlePrevia(event: FormEvent) {
    event.preventDefault()
    void enviar(false)
  }

  const total = previa?.linhas.reduce((soma, linha) => soma + Math.round(Number(linha.valorTotal) * 100), 0) ?? 0
  const podeConfirmar = previa !== null && previa.erros.length === 0 && previa.linhas.length > 0

  return (
    <div className="card space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-navy">Importar itens de planilha</h3>
        <p className="text-xs text-mid-grey">
          Arquivo .xlsx ou .csv. A primeira linha é o cabeçalho, com as colunas <strong>Descrição</strong> e{' '}
          <strong>Valor total</strong> (ou <strong>Quantidade</strong> e <strong>Valor unitário</strong>). Valores em
          formato brasileiro (1.234,56) são aceitos.
        </p>
      </div>
      <form onSubmit={handlePrevia} className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Planilha de itens"
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null)
            setPrevia(null)
            setErro(null)
          }}
          className={`${INPUT_BASE} max-w-sm`}
        />
        <button type="submit" disabled={!arquivo || enviando} className={BTN_OUTLINE}>
          <Upload className="size-3.5" strokeWidth={2.25} />
          Conferir planilha
        </button>
      </form>

      {erro && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}

      {previa && previa.erros.length > 0 && (
        <div role="alert" className="space-y-1 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <p className="font-medium">Corrija a planilha antes de importar:</p>
          <ul className="list-disc pl-5">
            {previa.erros.map((e, i) => (
              <li key={i}>{e.linha > 0 ? `Linha ${e.linha}: ${e.mensagem}` : e.mensagem}</li>
            ))}
          </ul>
        </div>
      )}

      {previa && previa.linhas.length > 0 && (
        <>
          <div className="max-h-72 overflow-auto">
            <table className="table-institucional">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Descrição</th>
                  <th className="text-right">Qtd</th>
                  <th className="text-right">Vl unit.</th>
                  <th className="text-right">Vl total</th>
                </tr>
              </thead>
              <tbody>
                {previa.linhas.map((linha) => (
                  <tr key={linha.linha}>
                    <td className="font-mono text-xs">{linha.linha}</td>
                    <td>{linha.descricao ?? '—'}</td>
                    <td className="text-right font-mono text-xs">{linha.quantidade ?? '—'}</td>
                    <td className="text-right font-mono text-xs whitespace-nowrap">
                      {linha.valorUnitario ? formatarMoeda(linha.valorUnitario) : '—'}
                    </td>
                    <td className="text-right font-mono text-xs whitespace-nowrap">{formatarMoeda(linha.valorTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-navy">
            <CheckCircle2 className="size-4 shrink-0" strokeWidth={2.25} />
            {previa.linhas.length} {previa.linhas.length === 1 ? 'item' : 'itens'} — total {formatarMoeda(total / 100)}
          </p>
          {previa.itensExistentes > 0 && (
            <p className="rounded-lg bg-orange-light px-3 py-2 text-sm text-orange-dark">
              Este contrato já tem {previa.itensExistentes} {previa.itensExistentes === 1 ? 'item' : 'itens'}. A importação
              acrescenta os da planilha — se você importar o mesmo arquivo duas vezes, os valores dobram.
            </p>
          )}
        </>
      )}

      {podeConfirmar && (
        <div>
          <button type="button" disabled={enviando} onClick={() => void enviar(true)} className={BTN_PRIMARY}>
            Importar {previa.linhas.length} {previa.linhas.length === 1 ? 'item' : 'itens'}
          </button>
        </div>
      )}
    </div>
  )
}
