'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import type { Saldo } from '@/lib/relatorios-clientes/saldo'
import type { SituacaoVencimento } from '@/lib/relatorios-clientes/vencimento'
import type { ResumoHistorico } from '@/lib/relatorios-clientes/resumo-historico'

export interface Contrato {
  id: string
  clienteId: string
  numeroTermo: string | null
  descricao: string | null
  seiCliente: string | null
  seiProdam: string | null
  situacao: string | null
  dataInicio: string | null
  dataVencimento: string | null
  vigente: boolean | null
  linkSei: string | null
  saldo: Saldo
  vencimento: SituacaoVencimento
  /** Fim de vigência efetivo: o maior vencimento entre o cabeçalho e o histórico (aditivo/prorrogação). */
  vigenciaFim?: string | null
  ativo?: boolean
  rescindido?: boolean
  /** Linha vazia do legado (sem número, datas, histórico...): não conta como contrato. */
  vazio?: boolean
  /** Aviso: situação "Ativo" com prazo vencido e sem prorrogação — continua ativo, a tela avisa. */
  situacaoDesatualizada?: boolean
  /** Aviso: há aditivo/prorrogação sem assinatura que estenderia o prazo — só vale depois de assinado. */
  prorrogacaoEmAndamento?: boolean
  /** Só vem da listagem (GET /api/clientes/[clienteId]/contratos); POST/PATCH não devolvem. */
  resumoHistorico?: ResumoHistorico
}

type CampoTexto = 'numeroTermo' | 'descricao' | 'seiCliente' | 'seiProdam' | 'situacao' | 'dataInicio' | 'dataVencimento'

// Mesmas duas opções do combo "Situação" do Access legado (FT_ContratosReceita).
const SITUACOES = ['Ativo', 'Finalizado'] as const

const CAMPOS: Array<{ campo: CampoTexto; rotulo: string; tipo?: string; largo?: boolean }> = [
  { campo: 'numeroTermo', rotulo: 'Nº do termo' },
  { campo: 'descricao', rotulo: 'Descrição', largo: true },
  { campo: 'situacao', rotulo: 'Situação' },
  { campo: 'seiCliente', rotulo: 'SEI cliente' },
  { campo: 'seiProdam', rotulo: 'SEI PRODAM' },
  { campo: 'dataInicio', rotulo: 'Início', tipo: 'date' },
  { campo: 'dataVencimento', rotulo: 'Vencimento', tipo: 'date' },
]

/** Criar (`contrato` ausente → POST no cliente) ou editar (PATCH /api/contratos/[id]). */
export function FormularioContrato({
  clienteId,
  contrato,
  aoSalvar,
  aoCancelar,
  rodape,
  numeroSugerido,
}: {
  clienteId: string
  contrato?: Contrato
  /** Nº do termo já preenchido ao criar (vem dos itens do legado que esperam este contrato). */
  numeroSugerido?: string
  aoSalvar: (salvo: Contrato) => void
  aoCancelar: () => void
  /** Conteúdo extra (link pro histórico, excluir...) — dentro do mesmo `card` do formulário, não
   *  como irmão fora dele, pra não abrir um vão transparente no `<dialog>` que o usa como modal. */
  rodape?: ReactNode
}) {
  const [campos, setCampos] = useState<Record<CampoTexto, string>>(() => ({
    numeroTermo: contrato?.numeroTermo ?? numeroSugerido ?? '',
    descricao: contrato?.descricao ?? '',
    seiCliente: contrato?.seiCliente ?? '',
    seiProdam: contrato?.seiProdam ?? '',
    situacao: contrato?.situacao ?? '',
    dataInicio: contrato?.dataInicio?.slice(0, 10) ?? '',
    dataVencimento: contrato?.dataVencimento?.slice(0, 10) ?? '',
  }))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      const response = await fetch(contrato ? `/api/contratos/${contrato.id}` : `/api/clientes/${clienteId}/contratos`, {
        method: contrato ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `vigente` (legado) não vai: nenhuma regra usa — quem diz se está ativo é a situação + a
        // vigência efetiva (contratos-consolidados.ts). O checkbox confundia (marcado e "vencido").
        body: JSON.stringify(campos),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao salvar contrato.')
        return
      }
      aoSalvar(await response.json())
    } catch {
      setErro('Falha de conexão ao salvar contrato.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h3 className="text-sm font-semibold text-navy">{contrato ? 'Editar contrato' : 'Novo contrato'}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CAMPOS.map(({ campo, rotulo, tipo, largo }) => (
          <label key={campo} className={`flex flex-col gap-1 text-sm ${largo ? 'lg:col-span-2' : ''}`}>
            <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
            {campo === 'situacao' ? (
              <select
                aria-label={rotulo}
                value={campos.situacao}
                onChange={(e) => setCampos((atual) => ({ ...atual, situacao: e.target.value }))}
                className={INPUT_BASE}
              >
                <option value="">—</option>
                {SITUACOES.map((situacao) => (
                  <option key={situacao} value={situacao}>
                    {situacao}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={rotulo}
                type={tipo ?? 'text'}
                value={campos[campo]}
                onChange={(e) => setCampos((atual) => ({ ...atual, [campo]: e.target.value }))}
                required={campo === 'numeroTermo'}
                className={INPUT_BASE}
              />
            )}
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
