'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import { SITUACOES_FATURAMENTO, situacaoFaturamentoCanonica } from '@/lib/relatorios-clientes/situacao-faturamento'

export interface Faturamento {
  id: string
  clienteId: string
  contratoId: string
  competenciaAno: number | null
  competenciaMes: number | null
  valor: string | null
  situacao: string | null
  sei: string | null
  complementar: boolean | null
  observacao: string | null
  unidadeDestino: string | null
  enviadoCliente: boolean | null
  enviadoGfp: boolean | null
  pdfUrl: string | null
  pdfNomeArquivo: string | null
  contrato: { id: string; numeroTermo: string | null }
  valorNotas: string
  servicos: string[]
  valorExibido: string
  /** Sem valor lançado e sem nota fiscal — a tela mostra "sem nota", não R$ 0,00. */
  semNota?: boolean
}

export interface OpcaoContrato {
  id: string
  numeroTermo: string | null
}

/** Pré-preenchimento de um faturamento NOVO (ex.: "+ Lançamento" na faixa de uma competência). */
export interface ModeloFaturamento {
  competenciaAno: number
  competenciaMes: number
  contratoId?: string
}

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** `8/2026` → `08/2026`; `—` quando falta mês ou ano (dado importado incompleto). */
export function competencia(faturamento: Pick<Faturamento, 'competenciaAno' | 'competenciaMes'>): string {
  if (!faturamento.competenciaAno || !faturamento.competenciaMes) return '—'
  return `${String(faturamento.competenciaMes).padStart(2, '0')}/${faturamento.competenciaAno}`
}

type CampoTexto = 'contratoId' | 'competenciaMes' | 'competenciaAno' | 'sei' | 'unidadeDestino' | 'valor' | 'situacao' | 'observacao'
type CampoMarca = 'enviadoCliente' | 'enviadoGfp' | 'complementar'

const TEXTOS: Array<{ campo: Exclude<CampoTexto, 'contratoId' | 'competenciaMes'>; rotulo: string; largo?: boolean }> = [
  { campo: 'competenciaAno', rotulo: 'Ano' },
  { campo: 'sei', rotulo: 'SEI' },
  { campo: 'unidadeDestino', rotulo: 'Unidade destino' },
  { campo: 'valor', rotulo: 'Valor' },
  { campo: 'situacao', rotulo: 'Situação' },
  { campo: 'observacao', rotulo: 'Observação', largo: true },
]

const MARCAS: Array<{ campo: CampoMarca; rotulo: string }> = [
  { campo: 'enviadoCliente', rotulo: 'Enviado ao cliente' },
  { campo: 'enviadoGfp', rotulo: 'Enviado à GFP' },
  { campo: 'complementar', rotulo: 'Complementar (além do lançamento principal do mês)' },
]

