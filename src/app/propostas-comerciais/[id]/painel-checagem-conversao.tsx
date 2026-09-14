'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { BTN_NAVY, BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { temBlocoOcrPendente } from '@/lib/ocr/marcadorOcrPendente'
import {
  checagemIaAtual,
  iniciarChecagemIa,
  limparChecagemIa,
  marcarCorrecaoAutomaticaAplicada,
  type ResultadoChecagemIa,
  type TrechoSuspeitoIa,
} from '@/lib/checagemIaEmAndamento'
import { aplicarMudancas, mudancasDaChecagem, type Mudanca } from '@/lib/mudancasTexto'
import { OcrRunner } from './ocr-runner'
import { JanelaRevisao } from './janela-revisao'
import { ListaMudancas } from './lista-mudancas'
import { TituloSecao } from './titulo-secao'

export interface PainelChecagemConversaoProps {
  propostaId: string
  conteudoMarkdown: string
  onConteudoAtualizado: (markdown: string) => Promise<void>
  /** Abre o PDF original na página citada. Sem isso, a página é só texto.
   *  O terceiro parâmetro, quando o chamador aceita, deixa a pessoa selecionar
   *  um trecho no visualizador e devolver o texto pra cá (preenche o "No PDF"
   *  quando a checagem não achou nada pra copiar). */
  onVerPagina?: (pagina: number, destaque?: string, onUsarSelecao?: (texto: string) => void) => void
}

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronta'; resultado: ResultadoChecagemIa }
  | { fase: 'erro'; mensagem: string }

/** Correção automática já aplicada: guarda o Markdown de ANTES (`base`) e
 *  quais mudanças estão valendo — desfazer uma é recalcular do base sem ela. */
interface Aplicacao {
  base: string
  mudancas: Mudanca[]
  ativas: Set<string>
}

/**
 * Etapa 1 do painel de revisão da Proposta Comercial: OCR (`ocr-runner.tsx`)
 * primeiro, se houver `:::ocr-pendente`; depois — sozinha, sem botão — a
 * checagem por IA. Essa checagem cobre DOIS tipos de problema na mesma
 * chamada: fidelidade ao PDF original e ortografia/acentuação do Markdown
 * (a revisão de português deixou de ser uma tela e uma chamada de IA à
 * parte — virou só mais um tipo de trecho suspeito aqui).
 *
 * Quando a checagem ancora uma correção no texto do PDF original,
 * "Corrigir N automaticamente" aplica e salva na hora e mostra cada troca
 * como diff do Markdown (vermelho = como estava, verde = como ficou), com
 * "Desfazer" por item e "Desfazer todas". O desfazer só fica disponível
 * enquanto o texto é exatamente o que as correções produziram — se a pessoa
 * editar o documento depois, desfazer por cima apagaria a edição dela.
 *
 * Mora numa coluna estreita (painel lateral), então ali fica só o resumo e
 * os botões. Tudo que é comparação (prévia, correções aplicadas, trechos pra
 * conferir à mão) abre em `JanelaRevisao`: larga, uma rolagem só e antes ×
 * depois lado a lado — no painel isso virava card espremido e rolagem
 * dentro de rolagem.
 */
