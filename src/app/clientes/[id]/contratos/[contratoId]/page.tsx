'use client'

import { usePermissaoCliente } from '../../permissao-cliente'
import { use, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, Info, Loader2, Pencil } from 'lucide-react'
import { BTN_OUTLINE } from '@/lib/ui'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { BarraFaturado, PillVencimento } from '@/components/relatorios-clientes/indicadores-contrato'
import { SeiLink } from '@/components/relatorios-clientes/sei-link'
import { FormularioContrato, type Contrato } from '../formulario-contrato'
import { SecaoHistorico, type LinhaHistorico } from './secao-historico'
import { SecaoItens, type Item } from './secao-itens'
import { CartaoControle } from './cartao-controle'
import { CartaoLinks } from './cartao-links'

interface ContratoDetalhe extends Contrato {
  historico: LinhaHistorico[]
  itens: Item[]
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] font-semibold tracking-wide text-mid-grey uppercase">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  )
}

/** Ficha do contrato: vigência, os dois SEI e o resumo do histórico, em blocos rotulados — no lugar
 *  da linha corrida em monoespaçada, que misturava tudo e não deixava escanear. */
function FichaContrato({ contrato }: { contrato: ContratoDetalhe }) {
  const aditivos = contrato.historico.filter((linha) => linha.tipo === 'ADITIVO').length
  const prorrogacoes = contrato.historico.filter((linha) => linha.tipo === 'PRORROGACAO').length
  const resumo = [
    aditivos > 0 && `${aditivos} ${aditivos === 1 ? 'aditivo' : 'aditivos'}`,
    prorrogacoes > 0 && `${prorrogacoes} ${prorrogacoes === 1 ? 'prorrogação' : 'prorrogações'}`,
  ].filter(Boolean)

  return (
    <dl
      aria-label="Ficha do contrato"
      className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-xl border border-border-grey bg-white px-5 py-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4"
    >
      <Dado rotulo="Vigência">
        <span className="font-mono text-[0.8rem] whitespace-nowrap">
          {formatarData(contrato.dataInicio)} <span className="text-mid-grey">→</span> {formatarData(contrato.vigenciaFim ?? contrato.dataVencimento)}
        </span>
      </Dado>
      <Dado rotulo="SEI cliente">
        <SeiLink numero={contrato.seiCliente} className="text-[0.8rem]" />
      </Dado>
      <Dado rotulo="SEI PRODAM">
        <SeiLink numero={contrato.seiProdam} className="text-[0.8rem]" />
      </Dado>
      <Dado rotulo="Histórico">
        {resumo.length > 0 ? resumo.join(' · ') : <span className="text-mid-grey">Só o contrato original</span>}
      </Dado>
    </dl>
  )
}

function CartaoSaldo({ contrato }: { contrato: Contrato }) {
  const { saldo } = contrato
  if (saldo.saldo === null) {
    // Sem itens não há o que mostrar de saldo: uma faixa discreta em vez de um cartão inteiro.
    return (
      <section
        aria-label="Saldo do contrato"
        className="flex items-start gap-2 rounded-xl border border-orange/30 bg-orange-light/60 px-4 py-3 text-sm text-orange-dark"
      >
        <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
        <span className="font-semibold">Saldo</span>
        <p>Sem valor — nem no histórico (contrato/aditivo) nem em itens vinculados. Informe o valor no histórico ou cadastre os itens.</p>
      </section>
    )
  }
  return (
    <section aria-label="Saldo do contrato" className="card space-y-3">
      <h2 className="text-[0.95rem] font-semibold text-navy">Saldo</h2>
      <dl className="grid grid-cols-3 gap-3">
        {[
          { rotulo: 'Valor contratado', valor: saldo.valorItens },
          { rotulo: 'Faturado', valor: saldo.faturado },
          { rotulo: 'Saldo', valor: saldo.saldo },
        ].map(({ rotulo, valor }) => (
          <div key={rotulo}>
            <dt className="text-xs text-mid-grey">{rotulo}</dt>
            <dd className="font-mono text-sm font-semibold text-navy">{formatarMoeda(valor)}</dd>
          </div>
        ))}
      </dl>
      <BarraFaturado saldo={saldo} />
    </section>
  )
}