/** Criar (`faturamento` ausente → POST no cliente) ou editar (PATCH /api/faturamentos/[id]). */
export function FormularioFaturamento({
  clienteId,
  contratos,
  faturamento,
  modelo,
  aoSalvar,
  aoCancelar,
  rodape,
}: {
  clienteId: string
  contratos: OpcaoContrato[] | null
  faturamento?: Faturamento
  modelo?: ModeloFaturamento
  aoSalvar: (salvo: Faturamento) => void
  aoCancelar: () => void
  rodape?: ReactNode
}) {
  const titulo = faturamento ? 'Editar faturamento' : 'Novo faturamento'
  const [textos, setTextos] = useState<Record<CampoTexto, string>>(() => ({
    contratoId: faturamento?.contratoId ?? modelo?.contratoId ?? '',
    competenciaMes: faturamento?.competenciaMes ? String(faturamento.competenciaMes) : modelo ? String(modelo.competenciaMes) : '',
    competenciaAno: faturamento?.competenciaAno
      ? String(faturamento.competenciaAno)
      : String(modelo?.competenciaAno ?? new Date().getFullYear()),
    sei: faturamento?.sei ?? '',
    unidadeDestino: faturamento?.unidadeDestino ?? '',
    valor: faturamento?.valor ?? '',
    situacao: faturamento?.situacao ?? '',
    observacao: faturamento?.observacao ?? '',
  }))
  const [marcas, setMarcas] = useState<Record<CampoMarca, boolean>>(() => ({
    enviadoCliente: faturamento?.enviadoCliente ?? false,
    enviadoGfp: faturamento?.enviadoGfp ?? false,
    complementar: faturamento?.complementar ?? false,
  }))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      const response = await fetch(faturamento ? `/api/faturamentos/${faturamento.id}` : `/api/clientes/${clienteId}/faturamentos`, {
        method: faturamento ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...textos, ...marcas }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao salvar faturamento.')
        return
      }
      aoSalvar(await response.json())
    } catch {
      setErro('Falha de conexão ao salvar faturamento.')
    } finally {
      setSalvando(false)
    }
  }

  const alterar = (campo: CampoTexto, valor: string) => setTextos((atual) => ({ ...atual, [campo]: valor }))

  return (
    <form aria-label={titulo} onSubmit={handleSubmit} className="card space-y-3">
      <h3 className="text-sm font-semibold text-navy">{titulo}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Contrato</span>
          <select
            aria-label="Contrato"
            value={textos.contratoId}
            onChange={(e) => alterar('contratoId', e.target.value)}
            required
            className={INPUT_BASE}
          >
            <option value="">{contratos ? 'Selecione...' : 'Carregando...'}</option>
            {contratos?.map((contrato) => (
              <option key={contrato.id} value={contrato.id}>
                {contrato.numeroTermo ?? '(sem número)'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Mês</span>
          <select
            aria-label="Mês"
            value={textos.competenciaMes}
            onChange={(e) => alterar('competenciaMes', e.target.value)}
            required
            className={INPUT_BASE}
          >
            <option value="">Selecione...</option>
            {MESES.map((nome, i) => (
              <option key={nome} value={String(i + 1)}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        {TEXTOS.map(({ campo, rotulo, largo }) => (
          <label key={campo} className={`flex flex-col gap-1 text-sm ${largo ? 'lg:col-span-2' : ''}`}>
            <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
            {campo === 'situacao' ? (
              // Lista fechada (situacao-faturamento.ts): "Cancelado" não abate saldo nem conta no faturado.
              <select aria-label={rotulo} value={textos.situacao} onChange={(e) => alterar('situacao', e.target.value)} className={INPUT_BASE}>
                <option value="">—</option>
                {textos.situacao && !situacaoFaturamentoCanonica(textos.situacao) && (
                  <option value={textos.situacao}>{textos.situacao} (antigo — escolha uma da lista)</option>
                )}
                {SITUACOES_FATURAMENTO.map((situacao) => (
                  <option key={situacao} value={situacao}>
                    {situacao}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={rotulo}
                type="text"
                inputMode={campo === 'competenciaAno' ? 'numeric' : campo === 'valor' ? 'decimal' : undefined}
                placeholder={campo === 'valor' ? 'vazio = soma das notas' : undefined}
                value={textos[campo]}
                onChange={(e) => alterar(campo, e.target.value)}
                required={campo === 'competenciaAno'}
                className={INPUT_BASE}
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-5">
        {MARCAS.map(({ campo, rotulo }) => (
          <label key={campo} className="flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={marcas[campo]}
              onChange={(e) => setMarcas((atual) => ({ ...atual, [campo]: e.target.checked }))}
              className="size-4 accent-orange"
            />
            {rotulo}
          </label>
        ))}
      </div>
      {erro && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className={BTN_PRIMARY}>
          Salvar
        </button>
        <button type="button" onClick={aoCancelar} className={BTN_OUTLINE}>
          Cancelar
        </button>
      </div>
      {rodape}
    </form>
  )
}
