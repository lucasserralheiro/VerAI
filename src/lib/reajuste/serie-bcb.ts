// Série 193 do SGS do Banco Central = IPC-Fipe, variação % mensal (confirmada em 30/09/2026 contra a
// Fipe, spec §1.1). Pública, sem chave; sem User-Agent o BCB devolve uma página HTML de bloqueio.

export const SERIE_IPC_FIPE = 193
export const URL_SERIE_IPC_FIPE = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SERIE_IPC_FIPE}/dados?formato=json`

export interface MesDoIndice {
  mes: string
  variacao: string
}

export class FonteIndiceIndisponivel extends Error {}

export function lerRespostaDaSerie(corpo: unknown): MesDoIndice[] {
  if (!Array.isArray(corpo) || corpo.length === 0) throw new FonteIndiceIndisponivel('resposta do Banco Central sem a série')
  return corpo.map((item) => {
    const data = typeof item?.data === 'string' ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(item.data) : null
    const valor = typeof item?.valor === 'string' ? item.valor.trim() : ''
    if (!data || !/^-?\d+(\.\d+)?$/.test(valor)) {
      throw new FonteIndiceIndisponivel(`linha fora do formato na série do Banco Central: ${JSON.stringify(item)}`)
    }
    return { mes: `${data[3]}-${data[2]}`, variacao: valor }
  })
}

export async function buscarSerieIpcFipe(fetcher: typeof fetch = fetch): Promise<MesDoIndice[]> {
  const resposta = await fetcher(URL_SERIE_IPC_FIPE, {
    headers: { 'User-Agent': 'VerAI/1.0 (PRODAM-SP)', Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!resposta.ok) throw new FonteIndiceIndisponivel(`Banco Central respondeu ${resposta.status}`)
  if (!(resposta.headers.get('content-type') ?? '').includes('json')) {
    throw new FonteIndiceIndisponivel('Banco Central devolveu uma página em vez da série (bloqueio ou manutenção)')
  }
  return lerRespostaDaSerie(await resposta.json())
}