export function PainelChecagemConversao({
  propostaId,
  conteudoMarkdown,
  onConteudoAtualizado,
  onVerPagina,
}: PainelChecagemConversaoProps) {
  const temOcrPendente = temBlocoOcrPendente(conteudoMarkdown)
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })
  const [aplicacao, setAplicacao] = useState<Aplicacao | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [janela, setJanela] = useState<'previa' | 'aplicadas' | null>(null)
  const montado = useRef(true)
  // Pares (trecho, correção) já aplicados nesta sessão do painel — cada
  // "Auditar PDF depois das mudanças" é uma análise nova, do zero, sem
  // memória do que a pessoa já resolveu; se a IA reportar de novo algo que
  // JÁ foi corrigido por aqui, a tela não deixa reaparecer como pendente.
  const corrigidosNaSessao = useRef<Set<string>>(new Set())
  // true depois que "Corrigir N automaticamente" já foi usado nesta
  // proposta — pedido explícito: a partir daí o botão em lote some pra
  // sempre e cada correção segura passa pra "sem correção automática",
  // exigindo "Aplicar no documento" item por item (ver `razaoSemCorrecao`).
  const [correcaoAutomaticaOculta, setCorrecaoAutomaticaOculta] = useState(false)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  useEffect(() => {
    if (estado.fase === 'pronta') setCorrecaoAutomaticaOculta(estado.resultado.correcaoAutomaticaAplicada)
  }, [estado])

  function acompanhar(refazer = false) {
    setEstado({ fase: 'carregando' })
    iniciarChecagemIa(propostaId, { refazer }).then(
      (resultado) => {
        if (montado.current) setEstado({ fase: 'pronta', resultado })
      },
      (erro) => {
        if (montado.current) {
          setEstado({ fase: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível checar a conversão.' })
        }
      }
    )
  }

  useEffect(() => {
    if (temOcrPendente) return

    const atual = checagemIaAtual(propostaId)
    if (atual?.status === 'ok') {
      setEstado({ fase: 'pronta', resultado: atual.resultado })
      return
    }
    if (atual?.status === 'erro') {
      setEstado({ fase: 'erro', mensagem: atual.mensagem })
      return
    }
    acompanhar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaId, temOcrPendente])

  /** Roda a checagem inicial de novo — usado só pelo "Tentar de novo" da
   *  tela de erro (a checagem sozinha ao abrir falhou). */
  function tentarDeNovo() {
    limparChecagemIa(propostaId)
    acompanhar(true)
  }

  /** "Auditar PDF depois das mudanças": confere o Markdown ATUAL (já com
   *  edição/correção aplicada) contra o PDF, não a conversão fresca — é
   *  sobre o documento como ele está agora, pra pegar antes de enviar
   *  qualquer coisa que tenha ficado errada depois dos ajustes. */
  function auditarPosEdicao() {
    limparChecagemIa(propostaId)
    setEstado({ fase: 'carregando' })
    iniciarChecagemIa(propostaId, { refazer: true, conteudoMarkdown }).then(
      (resultado) => {
        if (montado.current) setEstado({ fase: 'pronta', resultado })
      },
      (erro) => {
        if (montado.current) {
          setEstado({
            fase: 'erro',
            mensagem: erro instanceof Error ? erro.message : 'Não foi possível auditar o documento.',
          })
        }
      }
    )
  }

  const trechos = estado.fase === 'pronta' ? estado.resultado.trechosSuspeitos : SEM_TRECHOS

  // Correções que ainda dá pra aplicar no texto atual. Enquanto uma
  // aplicação está aberta, nada novo entra — a lista mostrada é a dela.
  const disponiveisBrutas = useMemo(
    () => (aplicacao ? [] : mudancasDaChecagem(conteudoMarkdown, trechos)),
    [aplicacao, conteudoMarkdown, trechos]
  )
  // Tira o que a pessoa já aplicou por aqui nesta sessão — mesmo que a
  // auditoria mais recente tenha reportado de novo (ver `corrigidosNaSessao`
  // acima). Isto é "localizável e pronto pra aplicar", INDEPENDENTE do botão
  // em lote estar visível — usado também pra classificar item em
  // `paraConferir` quando `correcaoAutomaticaOculta` é true.
  const localizaveis = disponiveisBrutas.filter(
    (m) => !corrigidosNaSessao.current.has(`${m.antes}\u0000${m.depois}`)
  )
  // O que o botão "Corrigir N automaticamente" oferece — vazio depois que a
  // pessoa já usou o lote uma vez nesta proposta (ver `correcaoAutomaticaOculta`).
  const disponiveis = correcaoAutomaticaOculta ? [] : localizaveis

  // Esperado = o que as correções ativas produzem a partir do base. Se o
  // texto atual for diferente, a pessoa editou depois — desfazer desliga.
  const sincronizado = aplicacao
    ? conteudoMarkdown === aplicarMudancas(aplicacao.base, aplicacao.mudancas, aplicacao.ativas)
    : true

  async function gravar(texto: string) {
    setSalvando(true)
    setErroSalvar(null)
    try {
      await onConteudoAtualizado(texto)
    } catch {
      if (montado.current) {
        setErroSalvar('As correções entraram no texto, mas não foi possível salvar. Use "Tentar de novo" na barra do documento.')
      }
    } finally {
      if (montado.current) setSalvando(false)
    }
  }

  async function corrigirAutomaticamente() {
    const base = conteudoMarkdown
    const ativas = new Set(disponiveis.map((m) => m.id))
    for (const m of disponiveis) corrigidosNaSessao.current.add(`${m.antes}\u0000${m.depois}`)
    setAplicacao({ base, mudancas: disponiveis, ativas })
    await gravar(aplicarMudancas(base, disponiveis, ativas))
  }

  /** "Concluir" na leva de correções automáticas: pedido explícito — usado
   *  uma vez (e mantido, não desfeito) nesta proposta, o botão "Corrigir N
   *  automaticamente" some pra sempre a partir daqui (ver `correcaoAutomaticaOculta`).
   *  "Desfazer todas" ANTES de concluir não marca nada — a correção não ficou
   *  valendo, então não conta como "já usei o botão". */
  function concluirAplicacao() {
    if (!correcaoAutomaticaOculta) {
      setCorrecaoAutomaticaOculta(true)
      marcarCorrecaoAutomaticaAplicada(propostaId).catch(() => {})
    }
    setAplicacao(null)
  }

  async function alternar(id: string) {
    if (!aplicacao) return
    const ativas = new Set(aplicacao.ativas)
    const item = aplicacao.mudancas.find((m) => m.id === id)
    const chave = item ? `${item.antes}\u0000${item.depois}` : null
    if (ativas.has(id)) {
      ativas.delete(id)
      // Desfeita: não conta mais como corrigida — se a auditoria seguinte
      // achar de novo, é pra reaparecer mesmo.
      if (chave) corrigidosNaSessao.current.delete(chave)
    } else {
      ativas.add(id)
      if (chave) corrigidosNaSessao.current.add(chave)
    }
    setAplicacao({ ...aplicacao, ativas })
    await gravar(aplicarMudancas(aplicacao.base, aplicacao.mudancas, ativas))
  }

  async function desfazerTodas() {
    if (!aplicacao) return
    const { base } = aplicacao
    for (const m of aplicacao.mudancas) corrigidosNaSessao.current.delete(`${m.antes}\u0000${m.depois}`)
    setAplicacao(null)
    await gravar(base)
  }

  const titulo = (
    <TituloSecao icone={ShieldCheck}>
      Checagem da conversão
    </TituloSecao>
  )

  if (temOcrPendente) {
    return (
      <section className="space-y-3">
        {titulo}
        <OcrRunner
          propostaId={propostaId}
          conteudoMarkdown={conteudoMarkdown}
          onConteudoAtualizado={async (novo) => {
            limparChecagemIa(propostaId) // texto mudou (OCR conferido) — a checagem anterior não vale mais
            await onConteudoAtualizado(novo)
          }}
        />
      </section>
    )
  }

  if (estado.fase === 'carregando') {
    return (
      <section className="space-y-2">
        {titulo}
        <p className="flex items-start gap-2 text-[15px] text-mid-grey">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" strokeWidth={2.25} />
          Verificando com IA... pode sair desta aba, continua rodando.
        </p>
      </section>
    )
  }

  if (estado.fase === 'erro') {
    return (
      <section className="space-y-2">
        {titulo}
        <p className="flex items-start gap-2 text-[15px] text-red-crit">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
          {estado.mensagem}
        </p>
        <button type="button" onClick={tentarDeNovo} className={BTN_OUTLINE}>
          <RotateCw className="size-3.5" strokeWidth={2.25} />
          Tentar de novo
        </button>
      </section>
    )
  }

  const { scoreExibido, paginasComImagem, checadoEm } = estado.resultado
  const idsNaAplicacao = new Set(aplicacao?.mudancas.map((m) => m.id) ?? [])
  const idsDisponiveis = new Set(disponiveis.map((m) => m.id))
  // Lado "depois" de cada correção automática já aplicada nesta sessão — uma
  // auditoria seguinte pode relatar de novo o MESMO ponto (às vezes com
  // "trecho"/motivo diferente da vez passada) já sem correção segura, e sem
  // isso ele reapareceria pedindo conferência à mão de algo que a pessoa já
  // resolveu corrigindo automaticamente.
  const depoisJaAplicados = new Set(
    Array.from(corrigidosNaSessao.current, (chave) => chave.slice(chave.indexOf('\u0000') + 1))
  )
  // Localizável e pronto pra aplicar mas fora do botão em lote (porque
  // `correcaoAutomaticaOculta` é true) cai pra conferência manual — some do
  // grupo "sem correção automática" de mentira: a razão avisa que já vem
  // com o texto certo preenchido, só falta clicar em "Aplicar no documento".
  const idsLocalizaveis = new Set(localizaveis.map((m) => m.id))
  const paraConferir = trechos
    .map((trecho, indice) => {
      const id = `t${indice}`
      return { trecho, id, razao: razaoSemCorrecao(trecho, idsLocalizaveis.has(id)) }
    })
    .filter(
      ({ trecho, id }) =>
        !idsDisponiveis.has(id) &&
        !idsNaAplicacao.has(id) &&
        !jaCorrigido(trecho, conteudoMarkdown) &&
        !depoisJaAplicados.has(trecho.trecho)
    )
  // Os dois grupos são a mesma coisa (diferença PDF × documento) — o painel
  // mostra o total pra deixar isso claro antes de separar.
  const totalDiferencas = (aplicacao ? aplicacao.mudancas.length : disponiveis.length) + paraConferir.length

  const aplicadas = aplicacao?.ativas.size ?? 0
  const desfeitas = aplicacao ? aplicacao.mudancas.length - aplicadas : 0
  const semPendencias = !aplicacao && disponiveis.length === 0 && paraConferir.length === 0

  return (
    <section className="space-y-2.5">
      <header className="flex items-start justify-between gap-3">
        <div
          className="min-w-0 space-y-0.5"
          title="Compara cada página do PDF com o documento inteiro e revisa ortografia/acentuação"
        >
          {titulo}
          {scoreExibido === null ? (
            <p className="text-sm text-mid-grey">
              Sem páginas de texto nativo pra checar automaticamente — revise o conteúdo de OCR manualmente.
            </p>
          ) : (
            totalDiferencas > 0 && (
              <p className="text-sm text-mid-grey">
                {totalDiferencas} {totalDiferencas === 1 ? 'diferença' : 'diferenças'} entre o PDF e o documento
              </p>
            )
          )}
        </div>
        {scoreExibido !== null && <SeloConfiabilidade valor={scoreExibido} />}
      </header>

      {paginasComImagem.length > 0 && (
        <p className="flex items-start gap-2 text-sm text-navy">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-orange" strokeWidth={2.25} />
          <span>
            Página {paginasComImagem.join(', ')} {paginasComImagem.length > 1 ? 'têm' : 'tem'} imagem embutida — pode ser
            tabela ou gráfico que não virou texto. Confira no original.
          </span>
        </p>
      )}

      {scoreExibido !== null && semPendencias && (
        <p className="flex items-center gap-2 text-[15px] text-navy">
          <CircleCheck className="size-4 shrink-0 text-green-ok" strokeWidth={2.25} />
          Nenhum trecho suspeito encontrado.
        </p>
      )}

      {scoreExibido !== null && !aplicacao && disponiveis.length > 0 && (
        <div className="space-y-2 rounded-lg border border-orange/30 bg-orange-light/40 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0" title="Erro de conversão ou de português — o texto certo foi achado no PDF. Aplica sozinho e dá pra desfazer.">
              <p className="text-[15px] leading-snug font-semibold text-navy">
                {disponiveis.length} com correção automática
              </p>
              <p className="text-sm leading-snug text-mid-grey">Conversão ou português · achado no PDF · dá pra desfazer</p>
            </div>
            <button
              type="button"
              onClick={() => setJanela('previa')}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-navy-3 underline-offset-2 hover:text-orange hover:underline"
            >
              <Eye className="size-3.5" strokeWidth={2.25} />
              Ver antes
            </button>
          </div>
          <button
            type="button"
            onClick={corrigirAutomaticamente}
            className={cn(BTN_PRIMARY, 'w-full justify-center')}
            disabled={salvando}
          >
            <Sparkles className="size-3.5" strokeWidth={2.25} />
            Corrigir {disponiveis.length} automaticamente
          </button>
        </div>
      )}

      {aplicacao && (
        <div className="space-y-2 rounded-lg border border-green-ok/30 bg-green-ok-light/50 p-3">
          <p className="flex flex-wrap items-center gap-x-1.5 text-[15px] font-medium text-navy">
            <CircleCheck className="size-4 shrink-0 text-green-ok" strokeWidth={2.25} />
            {aplicadas} {aplicadas === 1 ? 'correção aplicada' : 'correções aplicadas'}
            {desfeitas > 0 && (
              <span className="font-normal text-mid-grey">
                · {desfeitas} desfeita{desfeitas > 1 ? 's' : ''}
              </span>
            )}
            {salvando && (
              <span className="inline-flex items-center gap-1 font-normal text-mid-grey">
                · <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} /> salvando...
              </span>
            )}
          </p>
          {erroSalvar && (
            <p className="flex items-start gap-2 text-sm text-red-crit">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
              {erroSalvar}
            </p>
          )}
          {!sincronizado && (
            <p className="text-sm text-navy">
              O texto foi editado depois das correções — o desfazer foi desligado pra não apagar a sua edição.
            </p>
          )}
          <button
            type="button"
            onClick={() => setJanela('aplicadas')}
            className={cn(BTN_OUTLINE, 'w-full justify-center')}
          >
            <Eye className="size-3.5" strokeWidth={2.25} />
            Conferir o que mudou
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={desfazerTodas}
              className={cn(BTN_OUTLINE, 'flex-1 justify-center')}
              disabled={salvando || !sincronizado}
            >
              Desfazer todas
            </button>
            <button
              type="button"
              onClick={concluirAplicacao}
              className={cn(BTN_OUTLINE, 'flex-1 justify-center')}
              disabled={salvando}
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {scoreExibido !== null && paraConferir.length > 0 && (
        <TrechosParaConferir
          itens={paraConferir}
          markdown={conteudoMarkdown}
          onAplicar={onConteudoAtualizado}
          onVerPagina={onVerPagina}
        />
      )}

      {!aplicacao && (
        <div className="space-y-1.5">
          {checadoEm && (
            <p className="text-sm text-mid-grey">
              Checado em{' '}
              {new Date(checadoEm).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
          <button
            type="button"
            onClick={auditarPosEdicao}
            title="Confere o documento como está AGORA contra o PDF, letra por letra e número por número — mais demorado que a checagem inicial"
            className={cn(BTN_PRIMARY, 'w-full justify-center')}
          >
            <ShieldCheck className="size-3.5" strokeWidth={2.25} />
            Auditar PDF depois das mudanças
          </button>
        </div>
      )}

      {janela === 'previa' && !aplicacao && disponiveis.length > 0 && (
        <PreviaCorrecoesAutomaticas
          mudancas={disponiveis}
          markdown={conteudoMarkdown}
          onFechar={() => setJanela(null)}
          onAplicar={onConteudoAtualizado}
          onVerPagina={onVerPagina}
          onItemAplicado={(antes, depois) => corrigidosNaSessao.current.add(`${antes}\u0000${depois}`)}
          onItemDesfeito={(antes, depois) => corrigidosNaSessao.current.delete(`${antes}\u0000${depois}`)}
        />
      )}

      {janela === 'aplicadas' && aplicacao && (
        <JanelaRevisao
          titulo={`${aplicadas} ${aplicadas === 1 ? 'correção aplicada' : 'correções aplicadas'}`}
          subtitulo={
            sincronizado
              ? 'Confira cada troca. "Desfazer" volta aquele ponto ao que estava — já salva sozinho.'
              : 'O texto foi editado depois das correções — o desfazer foi desligado pra não apagar a sua edição.'
          }
          onFechar={() => setJanela(null)}
          rodape={
            <>
              <button
                type="button"
                onClick={async () => {
                  setJanela(null)
                  await desfazerTodas()
                }}
                className={BTN_OUTLINE}
                disabled={salvando || !sincronizado}
              >
                Desfazer todas
              </button>
              <button
                type="button"
                onClick={() => {
                  setJanela(null)
                  setAplicacao(null)
                }}
                className={BTN_NAVY}
                disabled={salvando}
              >
                Concluir
              </button>
            </>
          }
        >
          <ListaMudancas
            base={aplicacao.base}
            mudancas={aplicacao.mudancas}
            ativas={aplicacao.ativas}
            onAlternar={sincronizado ? alternar : undefined}
            rotuloAntes="Como estava"
            rotuloDepois="Como ficou"
            rotuloAtiva="Desfazer"
            rotuloInativa="Aplicar de novo"
            avisoInativa="Desfeita — esse ponto ficou como estava no Markdown."
            desabilitado={salvando}
          />
        </JanelaRevisao>
      )}
    </section>
  )
}

const SEM_TRECHOS: TrechoSuspeitoIa[] = []

/** Por que um trecho ficou sem correção automática — cada caso pede uma
 *  ação diferente da pessoa, então a tela diz qual é. */
type RazaoManual = 'correcao-automatica-oculta' | 'sem-texto-no-pdf' | 'sugestao-descartada' | 'nao-localizado'

const RAZOES: Record<RazaoManual, { rotulo: string; explicacao: string; comoCorrigir: string }> = {
  'correcao-automatica-oculta': {
    rotulo: 'Correção pronta, só falta aplicar',
    explicacao:
      'Achamos e confirmamos no PDF, mas o botão "Corrigir automaticamente" some depois da primeira vez usado nesta proposta — confira e aplique aqui, um por um.',
    comoCorrigir: 'já vem preenchido com o texto certo — confira e clique em "Aplicar no documento".',
  },
  'sem-texto-no-pdf': {
    rotulo: 'Sem texto no PDF pra copiar',
    explicacao:
      'A IA viu a diferença, mas não há no PDF um texto pronto pra trocar — ex.: conteúdo que sumiu, célula de tabela, página inteira que virou tabela.',
    comoCorrigir: 'o trecho não foi achado igual no documento — compare com o PDF e ajuste direto no texto.',
  },
  'sugestao-descartada': {
    rotulo: 'Sugestão descartada por segurança',
    explicacao:
      'A IA sugeriu um texto que não aparece no PDF. Pra não arriscar palavra ou número inventado, a sugestão foi descartada.',
    comoCorrigir: 'o trecho não foi achado igual no documento — confira no PDF e ajuste direto no texto.',
  },
  'nao-localizado': {
    rotulo: 'Não encontrado no texto atual',
    explicacao:
      'Existe correção tirada do PDF, mas o trecho não aparece mais igual no documento — pode já ter sido editado.',
    comoCorrigir: 'veja se o ponto já está certo; se não, use o texto de "Como deveria ficar".',
  },
}

const ORDEM_RAZOES: RazaoManual[] = [
  'correcao-automatica-oculta',
  'sem-texto-no-pdf',
  'sugestao-descartada',
  'nao-localizado',
]

function razaoSemCorrecao(trecho: TrechoSuspeitoIa, localizavel: boolean): RazaoManual {
  if (localizavel) return 'correcao-automatica-oculta'
  // Chegou até aqui com correção = ela não achou o trecho no texto atual.
  if (trecho.correcaoSugerida) return 'nao-localizado'
  if (trecho.correcaoDescartada) return 'sugestao-descartada'
  return 'sem-texto-no-pdf'
}

type ItemManual = { trecho: TrechoSuspeitoIa; id: string; razao: RazaoManual }

/**
 * Trechos sem correção automática. No painel: quantos faltam e POR QUE
 * (cada motivo com a sua contagem). A conferência abre numa janela larga,
 * um trecho por vez, com o motivo em destaque, PDF × documento lado a lado
 * e um editor "Como vai ficar" que aplica direto no Markdown.
 *
 * O editor não troca às cegas pelo texto do PDF: o par que a IA aponta nem
 * sempre é "isto vira aquilo" (ex.: título que faltou ANTES de um parágrafo
 * — trocar apagaria o parágrafo). Por isso são três atalhos (trocar,
 * inserir antes, inserir depois) sobre um texto editável que a pessoa vê
 * antes de aplicar, e todo aplicar tem "Desfazer".
 *
 * Índice, filtro, rascunhos e aplicados moram aqui pra janela reabrir onde
 * a pessoa parou.
 */
function TrechosParaConferir({
  itens,
  markdown,
  onAplicar,
  onVerPagina,
}: {
  itens: ItemManual[]
  markdown: string
  /** Grava o Markdown novo (rejeita se falhar o salvamento). */
  onAplicar: (markdown: string) => Promise<void>
  onVerPagina?: (pagina: number, destaque?: string, onUsarSelecao?: (texto: string) => void) => void
}) {
  const [filtro, setFiltro] = useState<RazaoManual | 'todos'>('todos')
  const [indice, setIndice] = useState(0)
  const [aberta, setAberta] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({})
  // Preenchido à mão (seleção no visualizador do PDF) quando a checagem não
  // achou o texto original sozinha — some assim que o trecho muda de razão.
  const [notasPdfManual, setNotasPdfManual] = useState<Record<string, string>>({})
  const [aplicados, setAplicados] = useState<Record<string, Aplicado>>({})
  const [aplicando, setAplicando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const contagem = ORDEM_RAZOES.map((razao) => ({ razao, total: itens.filter((i) => i.razao === razao).length })).filter(
    (c) => c.total > 0
  )
  const filtroValido = filtro === 'todos' || contagem.some((c) => c.razao === filtro) ? filtro : 'todos'
  const visiveis = filtroValido === 'todos' ? itens : itens.filter((i) => i.razao === filtroValido)
  const total = visiveis.length
  // A lista encolhe quando um trecho some — não deixa o índice apontar pra fora.
  const atual = Math.min(indice, total - 1)
  const item = visiveis[atual]
  const resolvidos = itens.filter((i) => aplicados[i.id]).length
  const pendentes = itens.length - resolvidos

  function irPara(novo: number) {
    setIndice(Math.max(0, Math.min(novo, total - 1)))
    setCopiado(null)
    setErro(null)
  }

  function filtrar(novo: RazaoManual | 'todos') {
    setFiltro(novo)
    setIndice(0)
    setCopiado(null)
    setErro(null)
  }

  // Setas do teclado trocam de trecho enquanto a janela está aberta (menos
  // quando a pessoa está escrevendo no editor).
  useEffect(() => {
    if (!aberta) return
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'ArrowRight') setIndice((i) => Math.min(i + 1, total - 1))
      if (e.key === 'ArrowLeft') setIndice((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberta, total])

  async function copiar(texto: string, qual: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(qual)
      setTimeout(() => setCopiado(null), 1500)
    } catch {
      // Sem permissão de clipboard — a pessoa ainda pode selecionar e copiar.
    }
  }

  function botaoCopiar(texto: string, qual: string) {
    return (
      <button type="button" onClick={() => copiar(texto, qual)} title="Copiar pra colar no documento" className={BTN_OUTLINE_SM}>
        {copiado === qual ? (
          <Check className="size-3.5 text-green-ok" strokeWidth={2.5} />
        ) : (
          <Copy className="size-3.5" strokeWidth={2.25} />
        )}
        {copiado === qual ? 'Copiado' : 'Copiar'}
      </button>
    )
  }

  const noPdfAutomatico = item?.trecho.trechoOriginal?.trim() ? item.trecho.trechoOriginal : null
  const noPdfManual = item ? notasPdfManual[item.id]?.trim() || null : null
  // Seleção manual (a pessoa escolheu de propósito) tem prioridade sobre o
  // automático. O botão "PDF" usa esse mesmo texto — mesmo quando é o
  // fallback de página inteira: aparece em "Como vai ficar" pra pessoa ver,
  // editar (cortar só a parte certa) e SÓ DEPOIS aplicar. A revisão humana
  // antes de aplicar é a proteção, não esconder o texto do botão.
  const noPdf = noPdfManual ?? noPdfAutomatico
  const razao = item ? RAZOES[item.razao] : null
  const atualNoDoc = item?.trecho.trecho ?? ''
  // Quando já existe uma correção vetada (ancorada no PDF), o rascunho
  // começa nela — é a melhor resposta pronta. Sem isso, começa igual ao
  // documento hoje, como antes.
  const sugestaoSegura = item?.trecho.correcaoSugerida ?? null
  const rascunho = item ? (rascunhos[item.id] ?? sugestaoSegura ?? atualNoDoc) : ''
  const local = item ? localizarTrecho(markdown, atualNoDoc) : null
  const localizado = local !== null
  const ocorrencias = item ? contarOcorrencias(markdown, atualNoDoc) : 0
  const aplicado = item ? aplicados[item.id] : undefined
  const editado = rascunho !== atualNoDoc
  const modoAtivo =
    MODOS.find(({ modo }) => (modo === 'atual' || noPdf) && rascunho === textoDoModo(modo, noPdf ?? '', atualNoDoc))
      ?.modo ?? null

  function mudarRascunho(texto: string) {
    if (!item) return
    setRascunhos((r) => ({ ...r, [item.id]: texto }))
    setErro(null)
  }

  async function aplicar() {
    if (!item || !local || !editado) return
    const depois = markdown.slice(0, local.inicio) + rascunho + markdown.slice(local.inicio + local.encontrado.length)
    const id = item.id
    // Registra antes de gravar: o texto entra no documento na hora, mesmo que
    // o salvamento falhe (aí a barra do documento mostra "Tentar de novo").
    setAplicados((a) => ({ ...a, [id]: { antes: markdown, depois, novo: rascunho } }))
    setAplicando(true)
    setErro(null)
    try {
      await onAplicar(depois)
    } catch {
      setErro('Entrou no documento, mas não salvou. Use "Tentar de novo" na barra do documento.')
    } finally {
      setAplicando(false)
    }
  }

  async function desfazer() {
    if (!item || !aplicado) return
    let volta: string | null = null
    if (markdown === aplicado.depois) {
      volta = aplicado.antes
    } else if (aplicado.novo && contarOcorrencias(markdown, aplicado.novo) === 1) {
      // O documento mudou em outro ponto depois — desfaz só este trecho.
      volta = markdown.replace(aplicado.novo, () => atualNoDoc)
    }
    if (volta === null) {
      setErro('O texto mudou nesse ponto depois de aplicar — desfaça direto no documento.')
      return
    }
    const id = item.id
    setAplicando(true)
    setErro(null)
    try {
      await onAplicar(volta)
    } catch {
      setErro('Voltou no documento, mas não salvou. Use "Tentar de novo" na barra do documento.')
    } finally {
      setAplicados((a) => {
        const novo = { ...a }
        delete novo[id]
        return novo
      })
      setAplicando(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border-grey p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0" title="Sem correção automática segura — conferir e ajustar à mão.">
          <p className="text-[15px] leading-snug font-semibold text-navy">
            {pendentes === 0 ? 'Tudo conferido' : `${pendentes} sem correção automática`}
          </p>
          {resolvidos > 0 && (
            <p className="text-sm leading-snug text-mid-grey">
              {resolvidos} resolvido{resolvidos > 1 ? 's' : ''} por você
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAberta(true)}
          className={pendentes > 0 ? BTN_PRIMARY : BTN_OUTLINE}
        >
          <Eye className="size-3.5" strokeWidth={2.25} />
          {pendentes === 0 ? 'Rever' : indice > 0 || resolvidos > 0 ? 'Continuar' : 'Conferir'}
        </button>
      </div>

      <ul className="space-y-0.5 border-t border-border-grey pt-2">
        {contagem.map(({ razao: r, total: n }) => (
          <li
            key={r}
            className="flex items-baseline justify-between gap-3 text-sm leading-snug text-navy"
            title={RAZOES[r].explicacao}
          >
            <span className="min-w-0">{RAZOES[r].rotulo}</span>
            <span className="shrink-0 font-semibold tabular-nums">{n}</span>
          </li>
        ))}
      </ul>

      {aberta && item && razao && (
        <JanelaRevisao
          titulo={
            pendentes === 0
              ? 'Tudo conferido'
              : `${pendentes} sem correção automática${resolvidos > 0 ? ` · ${resolvidos} resolvido${resolvidos > 1 ? 's' : ''}` : ''}`
          }
          subtitulo="Compare o PDF com o documento e ajuste em “Como vai ficar”. ← e → trocam de trecho."
          onFechar={() => setAberta(false)}
          corpoSemRolagem
          rodape={
            <>
              <div className="mr-auto flex items-center gap-2">
                <button type="button" onClick={() => irPara(atual - 1)} disabled={atual === 0} className={BTN_OUTLINE}>
                  <ChevronLeft className="size-3.5" strokeWidth={2.25} />
                  Anterior
                </button>
                <span className="px-2 text-[15px] text-mid-grey tabular-nums" aria-live="polite">
                  <span className="font-semibold text-navy">{atual + 1}</span> de {total}
                </span>
                <button
                  type="button"
                  onClick={() => irPara(atual + 1)}
                  disabled={atual === total - 1}
                  className={BTN_OUTLINE}
                >
                  Próximo
                  <ChevronRight className="size-3.5" strokeWidth={2.25} />
                </button>
              </div>
              {onVerPagina && (
                <button
                  type="button"
                  onClick={() =>
                    // Destaca o "no PDF"; sem ele, procura o texto do documento
                    // (costuma existir no PDF perto do ponto com problema). O terceiro
                    // argumento deixa selecionar um trecho lá e trazer pra cá.
                    onVerPagina(
                      item.trecho.pagina,
                      noPdf ?? item.trecho.correcaoSugerida ?? item.trecho.trecho,
                      (texto) => setNotasPdfManual((notas) => ({ ...notas, [item.id]: texto }))
                    )
                  }
                  className={BTN_OUTLINE}
                  title="Abrir a página do PDF com o trecho destacado"
                >
                  <ExternalLink className="size-3.5" strokeWidth={2.25} />
                  Ver trecho no PDF · pág. {item.trecho.pagina}
                </button>
              )}
              {!aplicado && (
                <button
                  type="button"
                  onClick={aplicar}
                  className={BTN_PRIMARY}
                  disabled={aplicando || !editado || !localizado}
                  title={
                    !localizado
                      ? 'Não achei esse trecho igual no documento — copie "Como vai ficar" e cole direto no texto'
                      : !editado
                        ? 'Nada para aplicar ainda — o texto em "Como vai ficar" está igual ao que já está no documento'
                        : undefined
                  }
                >
                  <Check className="size-3.5" strokeWidth={2.5} />
                  Aplicar no documento
                </button>
              )}
            </>
          }
        >
          <div className="flex flex-col gap-3 md:h-full md:min-h-0">
            {contagem.length > 1 && (
              <div role="tablist" aria-label="Filtrar por motivo" className="flex shrink-0 flex-wrap gap-1.5">
                {[{ razao: 'todos' as const, total: itens.length }, ...contagem].map((c) => {
                  const ativo = filtroValido === c.razao
                  return (
                    <button
                      key={c.razao}
                      type="button"
                      role="tab"
                      aria-selected={ativo}
                      onClick={() => filtrar(c.razao)}
                      title={c.razao === 'todos' ? undefined : RAZOES[c.razao].explicacao}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium transition-colors',
                        ativo
                          ? 'border-navy bg-navy text-white'
                          : 'border-border-grey bg-white text-navy hover:border-navy/35 hover:bg-navy/[0.04]'
                      )}
                    >
                      {c.razao === 'todos' ? 'Todos' : RAZOES[c.razao].rotulo}
                      <span className={cn('tabular-nums', ativo ? 'text-white/80' : 'text-mid-grey')}>{c.total}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Contexto numa faixa só: o que a IA viu + por que não tem correção automática. */}
            <div className="shrink-0 space-y-0.5 rounded-lg border-l-4 border-orange bg-orange-light/40 px-4 py-2.5">
              <p className="text-[15px] leading-snug text-navy">
                <span className="font-semibold">O que a IA viu:</span> {item.trecho.motivo}
              </p>
              <p className="text-sm leading-snug text-mid-grey">
                <span className="font-medium text-navy">{razao.rotulo}.</span> {razao.explicacao}
              </p>
            </div>

            {/* Três colunas lado a lado — em tela larga cada uma rola por dentro,
                a janela não. */}
            <div className="grid gap-3 md:min-h-0 md:flex-1 md:grid-cols-2 md:grid-rows-2 lg:grid-cols-3 lg:grid-rows-1">
              <BlocoComparacao
                rotulo={`No PDF · página ${item.trecho.pagina}`}
                cor="navy"
                acao={noPdf && botaoCopiar(noPdf, 'pdf')}
              >
                {noPdf ? (
                  paraLeitura(noPdf)
                ) : (
                  <span className="text-mid-grey">
                    O texto do PDF não veio nesta checagem — clique em &quot;Ver trecho no PDF&quot;, selecione o
                    trecho lá e depois em &quot;Usar texto selecionado&quot;.
                  </span>
                )}
              </BlocoComparacao>

              <BlocoComparacao rotulo="No documento hoje" cor="vermelho">
                {paraLeitura(atualNoDoc)}
              </BlocoComparacao>

              <div className="md:col-span-2 md:min-h-0 lg:col-span-1">
                {aplicado ? (
                  <div className="flex h-full flex-col items-start justify-center gap-3 rounded-xl border border-green-ok/30 bg-green-ok-light/50 p-5">
                    <p className="flex items-center gap-2 text-base font-medium text-navy">
                      <CircleCheck className="size-5 shrink-0 text-green-ok" strokeWidth={2.25} />
                      {aplicando ? 'Aplicando no documento...' : 'Aplicado no documento.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={desfazer} className={BTN_OUTLINE} disabled={aplicando}>
                        <Undo2 className="size-3.5" strokeWidth={2.25} />
                        Desfazer
                      </button>
                      {atual < total - 1 && (
                        <button type="button" onClick={() => irPara(atual + 1)} className={BTN_NAVY}>
                          Próximo trecho
                          <ChevronRight className="size-3.5" strokeWidth={2.25} />
                        </button>
                      )}
                    </div>
                    {erro && <p className="text-sm text-red-crit">{erro}</p>}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[14rem] flex-col overflow-hidden rounded-xl border border-green-ok/40 md:min-h-0">
                    <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border-grey bg-light-grey/60 px-4 py-2">
                      <p className="flex items-center gap-2 text-[15px] font-semibold text-navy">
                        <span aria-hidden className="size-2.5 rounded-full bg-green-ok" />
                        Como vai ficar
                      </p>
                      <div
                        role="group"
                        aria-label="O que entra no texto final"
                        className="inline-flex rounded-lg border border-border-grey bg-white p-0.5"
                      >
                        {MODOS.map(({ modo, rotulo, dica }) => {
                          const ativo = modoAtivo === modo
                          const precisaPdf = modo !== 'atual'
                          return (
                            <button
                              key={modo}
                              type="button"
                              onClick={() => mudarRascunho(textoDoModo(modo, noPdf ?? '', atualNoDoc))}
                              disabled={precisaPdf && !noPdf}
                              aria-pressed={ativo}
                              title={precisaPdf && !noPdf ? SEM_TEXTO_PDF : dica}
                              className={cn(
                                'rounded-md px-2.5 py-1 text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40',
                                ativo ? 'bg-navy text-white' : 'text-navy hover:bg-navy/[0.06]'
                              )}
                            >
                              {rotulo}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <textarea
                      aria-label="Como vai ficar no documento"
                      value={rascunho}
                      onChange={(e) => mudarRascunho(e.target.value)}
                      spellCheck={false}
                      className="block min-h-[8rem] w-full flex-1 resize-none bg-white px-4 py-3 text-base leading-relaxed text-navy outline-none focus:bg-green-ok-light/20"
                    />
                    <div className="shrink-0 space-y-1 border-t border-border-grey px-4 py-2 text-sm leading-snug text-mid-grey">
                      <p>
                        {modoAtivo === null ? 'Editado à mão. ' : 'Dá pra editar aqui. '}Markdown:{' '}
                        <code className="rounded bg-navy/[0.06] px-1 text-navy">##</code> título,{' '}
                        <code className="rounded bg-navy/[0.06] px-1 text-navy">-</code> item de lista.
                      </p>
                      {ocorrencias > 1 && <p>Aparece {ocorrencias} vezes no documento — troca a primeira.</p>}
                      {!noPdf && (
                        <p className="text-navy">
                          {SEM_TEXTO_PDF} — copie da página {item.trecho.pagina} e cole aqui.
                        </p>
                      )}
                      {!localizado && (
                        <>
                          <p className="text-navy">
                            Não achei esse trecho igual no documento hoje pra trocar sozinho — selecione o texto
                            acima e cole direto no ponto certo do documento.
                          </p>
                          {/* "No documento hoje" acima passa por `paraLeitura` (limpa
                              marcação Markdown, junta espaço duplo) só pra ficar legível —
                              a busca usa o texto CRU. Às vezes os dois textos parecem
                              idênticos na tela e mesmo assim não casam: a diferença
                              real (marcação escondida, espaço/quebra de linha extra que
                              a limpeza visual apagou) só aparece no bruto. */}
                          <details className="rounded-md border border-border-grey bg-light-grey/50 px-2 py-1.5">
                            <summary className="cursor-pointer font-medium text-navy">
                              Ver texto bruto usado na busca (sem limpeza visual)
                            </summary>
                            <pre className="mt-1.5 max-h-40 overflow-auto rounded bg-white p-2 font-mono text-xs whitespace-pre-wrap break-words text-navy">
                              {atualNoDoc}
                            </pre>
                          </details>
                        </>
                      )}
                      {/* Achou o trecho no documento, mas o rascunho ainda é igual ao
                          que já está lá — sem isso a pessoa via o botão apagado e sem
                          nenhuma pista do motivo (a mensagem acima só cobre !localizado). */}
                      {localizado && !editado && (
                        <p className="text-navy">
                          Nada para aplicar ainda — o texto de &quot;Como vai ficar&quot; está igual ao que já
                          está no documento hoje. Troque para &quot;PDF&quot; ou edite o texto acima.
                        </p>
                      )}
                      {erro && <p className="text-red-crit">{erro}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </JanelaRevisao>
      )}
    </div>
  )
}

/**
 * Prévia das correções automáticas ("Ver antes"): mesmo modelo de
 * conferência do `TrechosParaConferir` — um trecho por vez, "O que a IA
 * viu" em destaque, PDF × documento lado a lado e "Como vai ficar"
 * editável com os mesmos atalhos (Atual / PDF / PDF + atual / Atual + PDF).
 *
 * Diferença de propósito: aqui a correção já veio pronta do PDF, então o
 * editor começa em "PDF" (não em "Atual" como na conferência manual) e
 * "Aplicar no documento" grava aquele trecho na hora — não depende do
 * "Corrigir N automaticamente" em lote (que continua existindo no painel,
 * pra quem prefere aplicar tudo de uma vez sem revisar item a item).
 *
 * Sem estado de índice/rascunho por fora: a cada trecho aplicado, ele para
 * de bater com o texto atual e some de `disponiveis` no próximo render —
 * a lista encolhe sozinha, como na conferência manual.
 */
function PreviaCorrecoesAutomaticas({
  mudancas,
  markdown,
  onFechar,
  onAplicar,
  onVerPagina,
  onItemAplicado,
  onItemDesfeito,
}: {
  mudancas: Mudanca[]
  markdown: string
  onFechar: () => void
  onAplicar: (markdown: string) => Promise<void>
  onVerPagina?: (pagina: number, destaque?: string, onUsarSelecao?: (texto: string) => void) => void
  /** Avisa o painel que este trecho foi aplicado/desfeito por aqui — pra
   *  uma auditoria seguinte não voltar a mostrar como pendente algo que a
   *  pessoa já resolveu (a IA não tem memória entre uma auditoria e outra). */
  onItemAplicado?: (antes: string, depois: string) => void
  onItemDesfeito?: (antes: string, depois: string) => void
}) {
  const [indice, setIndice] = useState(0)
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({})
  const [aplicados, setAplicados] = useState<Record<string, Aplicado>>({})
  const [aplicando, setAplicando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const total = mudancas.length
  const atual = Math.min(indice, total - 1)
  const item = mudancas[atual]

  function irPara(novo: number) {
    setIndice(Math.max(0, Math.min(novo, total - 1)))
    setErro(null)
  }

  // Setas do teclado trocam de trecho, igual na conferência manual.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'ArrowRight') setIndice((i) => Math.min(i + 1, total - 1))
      if (e.key === 'ArrowLeft') setIndice((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [total])

  if (!item) return null

  const noPdf = item.depois
  const atualNoDoc = item.antes
  const rascunho = rascunhos[item.id] ?? noPdf
  const local = localizarTrecho(markdown, atualNoDoc)
  const ocorrencias = contarOcorrencias(markdown, atualNoDoc)
  const aplicado = aplicados[item.id]
  const modoAtivo = MODOS.find(({ modo }) => rascunho === textoDoModo(modo, noPdf, atualNoDoc))?.modo ?? null

  function mudarRascunho(texto: string) {
    setRascunhos((r) => ({ ...r, [item.id]: texto }))
    setErro(null)
  }

  async function aplicar() {
    if (!local) return
    const depois = markdown.slice(0, local.inicio) + rascunho + markdown.slice(local.inicio + local.encontrado.length)
    const id = item.id
    setAplicados((a) => ({ ...a, [id]: { antes: markdown, depois, novo: rascunho } }))
    onItemAplicado?.(atualNoDoc, rascunho)
    setAplicando(true)
    setErro(null)
    try {
      await onAplicar(depois)
    } catch {
      setErro('Entrou no documento, mas não salvou. Use "Tentar de novo" na barra do documento.')
    } finally {
      setAplicando(false)
    }
  }

  async function desfazer() {
    if (!aplicado) return
    let volta: string | null = null
    if (markdown === aplicado.depois) {
      volta = aplicado.antes
    } else if (aplicado.novo && contarOcorrencias(markdown, aplicado.novo) === 1) {
      volta = markdown.replace(aplicado.novo, () => atualNoDoc)
    }
    if (volta === null) {
      setErro('O texto mudou nesse ponto depois de aplicar — desfaça direto no documento.')
      return
    }
    const id = item.id
    onItemDesfeito?.(atualNoDoc, rascunhos[id] ?? item.depois)
    setAplicando(true)
    setErro(null)
    try {
      await onAplicar(volta)
    } catch {
      setErro('Voltou no documento, mas não salvou. Use "Tentar de novo" na barra do documento.')
    } finally {
      setAplicados((a) => {
        const novo = { ...a }
        delete novo[id]
        return novo
      })
      setAplicando(false)
    }
  }

  return (
    <JanelaRevisao
      titulo={`${total} ${total === 1 ? 'correção pronta' : 'correções prontas'}`}
      subtitulo="Compare o PDF com o documento e ajuste em “Como vai ficar”. ← e → trocam de correção."
      onFechar={onFechar}
      corpoSemRolagem
      rodape={
        <>
          <div className="mr-auto flex items-center gap-2">
            <button type="button" onClick={() => irPara(atual - 1)} disabled={atual === 0} className={BTN_OUTLINE}>
              <ChevronLeft className="size-3.5" strokeWidth={2.25} />
              Anterior
            </button>
            <span className="px-2 text-[15px] text-mid-grey tabular-nums" aria-live="polite">
              <span className="font-semibold text-navy">{atual + 1}</span> de {total}
            </span>
            <button
              type="button"
              onClick={() => irPara(atual + 1)}
              disabled={atual === total - 1}
              className={BTN_OUTLINE}
            >
              Próximo
              <ChevronRight className="size-3.5" strokeWidth={2.25} />
            </button>
          </div>
          {onVerPagina && item.pagina !== undefined && (
            <button
              type="button"
              onClick={() => onVerPagina(item.pagina!, noPdf)}
              className={BTN_OUTLINE}
              title="Abrir a página do PDF com o trecho destacado"
            >
              <ExternalLink className="size-3.5" strokeWidth={2.25} />
              Ver trecho no PDF · pág. {item.pagina}
            </button>
          )}
          {!aplicado && local && (
            <button type="button" onClick={aplicar} className={BTN_PRIMARY} disabled={aplicando}>
              <Check className="size-3.5" strokeWidth={2.5} />
              Aplicar no documento
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 md:h-full md:min-h-0">
        {/* Contexto numa faixa só, igual na conferência manual — aqui é só
            o motivo, já que não existe "razão sem correção" pra explicar. */}
        <div className="shrink-0 space-y-0.5 rounded-lg border-l-4 border-orange bg-orange-light/40 px-4 py-2.5">
          <p className="text-[15px] leading-snug text-navy">
            <span className="font-semibold">O que a IA viu:</span>{' '}
            {item.motivo ?? 'Trecho corrigido a partir do PDF original.'}
          </p>
        </div>

        <div className="grid gap-3 md:min-h-0 md:flex-1 md:grid-cols-2 md:grid-rows-2 lg:grid-cols-3 lg:grid-rows-1">
          <BlocoComparacao rotulo={item.pagina !== undefined ? `No PDF · página ${item.pagina}` : 'No PDF'} cor="navy">
            {paraLeitura(noPdf)}
          </BlocoComparacao>

          <BlocoComparacao rotulo="No documento hoje" cor="vermelho">
            {paraLeitura(atualNoDoc)}
          </BlocoComparacao>

          <div className="md:col-span-2 md:min-h-0 lg:col-span-1">
            {aplicado ? (
              <div className="flex h-full flex-col items-start justify-center gap-3 rounded-xl border border-green-ok/30 bg-green-ok-light/50 p-5">
                <p className="flex items-center gap-2 text-base font-medium text-navy">
                  <CircleCheck className="size-5 shrink-0 text-green-ok" strokeWidth={2.25} />
                  {aplicando ? 'Aplicando no documento...' : 'Aplicado no documento.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={desfazer} className={BTN_OUTLINE} disabled={aplicando}>
                    <Undo2 className="size-3.5" strokeWidth={2.25} />
                    Desfazer
                  </button>
                  {atual < total - 1 && (
                    <button type="button" onClick={() => irPara(atual + 1)} className={BTN_NAVY}>
                      Próximo trecho
                      <ChevronRight className="size-3.5" strokeWidth={2.25} />
                    </button>
                  )}
                </div>
                {erro && <p className="text-sm text-red-crit">{erro}</p>}
              </div>
            ) : !local ? (
              <div className="flex h-full items-center rounded-xl border border-border-grey bg-light-grey/40 p-5 text-base leading-relaxed text-navy">
                <p>Esse trecho já não existe mais assim no documento — pode já ter sido editado ou corrigido.</p>
              </div>
            ) : (
              <div className="flex h-full min-h-[14rem] flex-col overflow-hidden rounded-xl border border-green-ok/40 md:min-h-0">
                <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border-grey bg-light-grey/60 px-4 py-2">
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-navy">
                    <span aria-hidden className="size-2.5 rounded-full bg-green-ok" />
                    Como vai ficar
                  </p>
                  <div
                    role="group"
                    aria-label="O que entra no texto final"
                    className="inline-flex rounded-lg border border-border-grey bg-white p-0.5"
                  >
                    {MODOS.map(({ modo, rotulo, dica }) => {
                      const ativo = modoAtivo === modo
                      return (
                        <button
                          key={modo}
                          type="button"
                          onClick={() => mudarRascunho(textoDoModo(modo, noPdf, atualNoDoc))}
                          aria-pressed={ativo}
                          title={dica}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-sm font-medium whitespace-nowrap transition-colors',
                            ativo ? 'bg-navy text-white' : 'text-navy hover:bg-navy/[0.06]'
                          )}
                        >
                          {rotulo}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <textarea
                  aria-label="Como vai ficar no documento"
                  value={rascunho}
                  onChange={(e) => mudarRascunho(e.target.value)}
                  spellCheck={false}
                  className="block min-h-[8rem] w-full flex-1 resize-none bg-white px-4 py-3 text-base leading-relaxed text-navy outline-none focus:bg-green-ok-light/20"
                />
                <div className="shrink-0 space-y-1 border-t border-border-grey px-4 py-2 text-sm leading-snug text-mid-grey">
                  <p>
                    {modoAtivo === null ? 'Editado à mão. ' : 'Dá pra editar aqui. '}Markdown:{' '}
                    <code className="rounded bg-navy/[0.06] px-1 text-navy">##</code> título,{' '}
                    <code className="rounded bg-navy/[0.06] px-1 text-navy">-</code> item de lista.
                  </p>
                  {ocorrencias > 1 && <p>Aparece {ocorrencias} vezes no documento — troca a primeira.</p>}
                  {erro && <p className="text-red-crit">{erro}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </JanelaRevisao>
  )
}

const SEM_TEXTO_PDF = 'Esta checagem não trouxe o texto do PDF pra este trecho'

type ModoRascunho = 'atual' | 'pdf' | 'pdf-antes' | 'pdf-depois'

/** O que entra no texto final. Só as duas opções diretas — "PDF + atual" e
 *  "Atual + PDF" (concatenar os dois) confundiam mais do que ajudavam,
 *  então saíram dos botões; `textoDoModo` continua sabendo montar esse
 *  texto (usado só se algum rascunho antigo salvo ainda tiver esse modo). */
const MODOS: { modo: ModoRascunho; rotulo: string; dica: string }[] = [
  { modo: 'atual', rotulo: 'Atual', dica: 'Fica como está hoje no documento' },
  { modo: 'pdf', rotulo: 'PDF', dica: 'Troca pelo texto do PDF' },
]

function textoDoModo(modo: ModoRascunho, noPdf: string, atual: string): string {
  if (modo === 'atual') return atual
  if (modo === 'pdf') return noPdf
  return modo === 'pdf-antes' ? `${noPdf}\n\n${atual}` : `${atual}\n\n${noPdf}`
}

/** O que foi aplicado num trecho — pra "Desfazer" saber voltar. */
type Aplicado = { antes: string; depois: string; novo: string }

/** Limpa marcação Markdown/HTML só pra EXIBIR nas colunas de comparação —
 *  quem está comparando quer ler o conteúdo, não decifrar sintaxe (`##`,
 *  `<p align="center">`...). NUNCA usar isso pra localizar/aplicar: a busca
 *  de posição e o "Aplicar no documento" continuam com o texto Markdown de
 *  verdade, intacto — isso é só cosmético, pra tela ficar legível. */
function paraLeitura(texto: string): string {
  return texto
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function contarOcorrencias(texto: string, trecho: string): number {
  if (!trecho) return 0
  let total = 0
  let posicao = texto.indexOf(trecho)
  while (posicao !== -1) {
    total++
    posicao = texto.indexOf(trecho, posicao + trecho.length)
  }
  return total
}

/** Acha `trecho` dentro de `texto` tolerando diferença de espaço/quebra de
 *  linha — o texto que a IA devolve costuma ser o mesmo conteúdo do
 *  Markdown, só com espaçamento levemente diferente (não bytes idênticos).
 *  `\s*` (não `\s+`): quando o próprio bug reportado é falta de separador
 *  entre dois pedaços de texto que ficaram colados na conversão (ex.: fim
 *  de rodapé grudado no início da página seguinte, sem quebra nenhuma), o
 *  trecho que a IA devolve tem um espaço ali de leitura — exigir pelo
 *  menos um espaço no documento pra casar faria essa checagem falhar
 *  bem onde ela mais precisa funcionar.
 *  Devolve a posição E o texto exatamente como está no documento, pra
 *  trocar só aquele pedaço sem arriscar mais nada. `null` quando não achou
 *  de jeito nenhum — aí não dá pra aplicar sozinho, só à mão. */
function localizarTrecho(texto: string, trecho: string): { inicio: number; encontrado: string } | null {
  if (!trecho.trim()) return null
  const direto = texto.indexOf(trecho)
  if (direto !== -1) return { inicio: direto, encontrado: trecho }
  const escapado = trecho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
  try {
    const encontrado = texto.match(new RegExp(escapado))
    if (encontrado && encontrado.index !== undefined) return { inicio: encontrado.index, encontrado: encontrado[0] }
  } catch {
    // cai pro tolerante abaixo
  }
  // Terceira tentativa: tolera acento, caixa e o marcador de lista do PDF
  // (•, ▪...) virando "-" na conversão — a mesma classe de diferença que
  // `normalizar()` já ignora do lado do servidor (checarConversao.ts) na
  // hora de validar uma correção, mas que as duas tentativas acima (quase
  // byte a byte) não perdoam. Sem isso, um trecho que só diverge nisso
  // nunca acha onde aplicar — mesmo sendo, pro olho humano, claramente o
  // mesmo texto — e "Aplicar no documento" fica preso desabilitado à toa.
  return localizarTrechoTolerante(texto, trecho)
}

/** Marcador de lista do PDF (•, ▪, o bullet da fonte Symbol...) — no
 *  Markdown gerado ele sempre vira "-", então pra comparação ele conta
 *  como espaço em ambos os lados (mesmo critério de `normalizar()` em
 *  checarConversao.ts). */
const MARCADORES_LISTA_UI =
  /[\u2022\u2023\u2043\u25aa\u25ab\u25cf\u25cb\u25a0\u25a1\u25ba\u25b8\u25e6\uf0a7\uf0b7]/

/** Índices (no texto original) do próprio caractere marcador — "-", "*" ou
 *  "+" — de um item de lista Markdown NO INÍCIO da linha (com espaço
 *  depois). Só esses contam como "bullet" pra normalização abaixo — um
 *  hífen no meio da linha (código, intervalo de datas/valores) continua
 *  sendo um hífen de verdade, não pode virar espaço à toa. */
function indicesDeMarcadorDeLista(texto: string): Set<number> {
  const indices = new Set<number>()
  const regex = /^[ \t]*([-*+])(?=[ \t])/gm
  let m: RegExpExecArray | null
  while ((m = regex.exec(texto))) {
    indices.add(m.index + m[0].length - 1)
  }
  return indices
}

/** Normaliza um texto (acento decomposto e removido, caixa baixa, marcador
 *  de lista — "•" do PDF OU "-"/"*"/"+" de início de linha no Markdown —
 *  virando espaço) mantendo, pra cada caractere da saída, o índice do
 *  caractere ORIGINAL que ele veio — assim dá pra achar uma posição no
 *  texto normalizado e voltar pro índice de verdade em `texto`, sem que a
 *  troca de tamanho da normalização (acento composto vira 2 "caracteres"
 *  NFD, um deles descartado) bagunce o recorte final. */
function normalizarComMapa(texto: string): { chars: string; origem: number[] } {
  const marcadores = indicesDeMarcadorDeLista(texto)
  const chars: string[] = []
  const origem: number[] = []
  for (let i = 0; i < texto.length; i++) {
    if (marcadores.has(i)) {
      chars.push(' ')
      origem.push(i)
      continue
    }
    for (const parte of texto[i].normalize('NFD')) {
      if (parte >= '\u0300' && parte <= '\u036f') continue // marca diacrítica — já aplicada ao caractere anterior, descarta
      chars.push(MARCADORES_LISTA_UI.test(parte) ? ' ' : parte.toLowerCase())
      origem.push(i)
    }
  }
  return { chars: chars.join(''), origem }
}

/** Terceira tentativa de `localizarTrecho`, tolerando acento/caixa/marcador
 *  de lista — ver o comentário ali de por que isso existe. Só entra em jogo
 *  depois que as duas comparações mais estritas já falharam. */
function localizarTrechoTolerante(texto: string, trecho: string): { inicio: number; encontrado: string } | null {
  const alvoBruto = normalizarComMapa(trecho).chars.trim()
  if (alvoBruto.length < 4) return null // curto demais pra confiar num achado tolerante
  const escapado = alvoBruto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
  const doc = normalizarComMapa(texto)
  let encontrado: RegExpMatchArray | null
  try {
    encontrado = doc.chars.match(new RegExp(escapado))
  } catch {
    return null
  }
  if (!encontrado || encontrado.index === undefined || encontrado[0].length === 0) return null
  const inicioNormalizado = encontrado.index
  const fimNormalizado = inicioNormalizado + encontrado[0].length - 1
  if (fimNormalizado >= doc.origem.length) return null
  const inicio = doc.origem[inicioNormalizado]
  const fim = doc.origem[fimNormalizado] + 1
  return { inicio, encontrado: texto.slice(inicio, fim) }
}

/** Trecho que tinha correção e ela já está no texto (aplicada numa rodada
 *  anterior ou à mão) — não faz sentido continuar listando como pendente. */
function jaCorrigido(trecho: TrechoSuspeitoIa, markdown: string): boolean {
  return !!trecho.correcaoSugerida && markdown.includes(trecho.correcaoSugerida)
}

/** Coluna da comparação na janela: "no PDF" (navy), "como está"
 *  (vermelho) ou "como deveria ficar" (verde). Ocupa a altura da coluna e
 *  rola por dentro quando o texto é longo. */
function BlocoComparacao({
  rotulo,
  cor,
  acao,
  rodape,
  children,
}: {
  rotulo: string
  cor: 'navy' | 'vermelho' | 'verde'
  acao?: ReactNode
  rodape?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border-grey md:min-h-0">
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-border-grey bg-light-grey/60 px-4 py-2">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-navy">
          <span
            aria-hidden
            className={cn(
              'size-2.5 rounded-full',
              cor === 'navy' ? 'bg-navy' : cor === 'verde' ? 'bg-green-ok' : 'bg-red-crit'
            )}
          />
          {rotulo}
        </p>
        {acao}
      </div>
      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto px-4 py-3 text-base leading-relaxed break-words whitespace-pre-wrap text-navy',
          cor === 'vermelho' && 'bg-red-crit-light/40',
          cor === 'verde' && 'bg-green-ok-light/50'
        )}
      >
        {children}
      </div>
      {rodape && <div className="shrink-0 border-t border-border-grey px-4 py-2">{rodape}</div>}
    </div>
  )
}

function SeloConfiabilidade({ valor }: { valor: number }) {
  const cor =
    valor >= 90
      ? 'border-green-ok/30 bg-green-ok-light text-green-ok'
      : valor >= 70
        ? 'border-orange/30 bg-orange-light/60 text-orange-dark'
        : 'border-red-crit/30 bg-red-crit-light text-red-crit'
  const titulo = 'Confiabilidade da conversão — compara cada página do PDF com o documento inteiro. Estimativa da IA, não é garantia.'
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full border px-2 py-0.5 text-sm font-semibold tabular-nums', cor)}
      title={titulo}
    >
      {valor}%<span className="sr-only"> de confiabilidade, estimativa da IA</span>
    </span>
  )
}