export default function ContratoDetalhePage({ params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id: clienteId, contratoId } = use(params)
  const { podeEditar } = usePermissaoCliente()
  const [contrato, setContrato] = useState<ContratoDetalhe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)

  async function carregar() {
    try {
      const response = await fetch(`/api/contratos/${contratoId}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar o contrato.')
        return
      }
      setErro(null)
      setContrato(await response.json())
    } catch {
      setErro('Falha de conexão ao carregar o contrato.')
    }
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId])

  if (carregando) {
    return (
      <main className="mx-auto max-w-[96rem] px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  if (!contrato) {
    return (
      <main className="mx-auto max-w-[96rem] px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro ?? 'Contrato não encontrado.'}
        </p>
      </main>
    )
  }

  const titulo = contrato.numeroTermo ?? '(sem número)'

  return (
    <main className="mx-auto max-w-[96rem] space-y-8 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href="/clientes" className="hover:text-navy hover:underline">
            Clientes
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href={`/clientes/${clienteId}?aba=contratos`} className="hover:text-navy hover:underline">
            Contratos
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">{titulo}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-[1.6rem] leading-tight font-semibold tracking-tight text-navy">{titulo}</h1>
              <PillVencimento vencimento={contrato.vencimento} />
              {contrato.situacao && <span className="text-sm text-mid-grey">{contrato.situacao}</span>}
              {/* Os mesmos selos da aba Contratos — a regra é a mesma (contratos-consolidados.ts). */}
              {contrato.rescindido && <span className="text-sm font-semibold text-red-crit">Rescindido</span>}
              {contrato.ativo === false &&
                !contrato.vazio &&
                !contrato.rescindido &&
                ['ok', 'atencao', 'critico'].includes(contrato.vencimento.nivel) && (
                  <span
                    className="text-sm font-semibold text-orange-dark"
                    title="A situação cadastrada diz que o contrato acabou, mas a vigência ainda está em curso. Confira o cadastro."
                  >
                    Situação × vigência: conferir
                  </span>
                )}
              {contrato.situacaoDesatualizada && (
                <span
                  className="text-sm font-semibold text-orange-dark"
                  title="A situação diz Ativo, mas o prazo venceu e não há prorrogação no histórico. O contrato continua contando como ativo — confira o cadastro: registre a prorrogação ou mude a situação."
                >
                  Situação desatualizada: prazo vencido
                </span>
              )}
              {contrato.prorrogacaoEmAndamento && (
                <span
                  className="text-sm font-semibold text-orange-dark"
                  title="Há aditivo ou prorrogação no histórico sem data de assinatura. O prazo e o valor só mudam depois de assinado — preencha 'Assinada em' na linha quando assinar."
                >
                  Prorrogação em andamento (não assinada)
                </span>
              )}
              {contrato.vazio && (
                <span className="text-sm font-semibold text-orange-dark" title="Linha vazia vinda do legado: não conta nos indicadores.">
                  Cadastro vazio
                </span>
              )}
            </div>
            {contrato.descricao && <p className="text-sm text-foreground">{contrato.descricao}</p>}
          </div>
          {podeEditar && !editando && (
            <button type="button" onClick={() => setEditando(true)} className={BTN_OUTLINE}>
              <Pencil className="size-3.5" strokeWidth={2.25} />
              Editar contrato
            </button>
          )}
        </div>
      </div>

      <FichaContrato contrato={contrato} />

      {editando && (
        <FormularioContrato
          clienteId={clienteId}
          contrato={contrato}
          aoSalvar={async () => {
            setEditando(false)
            // Recarrega tudo: mudar o nº do termo pode religar itens do legado e mudar o saldo.
            await carregar()
          }}
          aoCancelar={() => setEditando(false)}
        />
      )}

      <CartaoSaldo contrato={contrato} />
      <CartaoControle contratoId={contrato.id} />
      <CartaoLinks contratoId={contrato.id} />
      <SecaoHistorico contratoId={contrato.id} historico={contrato.historico} aoMudar={carregar} />
      <SecaoItens contratoId={contrato.id} itens={contrato.itens} aoMudar={carregar} />
    </main>
  )
}
