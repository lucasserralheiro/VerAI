// Texto da linha "Documentos do SharePoint atualizados em …" (spec
// docs/superpowers/specs/2026-09-28-sharepoint-atualizado-em-design.md §5). Roda no navegador.

/** A sincronização roda a cada 30 min: passadas 2 h, 4 execuções se perderam (PC desligado, banco
 *  fora, OneDrive parado) e algum documento novo pode ainda não estar no VerAI. */
export const ATRASO_MS = 2 * 60 * 60 * 1000

const FORMATO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "28/09/2026 10:30", sempre no horário de São Paulo. */
export function dataHoraSaoPaulo(data: Date): string {
  const p = Object.fromEntries(FORMATO.formatToParts(data).map((parte) => [parte.type, parte.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

export function textoDaAtualizacao(atualizadoEm: string | null, agora: Date): { texto: string; atrasada: boolean } {
  if (!atualizadoEm) return { texto: 'Ainda não sincronizado com o SharePoint', atrasada: true }
  const data = new Date(atualizadoEm)
  const texto = `Documentos do SharePoint atualizados em ${dataHoraSaoPaulo(data)}`
  const atrasada = agora.getTime() - data.getTime() > ATRASO_MS
  return { texto: atrasada ? `${texto} — atualização atrasada` : texto, atrasada }
}
