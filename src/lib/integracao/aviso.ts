import { after } from 'next/server'

// "A cada mudança": toda escrita do VerAI numa tabela do domínio comercial dispara os webhooks dos apps
// que assinam aquele recurso (src/lib/api/webhooks.ts). A detecção é na camada do banco — o `prisma`
// (src/lib/prisma.ts) entrega cada SQL a `observarSql` — então nenhuma rota precisa lembrar de avisar.
// O aviso sai DEPOIS da resposta (`after`), quando a escrita já foi gravada; fora de requisição
// (script, cron) sai no próximo ciclo — script chama `despacharAvisos()` no fim. Aviso perdido não é
// problema: quem consome tem a passada periódica. Spec 2026-10-08-api-plataforma §5.

/** Tabela do Postgres → recursos da API que ela afeta. Model novo do domínio comercial entra aqui. */
const ENTIDADES_DA_TABELA: Record<string, string[]> = {
  Cliente: ['clientes', 'gerencias', 'contratos', 'historico', 'faturamentos', 'alertas', 'demandas', 'solicitacoes'],
  CarteiraCliente: ['clientes', 'gerencias', 'contratos', 'historico', 'faturamentos', 'alertas', 'demandas', 'solicitacoes'],
  Gerencia: ['gerencias', 'clientes'],
  MembroGerencia: ['gerencias'],
  Usuario: ['gerencias'],
  Contrato: ['contratos', 'historico', 'faturamentos', 'alertas', 'clientes', 'gerencias'],
  HistoricoContrato: ['contratos', 'historico', 'alertas', 'clientes', 'gerencias'],
  ItemContrato: ['contratos', 'alertas', 'clientes', 'gerencias'],
  Faturamento: ['contratos', 'faturamentos', 'alertas', 'clientes', 'gerencias'],
  NotaFiscal: ['faturamentos'],
  Demanda: ['demandas'],
  TramiteDemanda: ['demandas'],
  Solicitacao: ['solicitacoes'],
}

const ESCRITA = /^\s*(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:"[^"]+"\.)?"([^"]+)"/i

/** Entidades afetadas por um SQL; vazio para leitura ou tabela fora do domínio comercial. */
export function entidadesDoSql(sql: string): string[] {
  const m = ESCRITA.exec(sql)
  return m ? ENTIDADES_DA_TABELA[m[1]] ?? [] : []
}

const pendentes = new Set<string>()
let agendado = false

export function observarSql(sql: string): void {
  const entidades = entidadesDoSql(sql)
  if (entidades.length > 0) registrarMudanca(entidades)
}

export function registrarMudanca(entidades: string[]): void {
  for (const e of entidades) pendentes.add(e)
  if (agendado) return
  agendado = true
  try {
    after(despacharAvisos)
  } catch {
    // Fora de uma requisição do Next (script, teste): sai no próximo ciclo, já com o lote junto.
    setTimeout(() => void despacharAvisos(), 0)
  }
}

/** Dispara agora os webhooks do lote pendente. Nunca lança. Scripts chamam no fim. */
export async function despacharAvisos(): Promise<void> {
  agendado = false
  const recursos = [...pendentes].sort()
  pendentes.clear()
  if (recursos.length === 0) return
  try {
    // Import dinâmico: webhooks → prisma → aviso seria ciclo.
    const { dispararWebhooks } = await import('@/lib/api/webhooks')
    await dispararWebhooks(recursos)
  } catch (erro) {
    console.warn('[api] aviso de mudança não saiu (a passada periódica de quem consome pega)', erro)
  }
}
