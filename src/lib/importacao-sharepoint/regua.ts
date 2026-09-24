import { motivoIgnorar, normalizarChave, siglaDaPasta, type MapaPastas } from '@/lib/arquivos/sharepoint/regras'
import { montarEstrutura, type ContratoPasta, type TermoPasta } from './estrutura'

// Régua da leitura do SharePoint: fotografa como cada pasta da biblioteca vira contrato e termo e
// compara duas fotos, campo a campo. Serve pra mudar regra de estrutura/identidade (`estrutura.ts`,
// `regras.ts`, `scripts/sharepoint-clientes.json`) sabendo o que a mudança mexeu no resto da
// biblioteca — antes e depois, NA MESMA lista de arquivos (scripts/regua-sharepoint.ts guarda a lista
// junto com a foto). Mesmo espírito da régua da conversão de PDF (`npm run diag:pdf`).

export interface ArquivoListado {
  caminho: string
  tamanhoBytes: number
}

export interface ConfiguracaoBiblioteca {
  mapa: MapaPastas
  rotearPeloNome: string[]
}

export interface FotoTermo {
  pasta: string
  tipo: TermoPasta['tipo']
  numero: string | null
  aviso: TermoPasta['aviso']
  /** Nome relativo à pasta do termo — o caminho inteiro repetiria a pasta em toda linha. */
  termoPdf: string | null
  propostaPdf: string | null
  arquivos: number
}

export interface FotoContrato {
  chave: string
  numeroTermo: string
  finalizado: boolean
  termos: FotoTermo[]
}

const CAMPOS_TERMO = ['tipo', 'numero', 'aviso', 'termoPdf', 'propostaPdf', 'arquivos'] as const

/** A estrutura que a sincronização monta (etapas 1–3 de `sincronizarSharepoint`), sem banco: fora o
 *  lixo técnico, as pastas ignoradas no mapa e as roteadas pelo nome (publicação do DOC não é contrato).
 *  Diferença única: aqui pasta de cliente que ainda não existe no VerAI também entra. */
export function lerBiblioteca(arquivos: ArquivoListado[], { mapa, rotearPeloNome }: ConfiguracaoBiblioteca): ContratoPasta[] {
  const roteada = (pasta: string) => rotearPeloNome.some((p) => normalizarChave(p) === normalizarChave(pasta))
  const caminhos = arquivos
    .map((a) => ({ ...a, caminho: a.caminho.normalize('NFC') }))
    .filter((a) => {
      const segmentos = a.caminho.split('/')
      return !motivoIgnorar(segmentos, a.tamanhoBytes) && !roteada(segmentos[0]) && siglaDaPasta(segmentos[0], mapa) !== null
    })
    .map((a) => a.caminho)
    .sort((a, b) => a.localeCompare(b))
  return montarEstrutura(caminhos, (pasta) => siglaDaPasta(pasta, mapa) ?? normalizarChave(pasta))
}

export function fotografarEstrutura(estrutura: ContratoPasta[]): FotoContrato[] {
  return estrutura.map((c) => ({
    chave: c.chave,
    numeroTermo: c.numeroTermo,
    finalizado: c.finalizado,
    termos: c.termos.map((t) => {
      const pastaReal = t.pasta.replace(/#inicial$/, '') + '/'
      const relativo = (caminho: string | null) => (caminho?.startsWith(pastaReal) ? caminho.slice(pastaReal.length) : caminho)
      return {
        pasta: t.pasta,
        tipo: t.tipo,
        numero: t.numero,
        aviso: t.aviso,
        termoPdf: relativo(t.termoPdf),
        propostaPdf: relativo(t.propostaPdf),
        arquivos: t.arquivos.length,
      }
    }),
  }))
}

const mostrar = (valor: unknown) => (valor === null || valor === undefined ? '(nenhum)' : String(valor))

/** Uma linha por diferença, na ordem das chaves de contrato; vazio = a regra nova lê igual. */
export function compararFotos(antes: FotoContrato[], depois: FotoContrato[]): string[] {
  const porChave = (fotos: FotoContrato[]) => new Map(fotos.map((c) => [c.chave, c]))
  const a = porChave(antes)
  const d = porChave(depois)
  const chaves = [...new Set([...a.keys(), ...d.keys()])].sort((x, y) => x.localeCompare(y))
  const saida: string[] = []

  for (const chave of chaves) {
    const velho = a.get(chave)
    const novo = d.get(chave)
    if (!velho) {
      saida.push(`${chave}: contrato novo (${novo!.termos.length} termos)`)
      continue
    }
    if (!novo) {
      saida.push(`${chave}: contrato sumiu`)
      continue
    }
    if (velho.numeroTermo !== novo.numeroTermo) saida.push(`${chave}: numeroTermo ${velho.numeroTermo} → ${novo.numeroTermo}`)
    if (velho.finalizado !== novo.finalizado) saida.push(`${chave}: finalizado ${velho.finalizado} → ${novo.finalizado}`)

    const termosNovos = new Map(novo.termos.map((t) => [t.pasta, t]))
    const pastasVelhas = new Set(velho.termos.map((t) => t.pasta))
    for (const t of velho.termos) {
      const n = termosNovos.get(t.pasta)
      if (!n) {
        saida.push(`${chave} · ${t.pasta}: termo sumiu`)
        continue
      }
      for (const campo of CAMPOS_TERMO) {
        if (t[campo] !== n[campo]) saida.push(`${chave} · ${t.pasta}: ${campo} ${mostrar(t[campo])} → ${mostrar(n[campo])}`)
      }
    }
    for (const n of novo.termos) {
      if (!pastasVelhas.has(n.pasta)) saida.push(`${chave} · ${n.pasta}: termo novo (${n.tipo}${n.numero ? ` ${n.numero}` : ''})`)
    }
  }
  return saida
}
