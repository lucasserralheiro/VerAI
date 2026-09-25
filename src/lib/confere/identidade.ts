// De que contrato é o levantamento — número, órgão e ano, a partir do que a planilha escreveu em
// "conforme contrato :". A primeira forma é a do Confere (`IdentidadeContratual.de_referencia_da_aba`,
// services/confere/backend/src/domain/value_objects/identidade_contratual.py — ESPEC 029):
// `52/SMIT/2024`, `52-A/SMIT/2024`. As outras duas foram medidas nos levantamentos reais de
// 25/09/2026 e o Confere não as reconhece (fica em silêncio, `R-IDT-06`): `07/2024/SMDET` (órgão no
// fim) e `387/2024` sem órgão (HSPM) — aí o órgão sai do título da aba ("LEVANTAMENTO -
// COMPROVAÇÃO HSPM - ...").

export interface IdentidadeDoContrato {
  /** O número como valor: `015` e `15` são o mesmo contrato. */
  base: number
  /** Em maiúsculas; `null` quando nem a referência nem o título dizem o órgão. */
  orgao: string | null
  ano: string
}

const LETRAS = 'A-Za-zÀ-Úà-ú'
const ORGAO_NO_MEIO = new RegExp(
  `(\\d{1,4})(?:\\s*-\\s*([A-Za-z0-9]{1,3}))?\\s*/\\s*([${LETRAS}]{2,12})\\s*/\\s*(\\d{4})`
)
const ORGAO_NO_FIM = new RegExp(`(\\d{1,4})\\s*/\\s*(\\d{4})\\s*/\\s*([${LETRAS}]{2,12})`)
const SEM_ORGAO = /(\d{1,4})\s*\/\s*(\d{4})(?!\d)/
const ORGAO_DO_TITULO = new RegExp(`COMPROVA[ÇC][ÃA]O\\s+([${LETRAS}]{2,12})`, 'i')

export function identidadeDoContrato(referencia: string | null, titulo: string | null = null): IdentidadeDoContrato | null {
  if (!referencia) return null
  const texto = referencia.replace(/\s+/g, ' ')
  const noMeio = ORGAO_NO_MEIO.exec(texto)
  if (noMeio) return { base: Number(noMeio[1]), orgao: noMeio[3].toUpperCase(), ano: noMeio[4] }
  const noFim = ORGAO_NO_FIM.exec(texto)
  if (noFim) return { base: Number(noFim[1]), orgao: noFim[3].toUpperCase(), ano: noFim[2] }
  const semOrgao = SEM_ORGAO.exec(texto)
  if (!semOrgao) return null
  const doTitulo = titulo ? ORGAO_DO_TITULO.exec(titulo) : null
  return { base: Number(semOrgao[1]), orgao: doTitulo ? doTitulo[1].toUpperCase() : null, ano: semOrgao[2] }
}
